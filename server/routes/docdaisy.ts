import { Router } from "express";
import { getClinicDoctorsCollection, getClinicInfoCollection } from "../db";

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

// Intake fields the AI should systematically cover during symptom assessment
const INTAKE_FIELDS = [
  "duration",
  "severity",
  "associated",
  "redflags",
  "triggers",
  "medications",
] as const;

type IntakeField = (typeof INTAKE_FIELDS)[number];

const router = Router();
// Use a stronger model for conclusions where accuracy matters most
const OPENAI_MODEL_FOLLOWUP =
  process.env.OPENAI_MODEL_FOLLOWUP ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const OPENAI_MODEL_CONCLUSION =
  process.env.OPENAI_MODEL_CONCLUSION ?? process.env.OPENAI_MODEL ?? "gpt-4o";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com")
  .replace(/\/$/, "");

const getOpenAIKey = () => process.env.OPENAI_API_KEY;

const SAFETY_DISCLAIMER =
  "I am an AI assistant, not a licensed medical professional. My responses are for informational and navigation purposes only \u2014 they do not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns. In an emergency, call your local emergency number immediately.";

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

const getClinicAndDoctorContext = async () => {
  try {
    const [clinicInfoCol, doctorsCol] = await Promise.all([
      getClinicInfoCollection(),
      getClinicDoctorsCollection(),
    ]);
    const [clinics, doctors] = await Promise.all([
      clinicInfoCol.find({}).toArray(),
      doctorsCol.find({}).toArray(),
    ]);

    const clinicSummaries = (clinics as any[]).map((c) => ({
      name: c.name,
      clinicId: c.clinicId,
      type: c.type,
      location: c.location,
      distance: c.distance,
      specializations: c.specializations,
      rating: c.rating,
      phone: c.phone,
      nextAvailability: c.nextAvailability,
    }));

    const doctorSummaries = (doctors as any[]).map((d) => ({
      name: d.name,
      clinicId: d.clinicId,
      specialization: d.specialization,
      languages: d.languages,
      rating: d.rating,
      nextAvailable: d.nextAvailable,
    }));

    return { clinics: clinicSummaries, doctors: doctorSummaries };
  } catch (error) {
    console.warn("[DocDaisy] Failed to load clinic/doctor data.", error);
    return { clinics: [], doctors: [] };
  }
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  id: "Indonesian",
  my: "Burmese",
  bn: "Bangla",
  ar: "Arabic",
  hi: "Hindi",
  fil: "Filipino",
  th: "Thai",
  zh: "Chinese",
  ko: "Korean",
  "es-MX": "Spanish",
  vi: "Vietnamese",
};

const resolveLanguageName = (code: string): string =>
  LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES.en ?? "English";

const buildFollowupSystemPrompt = (
  availableSpecs: string,
  clinicContext: string,
  coveredFieldsList: string[],
  uiLanguage: string = "en"
) => {
  const langName = resolveLanguageName(uiLanguage);
  const uncoveredFields = INTAKE_FIELDS.filter(
    (f) => !coveredFieldsList.includes(f)
  );
  const uncoveredLabel =
    uncoveredFields.length > 0
      ? `Fields still to ask about: ${uncoveredFields.join(", ")}.`
      : "All key intake fields have been covered.";

  return `You are DocDaisy, a warm, concise, and professional medical navigator AI. You help patients describe symptoms, find the right specialist or clinic, and answer questions about clinics and doctors in the network.

SAFETY: ${SAFETY_DISCLAIMER}

RULES:
1. Ask ONE short follow-up question at a time (under 35 words).
2. Be systematic: cover duration/onset, severity, associated symptoms, red-flag symptoms, triggers, and current medications/conditions. ${uncoveredLabel}
3. You MUST reply in ${langName}. The user's interface language is ${langName} — always match it, even if earlier messages were in a different language.
4. Use plain text only. No markdown, no bullet points.

EMERGENCY DETECTION:
Do NOT trigger an emergency based on a single symptom like "chest pain" or "headache" alone. An emergency requires MULTIPLE concurrent severe indicators described together in the same message, for example:
- Chest pain COMBINED WITH shortness of breath, radiating arm/jaw pain, AND sweating
- Sudden worst-ever headache COMBINED WITH vision loss, confusion, or neck stiffness
- Signs of stroke: facial drooping AND arm weakness AND speech difficulty together
- Heavy uncontrolled bleeding that won't stop
- Loss of consciousness or unresponsiveness
- Severe allergic reaction with throat swelling AND difficulty breathing
- Explicit suicidal intent with a plan
If only one symptom is mentioned (even a serious one), ask follow-up questions first to assess severity before concluding it's an emergency. Set "emergency" to true ONLY when the described combination clearly indicates an immediate life threat. When in doubt, keep asking — do not jump to emergency.

CLINIC / DOCTOR QUERIES:
The user may ask about specific clinics or doctors (e.g., "Does X clinic have a cardiologist?", "Who is the nearest ENT?", "What clinics are near me?"). Use the clinic and doctor data below to answer accurately. If asked about the nearest specialist, reference the distance field. Set "queryType" to "clinic_query" for these questions instead of "symptom".

RELEVANCE:
If the user's last message does not answer your question or provide symptom/clinic context, set "relevant" to false and ask them to clarify.

READY TO CONCLUDE:
After gathering enough information (typically 3-6 exchanges depending on complexity), set "readyToConclude" to true. For simple, clear cases you may conclude sooner. For complex or ambiguous cases, ask more questions.

Available specializations in the app: ${availableSpecs}

Clinic and doctor data:
${clinicContext}

Return a JSON object with this exact schema:
{
  "reply": "<your follow-up question or clinic answer>",
  "relevant": <boolean>,
  "readyToConclude": <boolean>,
  "emergency": <boolean>,
  "emergencyMessage": "<urgent message if emergency, otherwise null>",
  "coveredFields": [<list of intake fields covered so far from: "duration", "severity", "associated", "redflags", "triggers", "medications">],
  "queryType": "<symptom | clinic_query>"
}`;
};

const buildConclusionSystemPrompt = (
  availableSpecs: string,
  clinicContext: string,
  uiLanguage: string = "en"
) => {
  const langName = resolveLanguageName(uiLanguage);
  return `You are DocDaisy, a medical navigator AI. Review the full conversation and provide a conclusion.

SAFETY: ${SAFETY_DISCLAIMER}

RULES:
1. Write the summary in second person (e.g., "Based on what you shared, you have..."). Avoid third-person phrasing.
2. Keep the summary under 50 words.
3. Prefer General Physician or Internal Medicine for common, early, or mild symptoms unless red flags clearly suggest a specialty.
4. Choose from the in-app specialization list when possible.
5. If no in-app specialization fits, set specialization to "Unsure" and explain which specialization is needed.
6. You MUST write the summary in ${langName}. The user's interface language is ${langName} — always match it, even if earlier messages were in a different language.

CLINIC SUGGESTIONS:
After recommending a specialization, if there are matching clinics in the data, suggest the best match (closest or highest-rated) by setting suggestedClinic and suggestedClinicId.

EMERGENCY DETECTION:
Set "emergency" to true ONLY if the full conversation clearly reveals MULTIPLE concurrent life-threatening indicators (e.g., chest pain + shortness of breath + sweating, or stroke signs together). A single symptom alone is never enough to trigger emergency. When in doubt, do not set emergency.

Available specializations in the app: ${availableSpecs}

Clinic and doctor data:
${clinicContext}

Return a JSON object with this exact schema:
{
  "summary": "<conclusion text>",
  "specialization": "<best specialization or 'Unsure'>",
  "suggestedClinic": "<clinic name or null>",
  "suggestedClinicId": "<clinicId or null>",
  "emergency": <boolean>,
  "emergencyMessage": "<urgent message if emergency, otherwise null>"
}`;
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

  // Extract client-provided state for intake tracking and conclusion readiness
  const clientCoveredFields: string[] = Array.isArray(payload?.coveredFields)
    ? payload.coveredFields.filter((f: unknown) => typeof f === "string")
    : [];
  const clientReadyToConclude = payload?.readyToConclude === true;
  const clientUiLanguage = typeof payload?.uiLanguage === "string" ? payload.uiLanguage : "en";

  // Determine mode: prefer explicit client mode, fall back to readyToConclude signal
  const inferredMode = clientReadyToConclude ? "conclusion" : "followup";
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
    // Fetch specializations + clinic/doctor context in parallel (one DB round-trip)
    const [availableSpecializations, clinicDoctorData] = await Promise.all([
      getAvailableSpecializations(),
      getClinicAndDoctorContext(),
    ]);

    const availableSpecializationsLabel =
      availableSpecializations.length > 0
        ? availableSpecializations.join(", ")
        : "None configured";

    const clinicContext = JSON.stringify(clinicDoctorData);
    const conversation = buildConversationTranscript(messages);
    const lastUserMessage =
      [...messages].reverse().find((msg) => msg.sender === "user")?.text ?? "";

    // ---- Follow-up mode: single consolidated AI call (replaces 3 separate calls) ----
    if (mode === "followup") {
      const systemPrompt = buildFollowupSystemPrompt(
        availableSpecializationsLabel,
        clinicContext,
        clientCoveredFields,
        clientUiLanguage
      );

      const apiPayload = {
        model: OPENAI_MODEL_FOLLOWUP,
        messages: [
          { role: "system" as const, content: systemPrompt },
          {
            role: "user" as const,
            content: `Conversation so far:\n${conversation}\n\nUser's most recent message:\n${lastUserMessage}\n\nIMPORTANT: Respond in ${resolveLanguageName(clientUiLanguage)} only.`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" as const },
      };

      const completion = await callOpenAI(apiPayload);
      const rawContent = extractOpenAIText(completion);

      if (typeof rawContent !== "string") {
        throw new Error("Unexpected OpenAI response format");
      }

      const parsed = JSON.parse(rawContent) as {
        reply?: string;
        relevant?: boolean;
        readyToConclude?: boolean;
        emergency?: boolean;
        emergencyMessage?: string;
        coveredFields?: string[];
        queryType?: string;
      };

      const reply = (parsed.reply ?? "").trim();
      const isRelevant = parsed.relevant !== false;
      const isEmergency = parsed.emergency === true;
      const emergencyMessage =
        typeof parsed.emergencyMessage === "string"
          ? parsed.emergencyMessage.trim()
          : null;
      const coveredFields = Array.isArray(parsed.coveredFields)
        ? parsed.coveredFields
        : clientCoveredFields;
      const readyToConclude = parsed.readyToConclude === true;
      const queryType = parsed.queryType ?? "symptom";

      return res.json({
        reply: reply || "I couldn't generate a response. Please try again.",
        relevant: isRelevant,
        mode: "followup",
        readyToConclude,
        emergency: isEmergency,
        emergencyMessage: isEmergency ? emergencyMessage : null,
        coveredFields,
        queryType,
      });
    }

    // ---- Conclusion mode: uses stronger model (gpt-4o) for accuracy ----
    const systemPrompt = buildConclusionSystemPrompt(
      availableSpecializationsLabel,
      clinicContext,
      clientUiLanguage
    );

    const apiPayload = {
      model: OPENAI_MODEL_CONCLUSION,
      messages: [
        { role: "system" as const, content: systemPrompt },
        {
          role: "user" as const,
          content: `Full conversation:\n${conversation}\n\nUser's most recent message:\n${lastUserMessage}\n\nIMPORTANT: Respond in ${resolveLanguageName(clientUiLanguage)} only.`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" as const },
    };

    const completion = await callOpenAI(apiPayload);
    const rawContent = extractOpenAIText(completion);

    if (typeof rawContent !== "string") {
      throw new Error("Unexpected OpenAI response format");
    }

    const parsed = JSON.parse(rawContent) as {
      summary?: string;
      specialization?: string;
      suggestedClinic?: string | null;
      suggestedClinicId?: string | null;
      emergency?: boolean;
      emergencyMessage?: string | null;
    };

    const specialization = String(parsed.specialization ?? "").trim();
    const summary = String(parsed.summary ?? "").trim();
    const suggestedClinic =
      typeof parsed.suggestedClinic === "string"
        ? parsed.suggestedClinic.trim()
        : null;
    const suggestedClinicId =
      typeof parsed.suggestedClinicId === "string"
        ? parsed.suggestedClinicId.trim()
        : null;
    const isEmergency = parsed.emergency === true;
    const emergencyMessage =
      typeof parsed.emergencyMessage === "string"
        ? parsed.emergencyMessage.trim()
        : null;

    if (
      specialization &&
      specialization !== "Unsure" &&
      !isInAppSpecialization(specialization, availableSpecializations)
    ) {
      return res.json({
        reply: `${summary} The recommended specialization is ${specialization}, but a clinic offering that service isn't currently available in the app. Please try elsewhere.`,
        specialization: "Unsure",
        relevant: true,
        mode: "conclusion",
        suggestedClinic: null,
        suggestedClinicId: null,
        emergency: isEmergency,
        emergencyMessage: isEmergency ? emergencyMessage : null,
      });
    }

    return res.json({
      reply: summary,
      specialization,
      relevant: true,
      mode: "conclusion",
      suggestedClinic,
      suggestedClinicId,
      emergency: isEmergency,
      emergencyMessage: isEmergency ? emergencyMessage : null,
    });
  } catch (error) {
    console.error("DocDaisy OpenAI error", error);
    return res.status(500).json({
      error: "Unable to reach DocDaisy right now. Please try again.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
