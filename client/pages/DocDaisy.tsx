import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, ChevronLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageScaffold } from "@/components/PageScaffold";
import { useTranslation } from "@/lib/i18n";
import { getSpecializationLabel, resolveSpecializationId } from "@/lib/specializations";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};

type Mode = "followup" | "conclusion";

type DocDaisyResponse = {
  reply: string;
  specialization?: string | null;
  relevant?: boolean;
  mode?: Mode;
  readyToConclude?: boolean;
  emergency?: boolean;
  emergencyMessage?: string | null;
  coveredFields?: string[];
  queryType?: string;
  suggestedClinic?: string | null;
  suggestedClinicId?: string | null;
};

const STORAGE_KEY = "docnearme_docdaisy_session";

const INTAKE_LABELS: [string, string][] = [
  ["duration", "Duration"],
  ["severity", "Severity"],
  ["associated", "Related symptoms"],
  ["redflags", "Red flags"],
  ["triggers", "Triggers"],
  ["medications", "Medications"],
];

// ---------- Helpers ----------
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const encodeHeaderValue = (value: string) => {
  if (!value) return "";
  try {
    return window.btoa(unescape(encodeURIComponent(value)));
  } catch {
    return "";
  }
};

// Call DocDaisy via the backend (single consolidated AI call)
async function askDocDaisyWithRetry(
  mode: Mode,
  conversation: ChatMessage[],
  coveredFields: string[],
  readyToConclude: boolean,
  retries = 3
): Promise<DocDaisyResponse> {
  let lastError: Error | null = null;
  const lastUserMessage =
    [...conversation].reverse().find((msg) => msg.sender === "user")?.text ?? "";
  const conversationHeader = (() => {
    try {
      const serialized = JSON.stringify(conversation);
      if (serialized.length <= 6000) return serialized;
      return "";
    } catch {
      return "";
    }
  })();

  const encodedMessage = encodeHeaderValue(lastUserMessage);
  const encodedConversation = conversationHeader ? encodeHeaderValue(conversationHeader) : "";

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("/api/docdaisy/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-docdaisy-mode": mode,
          ...(encodedMessage ? { "x-docdaisy-message-b64": encodedMessage } : {}),
          ...(encodedConversation ? { "x-docdaisy-conversation-b64": encodedConversation } : {}),
        },
        cache: "no-store",
        body: JSON.stringify({
          mode,
          messages: conversation,
          conversationHistory: conversation,
          history: conversation,
          message: lastUserMessage,
          coveredFields,
          readyToConclude,
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

      return {
        reply: content,
        specialization: data?.specialization ?? null,
        relevant: data?.relevant ?? true,
        mode: data?.mode ?? mode,
        readyToConclude: data?.readyToConclude ?? false,
        emergency: data?.emergency ?? false,
        emergencyMessage: data?.emergencyMessage ?? null,
        coveredFields: data?.coveredFields ?? coveredFields,
        queryType: data?.queryType ?? "symptom",
        suggestedClinic: data?.suggestedClinic ?? null,
        suggestedClinicId: data?.suggestedClinicId ?? null,
      };
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

  const defaultGreeting = t(
    "Hello! I'm DocDaisy, your AI health navigator. Describe your symptoms, or ask me about clinics and doctors in our network.\n\n\u26a0\ufe0f Note: I'm an AI assistant \u2014 my responses don't replace professional medical advice."
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: defaultGreeting },
  ]);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // AI-driven state (replaces fixed turn counting)
  const [coveredFields, setCoveredFields] = useState<string[]>([]);
  const [readyToConclude, setReadyToConclude] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);

  // Specialization recommendation state
  const [recommendedSpecialization, setRecommendedSpecialization] = useState<string | null>(null);
  const [lastConclusionReply, setLastConclusionReply] = useState<string | null>(null);
  const [lastConclusionUnavailable, setLastConclusionUnavailable] = useState(false);
  const [suggestedClinic, setSuggestedClinic] = useState<string | null>(null);
  const [suggestedClinicId, setSuggestedClinicId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Restore conversation from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (Array.isArray(session.messages) && session.messages.length > 1) {
          setMessages(session.messages);
          setCoveredFields(session.coveredFields ?? []);
          setReadyToConclude(session.readyToConclude ?? false);
          if (session.recommendedSpecialization) {
            setRecommendedSpecialization(session.recommendedSpecialization);
          }
          if (session.suggestedClinic) setSuggestedClinic(session.suggestedClinic);
          if (session.suggestedClinicId) setSuggestedClinicId(session.suggestedClinicId);
        }
      }
    } catch { /* ignore corrupt storage */ }
  }, []);

  // Update greeting text when language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      if (first.sender !== "bot") return prev;
      const updatedText = t(
        "Hello! I'm DocDaisy, your AI health navigator. Describe your symptoms, or ask me about clinics and doctors in our network.\n\n\u26a0\ufe0f Note: I'm an AI assistant \u2014 my responses don't replace professional medical advice."
      );
      if (first.text === updatedText) return prev;
      return [{ ...first, text: updatedText }, ...rest];
    });
  }, [t]);

  useEffect(() => {
    const token = localStorage.getItem("docnearme_patient_token");
    setIsAuthenticated(Boolean(token));
  }, []);

  // Persist conversation to localStorage
  useEffect(() => {
    if (messages.length > 1) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            messages,
            coveredFields,
            readyToConclude,
            recommendedSpecialization,
            suggestedClinic,
            suggestedClinicId,
          })
        );
      } catch { /* storage full — non-critical */ }
    }
  }, [messages, coveredFields, readyToConclude, recommendedSpecialization, suggestedClinic, suggestedClinicId]);

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const recommendedLabel = recommendedSpecialization
    ? getSpecializationLabel(recommendedSpecialization)
    : "";

  const handleReevaluation = () => {
    setRecommendedSpecialization(null);
    setLastConclusionReply(null);
    setLastConclusionUnavailable(false);
    setCoveredFields([]);
    setReadyToConclude(false);
    setEmergency(false);
    setEmergencyMessage(null);
    setSuggestedClinic(null);
    setSuggestedClinicId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        text: "Okay, let's start fresh. Describe your symptoms or ask about clinics and doctors.",
      },
    ]);
  };

  const isValidInput = (value: string) => value.trim().length > 0;

  const sendMessage = async () => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/patient-auth");
      return;
    }
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
    setLastConclusionReply(null);
    setLastConclusionUnavailable(false);
    setSuggestedClinic(null);
    setSuggestedClinicId(null);

    try {
      // Use AI-determined readyToConclude instead of fixed turn count
      const mode: Mode = readyToConclude ? "conclusion" : "followup";

      const response = await askDocDaisyWithRetry(
        mode,
        updatedConversation,
        coveredFields,
        readyToConclude
      );

      // Update AI-driven state
      if (response.coveredFields) setCoveredFields(response.coveredFields);
      if (response.readyToConclude !== undefined) setReadyToConclude(response.readyToConclude);

      // Handle emergency detection
      if (response.emergency) {
        setEmergency(true);
        setEmergencyMessage(response.emergencyMessage ?? null);
      } else {
        setEmergency(false);
        setEmergencyMessage(null);
      }

      setMessages((prev) => [...prev, { sender: "bot", text: response.reply }]);

      // Handle conclusion with specialization
      if (mode === "conclusion" || response.mode === "conclusion") {
        setLastConclusionReply(response.reply);
        const spec = response.specialization;
        setLastConclusionUnavailable(spec === "Unsure");
        if (response.suggestedClinic) setSuggestedClinic(response.suggestedClinic);
        if (response.suggestedClinicId) setSuggestedClinicId(response.suggestedClinicId);

        if (spec && spec !== "Unsure") {
          const safeSpecialization = resolveSpecializationId(spec);
          setRecommendedSpecialization(safeSpecialization);
        }
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
    <PageScaffold contentClassName="pb-0 lg:pr-0">
      <div className="flex flex-1 flex-col min-h-0">
        <header className="w-full bg-[#3A12DB] text-white py-2 px-4 font-extrabold text-xl flex items-center lg:px-10 lg:rounded-t-3xl lg:shadow-md">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="mr-2 p-0.5 rounded-full hover:bg-[#2A0F9D] transition-colors"
            aria-label={t("Back to home")}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <img
            src="/docdaisy.png"
            alt="DocDaisy"
            className="mr-2 h-14 w-14 object-contain sm:h-20 sm:w-20 lg:h-20 lg:w-20"
          />
          DocDaisy AI
        </header>

        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[2.3fr_0.7fr] min-h-0">
          {/* Chat section */}
          <section className="flex flex-col bg-gray-50 min-h-0">
            {!isAuthenticated ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {t("Sign in to use DocDaisy")}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("Create an account or sign in to start your DocDaisy consultation.")}
                  </p>
                  <button
                    onClick={() => navigate("/patient-auth")}
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-[#3A12DB] px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#2A0F9D]"
                  >
                    {t("Sign in to continue")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-6 pb-2 sm:p-6 sm:space-y-5">
                  {/* Emergency alert */}
                  {emergency && emergencyMessage && (
                    <div className="p-4 bg-red-50 border-2 border-red-400 rounded-xl">
                      <p className="text-red-700 font-bold text-sm flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        Emergency Alert
                      </p>
                      <p className="text-red-600 text-sm mt-1">{emergencyMessage}</p>
                    </div>
                  )}

                  <div role="log" aria-live="polite" aria-label={t("Conversation messages")} className="space-y-4">
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
                  </div>

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

                <div className="p-4 border-t border-gray-200 bg-white space-y-3 pb-safe">
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
                          {suggestedClinic && suggestedClinicId && (
                            <button
                              onClick={() => navigate(`/clinics/${suggestedClinicId}`)}
                              className="flex-1 bg-emerald-600 text-white text-base font-bold py-3 rounded-lg shadow-md hover:bg-emerald-700 transition-colors"
                            >
                              View {suggestedClinic}
                            </button>
                          )}
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
                  {!recommendedSpecialization && lastConclusionReply && (
                    <div className="p-3 bg-[#F4F4FF] rounded-xl border border-[#B9A8FF] shadow-sm">
                      <p className="text-sm text-[#2B215A] font-semibold mb-2">Assessment summary</p>
                      <p className="text-sm text-slate-700">{lastConclusionReply}</p>
                      {lastConclusionUnavailable && (
                        <p className="text-xs text-slate-500 mt-2">
                          A clinic offering this specialization isn’t currently available in the app.
                        </p>
                      )}
                      <button
                        onClick={handleReevaluation}
                        className="mt-3 inline-flex items-center justify-center rounded-lg border border-[#3A12DB] px-3 py-2 text-sm font-semibold text-[#3A12DB] hover:bg-[#F2EEFF]"
                      >
                        Re-evaluate with DocDaisy
                      </button>
                    </div>
                  )}

                  {/* Intake progress indicator */}
                  {coveredFields.length > 0 && !recommendedSpecialization && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">Progress:</span>
                      {INTAKE_LABELS.map(([key, label]) => (
                        <span
                          key={key}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full transition-colors",
                            coveredFields.includes(key)
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-400"
                          )}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <label htmlFor="docdaisy-message" className="sr-only">
                      {t("Message DocDaisy")}
                    </label>
                    <input
                      id="docdaisy-message"
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        if (inputError) setInputError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      className="flex-1 border border-gray-300 focus:border-[#3A12DB] rounded-xl px-4 py-3 text-[16px] leading-6 text-gray-700 outline-none transition-all duration-200"
                      placeholder="Ask DocDaisy a question..."
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={isLoading || !input.trim()}
                      className="bg-[#3A12DB] hover:bg-[#2A0F9D] text-white p-3 rounded-xl shadow-md transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Send Message"
                      aria-label={t("Send message")}
                    >
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                  {inputError && (
                    <p className="text-sm text-red-500">{inputError}</p>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Side panel */}
          <aside className="hidden lg:flex flex-col gap-6 border-l border-indigo-100 bg-indigo-50/40 p-8">
            {!isAuthenticated ? (
              <div className="rounded-2xl bg-white shadow-sm p-6 text-center">
                <p className="text-sm font-semibold text-slate-900">{t("Sign in to use DocDaisy")}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {t("Create an account or sign in to start your DocDaisy consultation.")}
                </p>
                <button
                  onClick={() => navigate("/patient-auth")}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-[#3A12DB] px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-[#2A0F9D]"
                >
                  {t("Sign in to continue")}
                </button>
              </div>
            ) : (
              <>
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
                    <>
                      <p className="text-sm text-slate-600 mt-3">
                        Share a few more details and we'll surface the perfect
                        specialization for you.
                      </p>
                      {coveredFields.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {INTAKE_LABELS.map(([key, label]) => (
                            <span
                              key={key}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                coveredFields.includes(key)
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-400"
                              )}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
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
                    <li>Ask about specific clinics or nearest specialists.</li>
                  </ul>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </PageScaffold>
  );
};

export default DocDaisy;
