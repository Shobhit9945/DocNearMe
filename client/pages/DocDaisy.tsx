import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, ChevronLeft } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
const apiKey = import.meta.env.GEMINI_API_KEY;

// Configuration for the Gemini API call
const model = 'gemini-2.5-flash-preview-05-20';
// We'll proxy requests through our serverless function so the API key stays secret.
// The proxy endpoint will be: /api/gemini?model=<model>
const apiProxyBase = `/api/gemini?model=${encodeURIComponent(model)}`;

// --- Utility function for robust API calls with exponential backoff ---
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      } else if (response.status === 429) {
        // Too many requests: wait and retry
        if (i < retries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.log(`Rate limit exceeded (429). Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.log(`Fetch error. Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};
// -----------------------------------------------------------------------

const DocDaisy = () => {
  const navigate = useNavigate(); // Initialize navigate hook
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! I'm DocDaisy, your AI Assistant. Please describe your main symptom so I can ask a few follow-up questions." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // State to hold the AI's final recommended specialization
  const [recommendedSpecialization, setRecommendedSpecialization] = useState<string | null>(null); 
  
  const messagesEndRef = useRef(null);

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input;
    // 1. Add user message to state
    const newUserMessage = { sender: "user", text: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    
    // Clear input field immediately and reset loading states
    setInput("");
    setIsLoading(true);
    setRecommendedSpecialization(null); // Clear previous recommendation

    try {
      // Conclusion is reached after 3 user/bot pairs (messages.length >= 6)
      const shouldConclude = messages.length >= 6; 
      
      let finalBotReply: string;
      let specialization: string | null = null;

      if (shouldConclude) {
         // --- Structured JSON Response Request for Final Assessment ---
         const systemPrompt = `Based on the user's symptoms and the entire conversation history, provide a final, brief summary (under 30 words) and recommend the most appropriate medical specialization (Cardiologist, Dermatologist, ENT, General Physician, Pediatrician, Orthopedic Surgeon). If unsure, use 'Unsure'. ONLY respond with a JSON object conforming to the schema. Conversation History: ${messages.map(m => `${m.sender}: ${m.text}`).join(' | ')}. User's final input: ${userInput}`;
         
         const structuredPayload = {
             contents: [{ parts: [{ text: systemPrompt }] }],
             generationConfig: {
                 responseMimeType: "application/json",
                 responseSchema: {
                     type: "OBJECT",
                     properties: {
                         "summary": { "type": "STRING", "description": "A concluding message summarizing the conversation and the recommendation (under 30 words)." },
                         "specialization": { "type": "STRING", "description": "The specific doctor type being recommended (must be one of: Cardiologist, Dermatologist, ENT, General Physician, Pediatrician, Orthopedic Surgeon, Unsure)." }
                     },
                     required: ["summary", "specialization"]
                 }
             }
         };

     const structuredResponse = await fetchWithRetry(apiProxyBase, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(structuredPayload),
     });

         const structuredData = await structuredResponse.json();
         const jsonText = structuredData?.candidates?.[0]?.content?.parts?.[0]?.text;

         if (jsonText) {
             try {
                 const parsedJson = JSON.parse(jsonText);
                 finalBotReply = parsedJson.summary || "I have completed my assessment.";
                 specialization = parsedJson.specialization || null;
             } catch (e) {
                 console.error("Failed to parse JSON response:", e);
                 finalBotReply = "I completed the assessment, but there was an error processing the recommendation. Please try rephrasing your final question.";
             }
         } else {
             finalBotReply = "I couldn't generate a definitive recommendation. Please ensure your query is complete.";
         }

      } else {
        // --- Standard Text Response for Continuing Conversation (Asking follow-up questions) ---
        let payload = {
            contents: [{ parts: [{ text: userInput }] }],
            systemInstruction: {
                parts: [{ text: "You are DocDaisy, a friendly and professional AI assistant for a medical app. Your primary role in this phase is to gather details about the user's symptoms, such as duration, location, and severity, to refine the specialization recommendation. Ask a clear, concise, single follow-up question to guide the user. Do NOT provide a final recommendation yet. Do NOT use markdown formatting like **bold** in your text response, only output plain text." }]
            },
        };
        
    const response = await fetchWithRetry(apiProxyBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

        const data = await response.json();
        finalBotReply = data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I couldn't generate a response. Please try again.";
      }
      
      // 5. Add bot message to state and update recommendation state
      setMessages(prev => [...prev, { sender: "bot", text: finalBotReply }]);
      
      if (specialization && specialization !== 'Unsure') {
          setRecommendedSpecialization(specialization);
      }
      

    } catch (err) {
      console.error("Gemini API Error:", err);
      setMessages(prev => [
        ...prev,
        { sender: "bot", text: "⚠️ Error connecting to the AI. Please check your network." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchClick = () => {
      // Navigate to the search page (/search), passing the specialization as a query parameter
      if (recommendedSpecialization) {
          // Pass the specialization directly to the search route
          navigate(`/search?specialization=${encodeURIComponent(recommendedSpecialization)}`); 
      }
  };

  return (
    // The main container should utilize the whole screen for a chat UI feel
    <div className="flex flex-col h-screen max-h-screen bg-gray-50 font-sans md:max-w-md md:mx-auto md:shadow-xl">
      
      {/* Header */}
      <header className="bg-[#3A12DB] shadow-lg text-white py-4 px-4 font-extrabold text-xl sticky top-0 z-10 flex items-center">
        {/* Back Button */}
        <button onClick={() => navigate('/')} className="mr-3 p-1 rounded-full hover:bg-[#2A0F9D] transition-colors">
            <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-2xl mr-2">🌼</span> DocDaisy AI Assistant
      </header>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-6 pb-2 sm:p-6 sm:space-y-5">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-3 max-w-[85%] rounded-xl shadow-md transition-all duration-300 ease-in-out ${
                msg.sender === "user"
                  ? "bg-[#3A12DB] text-white rounded-tr-sm"
                  : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="p-3 bg-white text-gray-500 border border-gray-200 rounded-xl rounded-tl-sm flex items-center shadow-md">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              DocDaisy is typing...
            </div>
          </div>
        )}

        {/* Scroll Anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area / Recommendation Button */}
      <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0 z-10 shadow-inner">
        {recommendedSpecialization ? (
            <div className="p-3 bg-[#E5DEFF] rounded-xl border border-[#3A12DB] shadow-lg">
                <p className="text-sm font-semibold text-[#002D55] mb-3">
                    Assessment Complete: We recommend a specialist in 
                    <strong className="font-extrabold text-[#3A12DB] ml-1">{recommendedSpecialization}</strong>.
                </p>
                <button
                    onClick={handleSearchClick}
                    className="w-full bg-[#3A12DB] text-white text-base font-bold py-3 rounded-lg shadow-[0_4px_10px_0_rgba(58,18,219,0.3)] hover:bg-[#2A0F9D] transition-colors flex items-center justify-center"
                >
                    <Send className="w-5 h-5 mr-2" />
                    Search Clinics for {recommendedSpecialization}
                </button>
            </div>
        ) : (
            <div className="flex gap-3">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1 border border-gray-300 focus:border-[#3A12DB] rounded-xl px-4 py-3 text-gray-700 outline-none transition-all duration-200"
                    placeholder="Ask DocDaisy a question..."
                    disabled={isLoading}
                />
                <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="bg-[#3A12DB] hover:bg-[#2A0F9D] text-white p-3 rounded-xl shadow-md transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    title="Send Message"
                >
                    <Send className="w-6 h-6" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default DocDaisy;
