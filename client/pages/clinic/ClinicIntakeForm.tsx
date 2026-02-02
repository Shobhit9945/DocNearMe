import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useTranslation } from "@/lib/i18n";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ClinicIntakeFormResponse,
  IntakeDataType,
  IntakeDeliveryTiming,
  IntakeQuestion,
  IntakeQuestionType,
} from "@shared/api";
import { TranslatedText } from "@/components/TranslatedText";

const QUESTION_TYPES: { value: IntakeQuestionType; label: string; helper: string }[] = [
  { value: "short-text", label: "Short text", helper: "One-line answer field." },
  { value: "long-text", label: "Long text", helper: "Multi-line response for detailed answers." },
  { value: "single-choice", label: "Single choice", helper: "Patient selects one option." },
  { value: "multiple-choice", label: "Multiple choice", helper: "Patient can select multiple options." },
  { value: "number", label: "Number", helper: "Numeric input field." },
  { value: "date", label: "Date", helper: "Date picker input." },
  { value: "boolean", label: "Yes / No", helper: "Simple toggle choice." },
  { value: "file", label: "File upload", helper: "Allow patients to attach documents." },
];

const DATA_TYPES: { value: IntakeDataType; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "file", label: "File" },
];

const DELIVERY_OPTIONS: { value: IntakeDeliveryTiming; label: string }[] = [
  { value: "booking", label: "After booking confirmation" },
  { value: "reminder", label: "24 hours before visit" },
  { value: "checkin", label: "At clinic check-in" },
];

const DEFAULT_QUESTIONS: IntakeQuestion[] = [
  {
    id: "q-1",
    label: "Primary concern",
    description: "Briefly describe the reason for your visit.",
    questionType: "long-text",
    dataType: "string",
    required: true,
    options: [],
  },
  {
    id: "q-2",
    label: "Do you have any allergies?",
    description: "",
    questionType: "boolean",
    dataType: "boolean",
    required: true,
    options: [],
  },
];

export default function ClinicIntakeForm() {
  const { t } = useTranslation();
  const session = getClinicSession();
  const [isRequired, setIsRequired] = useState(true);
  const [deliveryTiming, setDeliveryTiming] = useState<IntakeDeliveryTiming>("booking");
  const [questions, setQuestions] = useState<IntakeQuestion[]>(DEFAULT_QUESTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const optionLabel = (index: number) => `${t("Option")} ${index}`;
  const createEmptyQuestion = (index: number): IntakeQuestion => ({
    id: `q-${Date.now()}-${index}`,
    label: "",
    description: "",
    questionType: "short-text" satisfies IntakeQuestionType,
    dataType: "string" satisfies IntakeDataType,
    required: true,
    options: [optionLabel(1), optionLabel(2)],
  });

  const questionTypeHelper = useMemo(
    () =>
      new Map(QUESTION_TYPES.map((type) => [type.value, type.helper])),
    [],
  );

  useEffect(() => {
    const clinicId = session?.clinicId;
    if (!clinicId) {
      setIsLoading(false);
      return;
    }

    const fetchForm = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/clinic/intake-form", {
          headers: {
            ...getClinicAuthHeader(),
          },
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.error ?? t("Unable to load intake form."));
        }

        const data = (await response.json()) as ClinicIntakeFormResponse;
        if (data?.form) {
          setIsRequired(data.form.isRequired);
          setDeliveryTiming(data.form.deliveryTiming);
          setQuestions(data.form.questions.length ? data.form.questions : DEFAULT_QUESTIONS);
        } else {
          setIsRequired(true);
          setDeliveryTiming("booking");
          setQuestions(DEFAULT_QUESTIONS);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : t("Unable to load intake form."));
      } finally {
        setIsLoading(false);
      }
    };

    fetchForm();
  }, [session?.clinicId, t]);

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length + 1)]);
  };

  const updateQuestion = (id: string, updates: Partial<IntakeQuestion>) => {
    setQuestions((prev) =>
      prev.map((question) => (question.id === id ? { ...question, ...updates } : question)),
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((question) => question.id !== id));
  };

  const updateOption = (id: string, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id
          ? {
              ...question,
              options: question.options.map((option, optionIndex) =>
                optionIndex === index ? value : option,
              ),
            }
          : question,
      ),
    );
  };

  const addOption = (id: string) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id
          ? { ...question, options: [...question.options, optionLabel(question.options.length + 1)] }
          : question,
      ),
    );
  };

  const removeOption = (id: string, index: number) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id
          ? { ...question, options: question.options.filter((_, optionIndex) => optionIndex !== index) }
          : question,
      ),
    );
  };

  const sanitizeQuestions = (source: IntakeQuestion[]) =>
    source.map((question) => ({
      ...question,
      label: question.label.trim(),
      description: question.description?.trim() ?? "",
      options: (question.options ?? []).map((option) => option.trim()).filter(Boolean),
    }));

  const handleSave = async () => {
    if (!session?.clinicId) {
      toast({
        title: t("Clinic sign-in required"),
        description: t("Sign in to update your intake form."),
        variant: "destructive",
      });
      return;
    }

    const sanitized = sanitizeQuestions(questions);
    const invalidQuestion = sanitized.find((question) => !question.label);
    if (invalidQuestion) {
      toast({
        title: t("Missing question text"),
        description: t("Please add a prompt for every intake question."),
        variant: "destructive",
      });
      return;
    }

    const missingOptions = sanitized.find((question) => {
      const isChoice =
        question.questionType === "single-choice" || question.questionType === "multiple-choice";
      return isChoice && (!question.options || question.options.length === 0);
    });
    if (missingOptions) {
      toast({
        title: t("Missing options"),
        description: t("Choice-based questions must include at least one option."),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/clinic/intake-form", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify({
          isRequired,
          deliveryTiming,
          questions: sanitized,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? t("Unable to save intake form."));
      }

      const data = (await response.json()) as ClinicIntakeFormResponse & { success?: boolean };
      if (data?.form) {
        setIsRequired(data.form.isRequired);
        setDeliveryTiming(data.form.deliveryTiming);
        setQuestions(data.form.questions.length ? data.form.questions : sanitized);
      }

      toast({
        title: t("Intake form saved"),
        description: t("Patients will see your updated questions."),
      });
    } catch (error) {
      toast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!session?.clinicId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        {t("Sign in to manage your intake form.")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        {t("Loading intake form...")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("Patient intake form")}</h1>
          <p className="text-gray-500 mt-1">
            {t("Build custom questions and decide when patients complete the intake form.")}
          </p>
        </div>
        <Button onClick={addQuestion} className="gap-2">
          <Plus size={16} />
          {t("Add question")}
        </Button>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {loadError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t("Form settings")}</h2>
                <p className="text-sm text-gray-500">
                  {t("Require the intake form and choose when it is sent.")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
                <span className="text-sm font-medium text-gray-700">
                  {isRequired ? t("Required") : t("Optional")}
                </span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  {t("When should patients complete it?")}
                </label>
                <Select
                  value={deliveryTiming}
                  onValueChange={(value) => setDeliveryTiming(value as IntakeDeliveryTiming)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select timing")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-700">{t("Tip")}</p>
                <p className="mt-1">
                  {t("You can request extra documents by adding file upload questions.")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => {
              const isChoice =
                question.questionType === "single-choice" || question.questionType === "multiple-choice";
              return (
                <div
                  key={question.id}
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{t("Question")}</h3>
                        <p className="text-xs text-gray-500">
                          {t(questionTypeHelper.get(question.questionType) ?? "")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeQuestion(question.id)}
                      disabled={questions.length <= 1}
                    >
                      <Trash2 size={16} />
                      {t("Remove")}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        {t("Question text")}
                      </label>
                      <Input
                        value={question.label}
                        onChange={(event) => updateQuestion(question.id, { label: event.target.value })}
                        placeholder={t("e.g. What brings you in today?")}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        {t("Question type")}
                      </label>
                        <Select
                          value={question.questionType}
                          onValueChange={(value) =>
                            updateQuestion(question.id, {
                              questionType: value as IntakeQuestionType,
                              options:
                                value === "single-choice" || value === "multiple-choice"
                                  ? question.options.length
                                    ? question.options
                                  : [optionLabel(1), optionLabel(2)]
                                : [],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select type")} />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {t(type.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        {t("Data type")}
                      </label>
                      <Select
                        value={question.dataType}
                        onValueChange={(value) => updateQuestion(question.id, { dataType: value as IntakeDataType })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select data type")} />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {t(type.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={question.required}
                        onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {question.required ? t("Required") : t("Optional")}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        {t("Help text (optional)")}
                      </label>
                      <Textarea
                        value={question.description}
                        onChange={(event) => updateQuestion(question.id, { description: event.target.value })}
                        placeholder={t("Provide extra context for patients.")}
                        className="min-h-[96px]"
                      />
                    </div>
                  </div>

                  {isChoice ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{t("Choices")}</p>
                          <p className="text-xs text-gray-500">
                            {t("Add options patients can select.")}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addOption(question.id)} className="gap-2">
                          <Plus size={14} />
                          {t("Add option")}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-500 hover:text-red-600"
                              onClick={() => removeOption(question.id, optionIndex)}
                              disabled={question.options.length <= 1}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ClipboardList size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t("Form preview")}</h2>
                <p className="text-xs text-gray-500">
                  {t("This is what patients will see before their visit.")}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                {isRequired
                  ? t("Patients must complete this form before their appointment.")
                  : t("Patients can optionally complete this form.")}
              </div>
              <div className="space-y-4">
                {questions.map((question) => (
                  <div key={`preview-${question.id}`} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-gray-800">
                      <span>
                        <TranslatedText text={question.label || t("Untitled question")} inline />
                      </span>
                      <span className="text-xs text-gray-500">
                        {question.required ? t("Required") : t("Optional")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      <TranslatedText text={question.description || t("No help text")} inline />
                    </div>
                    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
                      {t("Answer type")}: {t(QUESTION_TYPES.find((type) => type.value === question.questionType)?.label ?? "")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 text-sm text-blue-700">
            <p className="font-semibold">{t("Next step")}</p>
            <p className="mt-2">
              {t(
                "Publish the intake form and notify patients when you are ready. Soon you'll be able to export responses.",
              )}
            </p>
            <Button className="mt-4 w-full" variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("Saving...") : t("Save intake form")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
