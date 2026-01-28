import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type QuestionType =
  | "short-text"
  | "long-text"
  | "single-choice"
  | "multiple-choice"
  | "number"
  | "date"
  | "boolean"
  | "file";

type DataType = "string" | "number" | "date" | "boolean" | "email" | "phone" | "file";

interface IntakeQuestion {
  id: string;
  label: string;
  description: string;
  questionType: QuestionType;
  dataType: DataType;
  required: boolean;
  options: string[];
}

const QUESTION_TYPES: { value: QuestionType; label: string; helper: string }[] = [
  { value: "short-text", label: "Short text", helper: "One-line answer field." },
  { value: "long-text", label: "Long text", helper: "Multi-line response for detailed answers." },
  { value: "single-choice", label: "Single choice", helper: "Patient selects one option." },
  { value: "multiple-choice", label: "Multiple choice", helper: "Patient can select multiple options." },
  { value: "number", label: "Number", helper: "Numeric input field." },
  { value: "date", label: "Date", helper: "Date picker input." },
  { value: "boolean", label: "Yes / No", helper: "Simple toggle choice." },
  { value: "file", label: "File upload", helper: "Allow patients to attach documents." },
];

const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "file", label: "File" },
];

const DELIVERY_OPTIONS = [
  { value: "booking", label: "After booking confirmation" },
  { value: "reminder", label: "24 hours before visit" },
  { value: "checkin", label: "At clinic check-in" },
];

const createEmptyQuestion = (index: number): IntakeQuestion => ({
  id: `q-${Date.now()}-${index}`,
  label: "",
  description: "",
  questionType: "short-text",
  dataType: "string",
  required: true,
  options: ["Option 1", "Option 2"],
});

export default function ClinicIntakeForm() {
  const { t } = useTranslation();
  const [isRequired, setIsRequired] = useState(true);
  const [deliveryTiming, setDeliveryTiming] = useState("booking");
  const [questions, setQuestions] = useState<IntakeQuestion[]>([
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
  ]);

  const questionTypeHelper = useMemo(
    () =>
      new Map(QUESTION_TYPES.map((type) => [type.value, type.helper])),
    [],
  );

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
          ? { ...question, options: [...question.options, `Option ${question.options.length + 1}`] }
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
                <Select value={deliveryTiming} onValueChange={setDeliveryTiming}>
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
                            questionType: value as QuestionType,
                            options:
                              value === "single-choice" || value === "multiple-choice"
                                ? question.options.length
                                  ? question.options
                                  : ["Option 1", "Option 2"]
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
                        onValueChange={(value) => updateQuestion(question.id, { dataType: value as DataType })}
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
                      <span>{question.label || t("Untitled question")}</span>
                      <span className="text-xs text-gray-500">
                        {question.required ? t("Required") : t("Optional")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{question.description || t("No help text")}</div>
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
            <Button className="mt-4 w-full" variant="outline">
              {t("Save intake form")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
