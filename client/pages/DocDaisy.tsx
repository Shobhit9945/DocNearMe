import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageScaffold } from "@/components/PageScaffold";
import { useTranslation } from "@/lib/i18n";
import { getSpecializationLabel, resolveSpecializationId } from "@/lib/specializations";

// ---------- Types ----------
type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};

type Mode = "followup" | "conclusion";

// ---------- Helpers ----------
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Call DocDaisy via the backend
async function askDocDaisyWithRetry(
  mode: Mode,
  conversation: ChatMessage[],
  retries = 3
): Promise<{ reply: string; specialization?: string | null }> {
  let lastError: Error | null = null;
  const lastUserMessage =
    [...conversation].reverse().find((msg) => msg.sender === "user")?.text ?? "";

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("/api/docdaisy/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          mode,
          messages: conversation,
          conversationHistory: conversation,
          history: conversation,
          message: lastUserMessage,
        }),
      });

      if (!res.ok) {
        if (res.status === 429 && attempt < retries - 1) {
          await delay(2 ** attempt * 1000);
          continue;
        }
        const errBody = await res.text();
        throw new Error(`DocDaisy error ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const content = data?.reply?.trim?.() ?? "";

      if (!content) {
        throw new Error("Empty response from DocDaisy.");
      }

      return { reply: content, specialization: data?.specialization ?? null };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown DocDaisy error");
      if (attempt < retries - 1) {
        await delay(2 ** attempt * 1000);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Unable to reach DocDaisy.");
}

// ---------- Component ----------
const DocDaisy: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "bot",
      text: t("Hello! I'm DocDaisy, your AI Assistant. Please describe your main symptom so I can ask a few follow-up questions."),
    },
  ]);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // State to hold the AI's final recommended specialization
  const [recommendedSpecialization, setRecommendedSpecialization] = useState<
    string | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      if (first.sender !== "bot") return prev;
      const updatedText = t(
        "Hello! I'm DocDaisy, your AI Assistant. Please describe your main symptom so I can ask a few follow-up questions."
      );
      if (first.text === updatedText) return prev;
      return [{ ...first, text: updatedText }, ...rest];
    });
  }, [t]);

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const recommendedLabel = recommendedSpecialization
    ? getSpecializationLabel(recommendedSpecialization)
    : "";

  const handleReevaluation = () => {
    setRecommendedSpecialization(null);
    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        text:
          "Okay, let's reassess together. Share any changes or add more details so I can refine the recommendation.",
      },
    ]);
  };

  const isValidInput = (value: string) => value.trim().length > 0;

  const sendMessage = async () => {
    if (isLoading) return;
    if (!isValidInput(input)) {
      setInputError(
        "Please enter a message so I can help."
      );
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I didn't quite catch that. Please share a bit more detail so I can help.",
        },
      ]);
      return;
    }

    const userInput = input.trim();
    const newUserMessage: ChatMessage = { sender: "user", text: userInput };
    const updatedConversation = [...messages, newUserMessage];
    setMessages(updatedConversation);

    setInput("");
    setInputError("");
    setIsLoading(true);
    setRecommendedSpecialization(null);

    try {
      const userTurns = updatedConversation.filter(
        (msg) => msg.sender === "user"
      ).length;
      const shouldConclude = userTurns >= 3;

      let finalBotReply = "";
      let specialization: string | null | undefined = null;

      if (shouldConclude) {
        const { reply, specialization: spec } = await askDocDaisyWithRetry(
          "conclusion",
          updatedConversation
        );
        finalBotReply = reply;
        specialization = spec;
      } else {
        const { reply } = await askDocDaisyWithRetry(
          "followup",
          updatedConversation
        );
        finalBotReply = reply;
      }

      setMessages((prev) => [...prev, { sender: "bot", text: finalBotReply }]);

      if (specialization && specialization !== "Unsure") {
        const safeSpecialization = resolveSpecializationId(specialization);
        setRecommendedSpecialization(safeSpecialization);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("DocDaisy Error:", err);
      const isMissingPayload = message.includes("docdaisy_missing_payload");
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: isMissingPayload
            ? "I couldn't receive your message on the server. Please refresh and try again. If this persists, the deployment may be dropping the request body."
            : "Sorry, I’m having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchClick = () => {
    if (recommendedSpecialization) {
      navigate(
        `/clinics?specialization=${encodeURIComponent(
          recommendedSpecialization
        )}`
      );
    }
  };

  return (
    <PageScaffold contentClassName="pb-0">
      <div className="flex flex-1 flex-col">
        <header className="bg-[#3A12DB] text-white py-4 px-4 font-extrabold text-xl flex items-center lg:px-10 lg:rounded-t-3xl lg:shadow-md">
          <button
            onClick={() => navigate("/home")}
            className="mr-3 p-1 rounded-full hover:bg-[#2A0F9D] transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-2xl mr-2">🌼</span> DocDaisy AI Assistant
        </header>

        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[2.3fr_0.7fr]">
          {/* Chat section */}
          <section className="flex flex-col bg-gray-50">
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

              {isLoading && (
                <div className="flex justify-start">
                  <div className="p-3 bg-white text-gray-500 border border-gray-200 rounded-xl rounded-tl-sm flex items-center shadow-md">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    DocDaisy is typing...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-white space-y-3">
              {recommendedSpecialization && (
                <div className="p-3 bg-[#E5DEFF] rounded-xl border border-[#3A12DB] shadow-lg">
                  <p className="text-sm font-semibold text-[#002D55] mb-3">
                    Assessment complete. We recommend a specialist in
                    <strong className="font-extrabold text-[#3A12DB] ml-1">
                      {recommendedLabel}
                    </strong>
                    .
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-col sm:flex-row gap-2 flex-1">
                      <button
                        onClick={handleSearchClick}
                        className="flex-1 bg-[#3A12DB] text-white text-base font-bold py-3 rounded-lg shadow-[0_4px_10px_0_rgba(58,18,219,0.3)] hover:bg-[#2A0F9D] transition-colors flex items-center justify-center"
                      >
                        <Send className="w-5 h-5 mr-2" />
                        Search clinics for {recommendedLabel}
                      </button>
                      <button
                        onClick={handleReevaluation}
                        className="flex-1 border border-[#3A12DB] text-[#3A12DB] text-base font-semibold py-3 rounded-lg hover:bg-[#F2EEFF] transition-colors"
                      >
                        Re-evaluate with DocDaisy
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 text-center">
                      You can continue chatting for clarifications.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) setInputError("");
                  }}
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
              {inputError && (
                <p className="text-sm text-red-500">{inputError}</p>
              )}
            </div>
          </section>

          {/* Side panel */}
          <aside className="hidden lg:flex flex-col gap-6 border-l border-indigo-100 bg-indigo-50/40 p-8">
            <div className="rounded-2xl bg-white shadow-sm p-6">
              <p className="text-xs uppercase tracking-wide text-[#3A12DB] font-semibold">
                Assessment status
              </p>
              {recommendedSpecialization ? (
                <>
                  <p className="text-base text-slate-700 mt-3">
                    DocDaisy recommends consulting a{" "}
                    <span className="font-semibold">
                      {recommendedLabel}
                    </span>{" "}
                    based on your inputs.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <button
                      onClick={handleSearchClick}
                      className="w-full rounded-xl bg-[#3A12DB] py-3 text-sm font-semibold text-white shadow-md hover:bg-[#2A0F9D]"
                    >
                      Open search
                    </button>
                    <button
                      onClick={handleReevaluation}
                      className="w-full rounded-xl border border-[#3A12DB] py-3 text-sm font-semibold text-[#3A12DB] hover:bg-[#F2EEFF]"
                    >
                      Request re-evaluation
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600 mt-3">
                  Share a few more details and we'll surface the perfect
                  specialization for you.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/60 p-6 text-sm text-slate-600">
              <p className="font-semibold text-slate-700 mb-2">
                Conversation tips
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Mention duration and intensity of symptoms.</li>
                <li>Call out recent travel or medication changes.</li>
                <li>Include any existing diagnoses for better context.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </PageScaffold>
  );
};

export default DocDaisy;
