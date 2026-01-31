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

  const response = await fetch("https://api.openai.com/v1/responses", {
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
        input: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text:
                  "You are DocDaisy, a warm and concise medical navigator who collects the most relevant symptom details before escalating to a specialist recommendation. Ask only one short follow-up question at a time and keep it under 35 words. Respond using plain text only.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Conversation so far:\n${conversation}\n\nAsk the next clarifying question.`,
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
                "You are DocDaisy, a medical navigator. Review the conversation and return a JSON object with a short summary and the single best specialization. If unsure, set specialization to Unsure.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Conversation history:\n${conversation}\n\nReturn only the JSON object conforming to the schema.`,
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

    return res.json({ reply: parsed.summary, specialization: parsed.specialization });
  } catch (error) {
    console.error("DocDaisy OpenAI error", error);
    return res.status(500).json({ error: "Unable to reach DocDaisy right now. Please try again." });
  }
});

export default router;
