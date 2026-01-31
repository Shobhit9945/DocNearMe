import { Router } from "express";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

const router = Router();
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

const buildConversationTranscript = (messages: ChatMessage[]) =>
  messages
    .map((msg) => `${msg.sender === "user" ? "User" : "DocDaisy"}: ${msg.text}`)
    .join("\n");

const callGemini = async (body: Record<string, unknown>) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorPayload}`);
  }

  return response.json();
};

const extractGeminiText = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!parts) return "";
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

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "DocDaisy AI is not configured." });
  }

  try {
    const conversation = buildConversationTranscript(messages);

    if (mode === "followup") {
      const payload = {
        systemInstruction: {
          role: "system",
          parts: [
            {
              text:
                "You are DocDaisy, a warm and concise AI nurse who collects the most relevant symptom details before escalating to a specialist recommendation. Ask only one short follow-up question at a time and keep it under 35 words. Respond using plain text only.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Conversation so far:\n${conversation}\n\nAsk the next clarifying question.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      };

      const completion = await callGemini(payload);
      const reply =
        extractGeminiText(completion) || "I couldn't generate a response. Please try again.";

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
      systemInstruction: {
        role: "system",
        parts: [
          {
            text:
              "You are DocDaisy, a medical triage assistant. Review the conversation and return a JSON object with a short summary and the single best specialization. If unsure, set specialization to Unsure.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Conversation history:\n${conversation}\n\nReturn only the JSON object conforming to the schema.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: schema.schema,
      },
    };

    const completion = await callGemini(payload);
    const rawContent = extractGeminiText(completion);

    if (typeof rawContent !== "string") {
      throw new Error("Unexpected Gemini response format");
    }

    const parsed = JSON.parse(rawContent);

    return res.json({ reply: parsed.summary, specialization: parsed.specialization });
  } catch (error) {
    console.error("DocDaisy Gemini error", error);
    return res.status(500).json({ error: "Unable to reach DocDaisy right now. Please try again." });
  }
});

export default router;
