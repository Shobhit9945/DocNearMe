import { Router } from "express";

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
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com")
  .replace(/\/$/, "");
const DOCDAISY_SPECIALIZATIONS = [
  "General Physician",
  "Internal Medicine",
  "Cardiologist",
  "Dermatologist",
  "Pediatrician",
  "Orthopedic Surgeon",
  "Gastroenterology",
  "Neurology",
  "Psychiatry",
  "Psychology",
  "Ophthalmology",
  "Endocrinology",
  "Oncology",
  "Pulmonology",
  "Rheumatology",
  "Allergy & Immunology",
  "Nephrology",
  "ENT",
  "Gynecology",
  "Obstetrics",
  "Urology",
  "Sports Medicine",
  "Physical Therapy",
];

const getOpenAIKey = () => process.env.OPENAI_API_KEY ?? process.env.OPENAI;

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
          return trimmed ? [{ sender: "user" as const, text: trimmed }] : [];
        }
        const coerced = coerceMessage(entry);
        return coerced ? [coerced] : [];
      })
      .filter(Boolean) as ChatMessage[];
  }

  if (value && typeof value === "object") {
    const single = coerceMessage(value);
    return single ? [single] : [];
  }

  const parsed = parseMaybeJson<unknown>(value);
  if (parsed !== undefined) {
    return normalizeMessages(parsed);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [{ sender: "user", text: value.trim() }];
  }

  return [];
};

const callOpenAI = async (body: Record<string, unknown>) => {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or OPENAI environment variable");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/v1/responses`, {
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

const extractOpenAIText = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof response.output_text === "string") {
    return response.output_text.trim();
  }
  const parts = response.output?.flatMap((item) => item.content ?? []) ?? [];
  return parts.map((part) => part.text ?? "").join("").trim();
};

const isInAppSpecialization = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return DOCDAISY_SPECIALIZATIONS.some((spec) => spec.toLowerCase() === normalized);
};

router.post("/respond", async (req, res) => {
  const rawBody = parseRawBody(req.body);
  const rawMode = rawBody?.mode as "followup" | "conclusion" | undefined;
  const rawMessages =
    rawBody?.messages ??
    rawBody?.conversation ??
    rawBody?.history ??
    rawBody?.conversationHistory ??
    (Array.isArray(rawBody) ? rawBody : undefined);
  const fallbackText =
    typeof rawBody?.message === "string"
      ? rawBody.message
      : typeof rawBody?.text === "string"
        ? rawBody.text
        : typeof rawBody?.content === "string"
          ? rawBody.content
        : undefined;

  const normalizedMessages = normalizeMessages(rawMessages);
  const messages =
    normalizedMessages.length > 0
      ? normalizedMessages
      : fallbackText
        ? [{ sender: "user", text: fallbackText }]
        : [];
  const userTurns = messages.filter((msg) => msg.sender === "user").length;
  const inferredMode = userTurns >= 3 ? "conclusion" : "followup";
  const mode = rawMode ?? inferredMode;

  if (!mode || (mode !== "followup" && mode !== "conclusion")) {
    return res.status(400).json({ error: "Invalid mode supplied" });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.json({
      reply:
        "Hello! I'm DocDaisy, your medical navigator. Please describe your main symptom so I can ask a few quick follow-up questions.",
      specialization: null,
    });
  }

  if (!getOpenAIKey()) {
    return res.status(500).json({
      error: "DocDaisy AI is not configured.",
      detail: "Missing OPENAI_API_KEY or OPENAI environment variable.",
    });
  }

  try {
    const conversation = buildConversationTranscript(messages);

    if (mode === "followup") {
      const payload = {
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text:
                  "You are DocDaisy, a warm and concise medical navigator who collects the most relevant symptom details before escalating to a specialist recommendation. Ask only one short follow-up question at a time and keep it under 35 words. Stay aligned with in-app specializations when you later recommend. Respond using plain text only.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Conversation so far:\n${conversation}\n\nAvailable specializations in the app:\n${DOCDAISY_SPECIALIZATIONS.join(
                  ", "
                )}\n\nAsk the next clarifying question.`,
              },
            ],
          },
        ],
        temperature: 0.2,
      };

      const completion = await callOpenAI(payload);
      const reply =
        extractOpenAIText(completion) || "I couldn't generate a response. Please try again.";

      return res.json({ reply: typeof reply === "string" ? reply.trim() : reply });
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
      input: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
                "You are DocDaisy, a medical navigator. Review the conversation and return a JSON object with a short summary and the single best specialization. Choose from the in-app list when possible. If no in-app specialization fits, set specialization to Unsure and clearly say which specialization is needed but not available in the app.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Conversation history:\n${conversation}\n\nAvailable specializations in the app:\n${DOCDAISY_SPECIALIZATIONS.join(
                ", "
              )}\n\nReturn only the JSON object conforming to the schema.`,
            },
          ],
        },
      ],
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          strict: true,
        },
      },
    };

    const completion = await callOpenAI(payload);
    const rawContent = extractOpenAIText(completion);

    if (typeof rawContent !== "string") {
      throw new Error("Unexpected OpenAI response format");
    }

    const parsed = JSON.parse(rawContent);

    const specialization = String(parsed.specialization ?? "").trim();
    const summary = String(parsed.summary ?? "").trim();
    if (specialization && specialization !== "Unsure" && !isInAppSpecialization(specialization)) {
      return res.json({
        reply: `${summary} The recommended specialization is ${specialization}, which is not currently available in the app.`,
        specialization: "Unsure",
      });
    }

    return res.json({ reply: summary, specialization });
  } catch (error) {
    console.error("DocDaisy OpenAI error", error);
    return res.status(500).json({ error: "Unable to reach DocDaisy right now. Please try again." });
  }
});

export default router;
