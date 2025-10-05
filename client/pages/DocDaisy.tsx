import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, ChevronLeft } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import TopNav from '@/components/TopNav';

// Configuration for the Gemini API call
const model = 'gemini-2.5-flash-preview-05-20';
// We'll proxy requests through our serverless function so the API key stays secret.
// The proxy endpoint will be: /api/gemini?model=<model>
const apiProxyBase = `/api/gemini?model=${encodeURIComponent(model)}`;
// If the AI can't determine a specialty confidently, instruct the user to contact our helpline.
const HELPLINE = "+1-800-555-0123";
// A canonical list we expect the model to return. We'll fall back to 'Unsure' if the model returns something else.
const allowedSpecializations = new Set([
  "Cardiologist","Dermatologist","ENT","General Physician","Pediatrician","Orthopedic Surgeon",
  "Neurologist","Gastroenterologist","Pulmonologist","Urologist","OB/GYN","Psychiatrist",
  "Ophthalmologist","Nephrologist","Endocrinologist","Vascular Surgeon","Unsure"
]);

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
      // Include response body for better debugging when upstream returns errors
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status} body: ${text.slice(0, 1000)}`);
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
  // If the AI cannot determine a specialty, we'll surface our helpline as a CTA
  const [helplineSuggested, setHelplineSuggested] = useState(false);
  
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
  setHelplineSuggested(false);

    try {
      // Conclusion is reached after 3 user/bot pairs (messages.length >= 6)
      const shouldConclude = messages.length >= 6; 
      
      let finalBotReply: string;
      let specialization: string | null = null;

      if (shouldConclude) {
         // --- Structured JSON Response Request for Final Assessment ---
     const systemPrompt = `Based on the user's symptoms and the entire conversation history, provide a final, brief summary (under 30 words) and recommend the single most appropriate medical specialization. Choose from the following list ONLY: Cardiologist, Dermatologist, ENT, General Physician, Pediatrician, Orthopedic Surgeon, Neurologist, Gastroenterologist, Pulmonologist, Urologist, OB/GYN, Psychiatrist, Ophthalmologist, Nephrologist, Endocrinologist, Vascular Surgeon, or Unsure. Also estimate the urgency level (one of: Home Care, Outpatient within 1 week, Urgent within 24 hours, Emergency - go to ER), and suggest a concise next step.
If you cannot determine a clear specialty from the available information, set "specialization" to "Unsure" and set "next_step" to a short instruction telling the user to contact our helpline now: ${HELPLINE} (e.g., "Please contact our helpline at ${HELPLINE} for further assistance."). ALWAYS produce a practical next step: if specialization is one of the specialties above, recommend a scheduling action (eg. "Schedule an outpatient visit with a Cardiologist"). ONLY respond with a JSON object conforming to the schema below. Conversation History: ${messages.map(m => `${m.sender}: ${m.text}`).join(' | ')}. User's final input: ${userInput}`;

    const structuredPayload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "summary": { "type": "STRING", "description": "A concluding message summarizing the conversation and the recommendation (under 30 words)." },
            "specialization": { "type": "STRING", "description": "The specific doctor type being recommended (must be one of the allowed specializations or 'Unsure').", "enum": ["Cardiologist","Dermatologist","ENT","General Physician","Pediatrician","Orthopedic Surgeon","Neurologist","Gastroenterologist","Pulmonologist","Urologist","OB/GYN","Psychiatrist","Ophthalmologist","Nephrologist","Endocrinologist","Vascular Surgeon","Unsure"] },
            "urgency": { "type": "STRING", "description": "One of: Home Care, Outpatient within 1 week, Urgent within 24 hours, Emergency - go to ER.", "enum": ["Home Care","Outpatient within 1 week","Urgent within 24 hours","Emergency - go to ER"] },
            "next_step": { "type": "STRING", "description": "A concise suggested next action (e.g., 'Schedule an outpatient visit with a General Physician', 'Go to ER immediately', or 'Please contact our helpline at XXX-XXX-XXXX')." }
          },
          required: ["summary", "specialization", "urgency", "next_step"]
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
                 // Normalize/validate specialization against allowed set
                 const rawSpec = (parsedJson.specialization || "").trim();
                 const normalizedSpec = allowedSpecializations.has(rawSpec) ? rawSpec : 'Unsure';
                 specialization = normalizedSpec;
                 // If the parsedJson next_step suggests contacting helpline, ensure it's shown to user when Unsure
                 if (normalizedSpec === 'Unsure') {
                   // Ensure next_step mentions the helpline so the UI can surface it
                   parsedJson.next_step = parsedJson.next_step || `Please contact our helpline at ${HELPLINE} for further assistance.`;
                 }
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
        parts: [{ text:
          `You are DocDaisy, a compassionate and professional AI assistant for a medical triage app. Right now your job is to collect high-quality, clinically relevant information by asking exactly ONE clear, concise follow-up question at a time (plain text only). Do NOT provide a diagnosis or final recommendation yet. Prioritize collecting information in this order: 1) Age and sex, 2) Chief complaint in the patient's words, 3) Onset and duration (when did it start?), 4) Location of the symptom(s), 5) Severity (pain scale 1-10 or mild/moderate/severe), 6) Course (steady, intermittent, worsening, improving), 7) Associated symptoms (fever, shortness of breath, chest pain, bleeding, rash, vomiting, weakness, numbness), 8) Red flags (severe chest pain, difficulty breathing, sudden weakness, fainting, uncontrolled bleeding — if any red flag is present, instruct the user to seek emergency care immediately and stop the triage flow), 9) Current medications and allergies, 10) Relevant chronic conditions and pregnancy status. Use an empathetic tone (e.g., "I'm sorry you're dealing with this — can you tell me..."). Ask one focused question that will best reduce uncertainty (give an example question style: "When did the pain start and has it gotten better or worse?"). After you ask, wait for the user's answer before asking the next question.`
        }]
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
      
    // 5. Add bot message to state and update recommendation/helpline state
    setMessages(prev => [...prev, { sender: "bot", text: finalBotReply }]);
      
    if (specialization && specialization !== 'Unsure') {
      setRecommendedSpecialization(specialization);
      setHelplineSuggested(false);
    } else if (specialization === 'Unsure') {
      // If the model explicitly states 'Unsure', surface the helpline and suggest contacting us
      setRecommendedSpecialization(null);
      setHelplineSuggested(true);
      setMessages(prev => [...prev, { sender: "bot", text: `I couldn't confidently identify a specialist. Please contact our helpline at ${HELPLINE} for live assistance.` }]);
    }
      

    } catch (err: any) {
      console.error("Gemini API Error:", err);
      const msg = err?.message ? `⚠️ Error connecting to the AI: ${err.message}` : "⚠️ Error connecting to the AI. Please check your network.";
      setMessages(prev => [
        ...prev,
        { sender: "bot", text: msg },
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
  <div className="flex flex-col h-screen max-h-screen bg-gray-50 font-sans w-full max-w-screen-xl mx-auto md:shadow-xl">
      
      {/* Top nav (desktop) */}
      <TopNav />

  {/* Mobile Header */}
  <header className="md:hidden bg-[#3A12DB] shadow-lg text-white py-4 px-4 font-extrabold text-xl sticky top-0 z-10 flex items-center">
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
              className={`p-3 max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-xl shadow-md transition-all duration-300 ease-in-out ${
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
            <div>
              {helplineSuggested ? (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-semibold">We're sorry — we couldn't determine the best specialist from the information provided.</p>
                    <p className="text-sm text-red-700">Please contact our helpline for immediate assistance:</p>
                    <a href={`tel:${HELPLINE}`} className="inline-block mt-2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-red-700">Call Helpline: {HELPLINE}</a>
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      className="flex-1 border border-gray-300 focus:border-[#3A12DB] rounded-xl px-4 py-3 text-gray-700 outline-none transition-all duration-200"
                      placeholder="Try adding more details or ask a follow-up question..."
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
        )}
      </div>
    </div>
  );
};

export default DocDaisy;
