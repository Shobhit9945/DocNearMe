import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  CalendarClock,
  FileText,
  Mail,
  Phone,
  Stethoscope,
  User,
  XCircle,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import type {
  AppointmentConfirmResponse,
  AppointmentDeclineResponse,
  IntakeAnswerValue,
} from "@shared/api";

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
};

const formatAnswerValue = (value: IntakeAnswerValue) => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

type ConfirmPayload = AppointmentConfirmResponse | AppointmentDeclineResponse;

const isAlreadyProcessedError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not awaiting confirmation") ||
    normalized.includes("invalid confirmation token") ||
    normalized.includes("invalid or expired confirmation token") ||
    normalized.includes("confirmation token expired")
  );
};

export default function ClinicConfirm() {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") ?? "";
  const token = searchParams.get("token") ?? "";
  const action = (searchParams.get("action") ?? "confirm") as "confirm" | "decline";
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ConfirmPayload | null>(null);

  useEffect(() => {
    if (!appointmentId || !token) {
      setError("確認情報が不足しています。メールのリンクをご利用ください。");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      try {
        const response = await fetch(
          `/api/appointments/${encodeURIComponent(appointmentId)}/${action}?token=${encodeURIComponent(token)}`,
          { method: "GET", signal: controller.signal },
        );
        const data = (await response.json()) as ConfirmPayload | { error?: string };
        if (!response.ok) {
          const message =
            "error" in data && data.error ? data.error : "リクエストを処理できませんでした。";
          throw new Error(message);
        }
        setPayload(data as ConfirmPayload);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "リクエストを処理できませんでした。");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [action, appointmentId, token]);

  const appointment = payload?.appointment;
  const patientDetails = payload?.patientDetails;
  const intakeResponse = payload?.intakeResponse;
  const sharedRecord = payload?.sharedRecord;

  const downloadUrl = useMemo(() => {
    if (!sharedRecord?.data || !sharedRecord.type) return "";
    return `data:${sharedRecord.type};base64,${sharedRecord.data}`;
  }, [sharedRecord]);

  if (isLoading) {
    return (
      <LoadingScreen
        title={action === "confirm" ? "予約を承認しています" : "却下を処理しています"}
        subtitle="更新中です。しばらくお待ちください。"
        className="min-h-screen bg-[#F6F8FF]"
      />
    );
  }

  if (error || !appointment) {
    if (error && isAlreadyProcessedError(error)) {
      return (
        <div className="min-h-screen bg-[#F6F8FF] px-4 py-10">
          <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-100 bg-white p-8 shadow-lg">
            <div className="flex items-center gap-3 text-emerald-600">
              <BadgeCheck className="h-6 w-6" />
              <h1 className="text-xl font-semibold">このリクエストは既に処理済みです</h1>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              この予約は既に承認または却下されています。追加の操作は不要です。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/appointments"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                予約一覧を見る
              </Link>
              <Link
                to="/login"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                クリニックログイン
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F6F8FF] px-4 py-10">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-red-100 bg-white p-8 shadow-lg">
          <div className="flex items-center gap-3 text-red-600">
            <XCircle className="h-6 w-6" />
            <h1 className="text-xl font-semibold">リクエストを処理できませんでした</h1>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {error ?? "最新のメールからもう一度お試しください。"}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              クリニックログインへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#E8F0FF,_#F6F8FF_55%,_#FFFFFF_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                action === "confirm" ? "bg-emerald-100" : "bg-rose-100"
              }`}>
                {action === "confirm" ? (
                  <BadgeCheck className="h-6 w-6 text-emerald-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {action === "confirm" ? "予約を承認しました" : "リクエストを却下しました"}
                </h1>
                <p className="text-sm text-slate-500">
                  {action === "confirm"
                    ? "予約を承認し、患者へ通知しました。"
                    : "予約リクエストを却下しました。"}
                </p>
              </div>
            </div>
            <div className="rounded-full bg-[#EEF4FF] px-4 py-2 text-xs font-semibold text-[#1E4DB7]">
              予約ID: {appointment._id}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">予約詳細</h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <CalendarClock className="h-4 w-4" /> 日時
                </span>
                <span className="font-medium text-slate-900">
                  {formatDateTime(appointment.confirmedStart ?? appointment.preferredStart)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <Stethoscope className="h-4 w-4" /> 希望担当医
                </span>
                <span className="font-medium text-slate-900">
                  {appointment.doctorName ?? "指定なし"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <Stethoscope className="h-4 w-4" /> 診療科
                </span>
                <span className="font-medium text-slate-900">{appointment.specialization}</span>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">症状・備考</p>
                <p className="mt-2 text-sm text-slate-700">
                  {appointment.notesTranslated?.trim() || appointment.notes?.trim() || "症状や備考は記載されていません。"}
                </p>
              </div>
            </div>

            {intakeResponse?.responses?.length ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">問診回答</h3>
                <div className="mt-3 space-y-3">
                  {intakeResponse.responses.map((item) => (
                    <div key={item.questionId} className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{formatAnswerValue(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-slate-900">患者情報</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-500">
                    <User className="h-4 w-4" /> 氏名
                  </span>
                  <span className="font-medium text-slate-900">
                    {patientDetails?.nameTranslated ??
                      appointment.patientNameTranslated ??
                      patientDetails?.name ??
                      appointment.patientName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">年齢</span>
                  <span className="font-medium text-slate-900">
                    {patientDetails?.age !== undefined ? `${patientDetails.age}` : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">ビザ</span>
                  <span className="font-medium text-slate-900">{patientDetails?.visaType ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">国籍</span>
                  <span className="font-medium text-slate-900">{patientDetails?.country ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-4 w-4" /> メール
                  </span>
                  <span className="font-medium text-slate-900">{appointment.patientEmail ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-4 w-4" /> 電話番号
                  </span>
                  <span className="font-medium text-slate-900">{appointment.patientPhone ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-slate-900">医療記録</h2>
              {sharedRecord ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-slate-900">{sharedRecord.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    種別: {sharedRecord.type} ・ サイズ: {sharedRecord.size} バイト
                  </p>
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      download={sharedRecord.name}
                      className="inline-flex items-center justify-center rounded-full bg-[#1E4DB7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#173C93]"
                    >
                      記録をダウンロード
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">
                      記録のメタデータのみ利用可能です。ファイル本体は含まれていません。
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">医療記録は共有されていません。</p>
              )}
            </div>

            <div className="rounded-[22px] border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-slate-700">次の対応</p>
              <p className="mt-2">
                予約内容を院内ダッシュボードで確認し、必要に応じて患者へ連絡してください。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/appointments"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  予約一覧を見る
                </Link>
                <Link
                  to="/login"
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  クリニックログイン
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
