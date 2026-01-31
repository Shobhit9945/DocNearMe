import { Router } from "express";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

const router = Router();
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

const buildConversationTranscript = (messages: ChatMessage[]) =>
  messages
    .map((msg) => `${msg.sender === "user" ? "User" : "DocDaisy"}: ${msg.text}`)
    .join("\n");

const callOpenAI = async (body: Record<string, unknown>) => {
  const apiKey = process.env.OPENAI;
  if (!apiKey) {
    throw new Error("Missing OPENAI environment variable");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
  const choices = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices;
  return choices?.[0]?.message?.content?.trim?.() ?? "";
};

router.post("/respond", async (req, res) => {
  const { mode, messages } = req.body as {
    mode?: "followup" | "conclusion";
    messages?: ChatMessage[];
  };

  if (!mode || (mode !== "followup" && mode !== "conclusion")) {
    return res.status(400).json({ error: "Invalid mode supplied" });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Conversation history is required" });
  }

  if (!process.env.OPENAI) {
    return res.status(500).json({ error: "DocDaisy AI is not configured." });
  }

  try {
    const conversation = buildConversationTranscript(messages);

    if (mode === "followup") {
      const payload = {
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are DocDaisy, a warm and concise AI nurse who collects the most relevant symptom details before escalating to a specialist recommendation. Ask only one short follow-up question at a time and keep it under 35 words. Respond using plain text only.",
          },
          {
            role: "user",
            content: `Conversation so far:\n${conversation}\n\nAsk the next clarifying question.`,
          },
        ],
        stream: false,
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
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are DocDaisy, a medical triage assistant. Review the conversation and return a JSON object with a short summary and the single best specialization. If unsure, set specialization to Unsure.",
        },
        {
          role: "user",
          content: `Conversation history:\n${conversation}\n\nReturn only the JSON object conforming to the schema.`,
        },
      ],
      stream: false,
    };

    const completion = await callOpenAI(payload);
    const rawContent = extractOpenAIText(completion);

    if (typeof rawContent !== "string") {
      throw new Error("Unexpected OpenAI response format");
    }

    const parsed = JSON.parse(rawContent);

    return res.json({ reply: parsed.summary, specialization: parsed.specialization });
  } catch (error) {
    console.error("DocDaisy OpenAI error", error);
    return res.status(500).json({ error: "Unable to reach DocDaisy right now. Please try again." });
  }
});

export default router;
