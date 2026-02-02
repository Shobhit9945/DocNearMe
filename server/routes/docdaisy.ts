import { Router } from "express";
import { getClinicDoctorsCollection } from "../db";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

type MessageLike = {
  sender?: string;
  role?: string;
  author?: string;
  text?: string;
  content?: string;
  message?: string;
};

const router = Router();
// Default to a widely available model; allow override via env
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com")
  .replace(/\/$/, "");

const getOpenAIKey = () => process.env.OPENAI_API_KEY;

const buildConversationTranscript = (messages: ChatMessage[]) =>
  messages
    .map((msg) => `${msg.sender === "user" ? "User" : "DocDaisy"}: ${msg.text}`)
    .join("\n");

const parseMaybeJson = <T,>(value: unknown): T | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const parseRawBody = (value: unknown) => {
  if (typeof value === "string") {
    const parsed = parseMaybeJson<unknown>(value);
    if (parsed !== undefined) {
      return parsed;
    }
    return { message: value };
  }

  return value;
};

const isValidUserText = (value: string) => value.trim().length > 0;

const coerceMessage = (value: unknown): ChatMessage | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as MessageLike;
  const rawSender =
    typeof record.sender === "string"
      ? record.sender
      : typeof record.role === "string"
        ? record.role
        : typeof record.author === "string"
          ? record.author
          : undefined;
  const normalizedSender = rawSender?.trim().toLowerCase();
  const sender: ChatMessage["sender"] | null =
    normalizedSender === "user"
      ? "user"
      : normalizedSender === "assistant" ||
          normalizedSender === "bot" ||
          normalizedSender === "docdaisy"
        ? "bot"
        : null;
  const text =
    typeof record.text === "string"
      ? record.text
      : typeof record.content === "string"
        ? record.content
        : typeof record.message === "string"
          ? record.message
          : undefined;

  if (!sender || typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  return { sender, text: text.trim() };
};

const normalizeMessages = (value: unknown): ChatMessage[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (!trimmed || !isValidUserText(trimmed)) return [];
          return [{ sender: "user" as const, text: trimmed }];
        }
        const coerced = coerceMessage(entry);
        if (!coerced) return [];
        if (coerced.sender === "user" && !isValidUserText(coerced.text)) return [];
        return [coerced];
      })
      .filter(Boolean) as ChatMessage[];
  }

  if (value && typeof value === "object") {
    const single = coerceMessage(value);
    if (!single) return [];
    if (single.sender === "user" && !isValidUserText(single.text)) return [];
    return [single];
  }

  const parsed = parseMaybeJson<unknown>(value);
  if (parsed !== undefined) {
    return normalizeMessages(parsed);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    if (!isValidUserText(trimmed)) return [];
    return [{ sender: "user", text: trimmed }];
  }

  return [];
};

const callOpenAI = async (body: Record<string, unknown>) => {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or OPENAI environment variable");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorPayload}`);
  }

  return response.json();
};

const checkReplyRelevance = async (question: string, reply: string) => {
  const payload = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a medical intake relevance checker. Decide whether the user reply answers the last question or provides clinically relevant context. Accept multi-part answers (e.g., duration + cause) and synonyms. Only mark irrelevant if it does not answer the question or add symptom context. If irrelevant, request a concise clarification. Return JSON only.",
      },
      {
        role: "user" as const,
        content: `Last question: ${question}\nUser reply: ${reply}\n\nReturn JSON: {"relevant": boolean, "redirect": string}`,
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" as const },
  };

  const completion = await callOpenAI(payload);
  const rawContent = extractOpenAIText(completion);
  if (typeof rawContent !== "string") {
    return { relevant: true, redirect: "" };
  }

  try {
    const parsed = JSON.parse(rawContent) as { relevant?: boolean; redirect?: string };
    return {
      relevant: Boolean(parsed?.relevant ?? true),
      redirect: typeof parsed?.redirect === "string" ? parsed.redirect.trim() : "",
    };
  } catch {
    return { relevant: true, redirect: "" };
  }
};

const extractOpenAIText = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";

  const response = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };

  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return typeof part.text === "string" ? part.text : "";
      })
      .join("")
      .trim();
  }

  return "";
};

const isInAppSpecialization = (value: string, available: string[]) => {
  const normalized = value.trim().toLowerCase();
  return available.some((spec) => spec.toLowerCase() === normalized);
};

const detectResponseLanguage = async (text: string) => {
  const sample = text.trim();
  if (!sample) return "English";

  const payload = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a language detector. Identify the primary language of the user's message, even if it's romanized (e.g., Hindi in Latin script). Return JSON only.",
      },
      {
        role: "user" as const,
        content: `Message:\n${sample}\n\nReturn JSON: {"language":"<English name>","iso":"<ISO 639-1 or 639-3>"}`,
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" as const },
  };

  try {
    const completion = await callOpenAI(payload);
    const rawContent = extractOpenAIText(completion);
    if (typeof rawContent !== "string") return "English";
    const parsed = JSON.parse(rawContent) as { language?: string };
    return (parsed?.language || "English").trim() || "English";
  } catch (error) {
    console.warn("[DocDaisy] Language detection failed, defaulting to English.", error);
    return "English";
  }
};

const getAvailableSpecializations = async () => {
  try {
    const clinicDoctorsCollection = await getClinicDoctorsCollection();
    const clinicDoctors = await clinicDoctorsCollection.find({}).toArray();

    const collected = new Set<string>();
    clinicDoctors.forEach((doctor: any) => {
      const specialization = typeof doctor.specialization === "string" ? doctor.specialization.trim() : "";
      if (specialization) collected.add(specialization);
    });

    return Array.from(collected).sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.warn("[DocDaisy] Failed to load doctor specializations.", error);
    return [];
  }
};

router.post("/respond", async (req, res) => {
  const rawBody = parseRawBody(req.body) as any;
  const payload = parseRawBody(rawBody?.body ?? rawBody?.data ?? rawBody) as any;
  const headerMode = req.header("x-docdaisy-mode")?.toLowerCase();
  const headerConversation = req.header("x-docdaisy-conversation");
  const headerMessage = req.header("x-docdaisy-message");
  const headerConversationB64 = req.header("x-docdaisy-conversation-b64");
  const headerMessageB64 = req.header("x-docdaisy-message-b64");
  const decodeHeader = (value?: string) => {
    if (!value) return undefined;
    try {
      return Buffer.from(value, "base64").toString("utf8");
    } catch {
      return undefined;
    }
  };
  const rawMode =
    (payload?.mode as "followup" | "conclusion" | undefined) ??
    (headerMode === "followup" || headerMode === "conclusion"
      ? (headerMode as "followup" | "conclusion")
      : undefined);
  const decodedConversation = decodeHeader(headerConversationB64) ?? headerConversation;
  const decodedMessage = decodeHeader(headerMessageB64) ?? headerMessage;
  const rawMessages =
    payload?.messages ??
    payload?.conversation ??
    payload?.history ??
    payload?.conversationHistory ??
    (decodedConversation ? parseMaybeJson<unknown>(decodedConversation) : undefined) ??
    (Array.isArray(payload) ? payload : undefined);
  const fallbackText =
    typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.text === "string"
        ? payload.text
        : typeof payload?.content === "string"
          ? payload.content
          : typeof decodedMessage === "string" && decodedMessage.trim().length > 0
            ? decodedMessage
            : undefined;

  const normalizedMessages = normalizeMessages(rawMessages);
  const messages: ChatMessage[] =
    normalizedMessages.length > 0
      ? normalizedMessages
      : fallbackText
        ? [{ sender: "user", text: String(fallbackText) }]
        : [];
  const lastUserText = [...messages]
    .reverse()
    .find((msg) => msg.sender === "user")?.text;
  const lastBotText = [...messages]
    .reverse()
    .find((msg) => msg.sender === "bot")?.text;

  let isRelevant = true;
  if (lastUserText && lastBotText) {
    const relevance = await checkReplyRelevance(lastBotText, lastUserText);
    isRelevant = relevance.relevant;
    if (!relevance.relevant) {
      return res.json({
        reply:
          relevance.redirect ||
          "Please answer the last question with symptom details so I can help.",
        specialization: null,
        relevant: false,
        mode: "followup",
      });
    }
  }

  const userTurns = messages.filter((msg) => msg.sender === "user").length;
  const relevantTurns =
    typeof payload?.relevantTurns === "number" && Number.isFinite(payload.relevantTurns)
      ? Math.max(0, Math.floor(payload.relevantTurns))
      : null;
  const inferredMode =
    relevantTurns !== null
      ? relevantTurns + (isRelevant ? 1 : 0) >= 5
        ? "conclusion"
        : "followup"
      : userTurns >= 5
        ? "conclusion"
        : "followup";
  const mode = rawMode ?? inferredMode;

  if (!mode || (mode !== "followup" && mode !== "conclusion")) {
    return res.status(400).json({ error: "Invalid mode supplied" });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Missing conversation payload.",
      detail: "docdaisy_missing_payload",
      hint: "Ensure the POST body includes messages or message fields and that rewrites preserve the request body.",
    });
  }

  if (!getOpenAIKey()) {
    return res.status(500).json({
      error: "DocDaisy AI is not configured.",
      detail: "Missing OPENAI_API_KEY or OPENAI environment variable.",
    });
  }

  try {
    const availableSpecializations = await getAvailableSpecializations();
    const conversation = buildConversationTranscript(messages);
    const availableSpecializationsLabel =
      availableSpecializations.length > 0
        ? availableSpecializations.join(", ")
        : "None configured";

    const lastUserMessage = [...messages]
      .reverse()
      .find((msg) => msg.sender === "user")?.text ?? "";
    const requiredLanguage = await detectResponseLanguage(lastUserMessage);

    if (mode === "followup") {
      const payload = {
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system" as const,
            content:
              `You are DocDaisy, a warm and concise medical navigator. Ask only one short follow-up question at a time (under 35 words). Be systematic: prioritize duration/onset, severity, key associated symptoms, red-flag symptoms, triggers, and current meds/conditions—ask the next missing item. Keep asking until you have at least 5 user answers. Respond using plain text only. You MUST reply ONLY in ${requiredLanguage} and do not switch languages.`,
          },
          {
            role: "user" as const,
            content: `Conversation so far:\n${conversation}\n\nUser's most recent message (reply only in ${requiredLanguage}):\n${lastUserMessage}\n\nAvailable specializations in the app:\n${availableSpecializationsLabel}\n\nAsk the next clarifying question.`,
          },
        ],
        temperature: 0.2,
      };

      const completion = await callOpenAI(payload);
      const reply =
        extractOpenAIText(completion) || "I couldn't generate a response. Please try again.";

      return res.json({ reply: typeof reply === "string" ? reply.trim() : reply, relevant: true, mode });
    }

    const schema = {
      name: "docdaisy_recommendation",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: {
            type: "string",
            description:
              "A brief conclusion (under 35 words) summarizing the symptoms and the direction for the patient.",
          },
          specialization: {
            type: "string",
            description:
              "The single best medical specialization for the case (e.g. Gastroenterology, Neurology, Orthopedics, Psychiatry).",
          },
        },
        required: ["summary", "specialization"],
      },
    } as const;

      const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system" as const,
          content:
            `You are DocDaisy, a medical navigator. Review the conversation and return a JSON object with a short summary and the single best specialization. Write the summary in second person (e.g., 'Based on what you shared, you have...') and avoid third-person phrasing like 'the user has'. Prefer General Physician or Internal Medicine for common, early, or mild symptoms unless red flags clearly suggest a specialty. Choose from the in-app list when possible. If the list is empty or no in-app specialization fits, set specialization to Unsure and clearly say which specialization is needed but not available in the app. You MUST write the summary ONLY in ${requiredLanguage} and do not switch languages.`,
        },
        {
          role: "user" as const,
          content: `Conversation history:\n${conversation}\n\nUser's most recent message (reply only in ${requiredLanguage}):\n${lastUserMessage}\n\nAvailable specializations in the app:\n${availableSpecializationsLabel}\n\nReturn only the JSON object conforming to the schema.`,
        },
      ],
      temperature: 0.2,
      // json_object format keeps responses parseable while staying compatible with chat completions
      response_format: { type: "json_object" as const },
    };

    const completion = await callOpenAI(payload);
    const rawContent = extractOpenAIText(completion);

    if (typeof rawContent !== "string") {
      throw new Error("Unexpected OpenAI response format");
    }

    const parsed = JSON.parse(rawContent);

    const specialization = String(parsed.specialization ?? "").trim();
    const summary = String(parsed.summary ?? "").trim();
    if (specialization && specialization !== "Unsure" && !isInAppSpecialization(specialization, availableSpecializations)) {
      return res.json({
        reply: `${summary} The recommended specialization is ${specialization}, but a clinic offering that service isn't currently available in the app. Please try elsewhere.`,
        specialization: "Unsure",
        relevant: true,
        mode,
      });
    }

    return res.json({ reply: summary, specialization, relevant: true, mode });
  } catch (error) {
    console.error("DocDaisy OpenAI error", error);
    return res.status(500).json({
      error: "Unable to reach DocDaisy right now. Please try again.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
