import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getClinicAuthHeader } from "@/lib/clinic-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeClinicHours } from "@/lib/scheduling";
import type { ClinicBookingClosure, ClinicProfile, ClinicProfileUpdateRequest } from "@shared/api";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatDateJp = (value?: string) => (value ? value.replace(/-/g, "/") : "");

// Manual QA checklist:
// - Update notification email and confirm it persists after refresh.
// - Add closure (single day + range) and ensure bookings are blocked on those dates.
// - Delete closure and confirm availability returns.
// - Confirm notification method list stays disabled except Email.
// - Save each section independently without losing changes in other sections.

export default function ClinicInfo() {
  const { t } = useTranslation();
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [image, setImage] = useState("");
  const [weekdayStart, setWeekdayStart] = useState("09:00");
  const [weekdayEnd, setWeekdayEnd] = useState("18:00");
  const [weekendStart, setWeekendStart] = useState("10:00");
  const [weekendEnd, setWeekendEnd] = useState("16:00");
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [bookingClosures, setBookingClosures] = useState<ClinicBookingClosure[]>([]);
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [closureDraft, setClosureDraft] = useState({ startDate: "", endDate: "", reason: "" });
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);

  const sortedClosures = useMemo(
    () =>
      [...bookingClosures].sort((a, b) =>
        (a.startDate ?? "").localeCompare(b.startDate ?? ""),
      ),
    [bookingClosures],
  );

  useEffect(() => {
    const loadClinic = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/clinic/me", {
          headers: {
            ...getClinicAuthHeader(),
          },
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error?.error ?? t("Unable to load clinic info."));
        }
        const payload = (await response.json()) as { clinic: ClinicProfile };
        setClinic(payload.clinic);
      } catch (error) {
        toast({
          title: t("読み込みに失敗しました"),
          description: error instanceof Error ? error.message : t("Please try again."),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    void loadClinic();
  }, [t]);

  useEffect(() => {
    if (!clinic) return;
    setName(clinic.name ?? "");
    setLocation(clinic.location ?? "");
    setPhone(clinic.phone ?? "");
    setNotificationEmail(clinic.email ?? "");
    setImage(clinic.image ?? "");
    const normalizedHours = normalizeClinicHours(clinic.hours);
    setWeekdayStart(normalizedHours.weekdays.start);
    setWeekdayEnd(normalizedHours.weekdays.end);
    setWeekendStart(normalizedHours.weekend.start);
    setWeekendEnd(normalizedHours.weekend.end);
    setClosedDays(normalizedHours.closedDays);
    setBookingClosures(clinic.bookingClosures ?? []);
  }, [clinic]);

  const handleBasicSave = async () => {
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    const trimmedPhone = phone.trim();
    const trimmedNotificationEmail = notificationEmail.trim();

    setIsSavingBasic(true);
    try {
      const payload: ClinicProfileUpdateRequest = {
        name: trimmedName || undefined,
        location: trimmedLocation || undefined,
        phone: trimmedPhone || undefined,
        email: trimmedNotificationEmail || undefined,
        notificationEmailEnabled: true,
        notificationPhoneEnabled: false,
        notificationLineEnabled: false,
      };
      const response = await fetch("/api/clinic/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save clinic info."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("保存しました"), description: t("基本情報を更新しました。") });
    } catch (error) {
      toast({
        title: t("保存に失敗しました"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSavingBasic(false);
    }
  };

  const handleHoursSave = async () => {
    setIsSavingHours(true);
    try {
      const payload: ClinicProfileUpdateRequest = {
        hours: {
          weekdays: { start: weekdayStart, end: weekdayEnd },
          weekend: { start: weekendStart, end: weekendEnd },
          closedDays,
          slotMinutes: 30,
        },
      };
      const response = await fetch("/api/clinic/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save clinic hours."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("保存しました"), description: t("診療時間を更新しました。") });
    } catch (error) {
      toast({
        title: t("保存に失敗しました"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleAddClosure = async () => {
    if (!closureDraft.startDate) {
      toast({ title: t("開始日を入力してください"), variant: "destructive" });
      return;
    }
    if (closureDraft.endDate && closureDraft.endDate < closureDraft.startDate) {
      toast({ title: t("終了日は開始日以降にしてください"), variant: "destructive" });
      return;
    }

    try {
      const response = await fetch("/api/clinic/me/closures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify({
          startDate: closureDraft.startDate,
          endDate: closureDraft.endDate,
          reason: closureDraft.reason,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to add closure."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      setShowClosureForm(false);
      setClosureDraft({ startDate: "", endDate: "", reason: "" });
      toast({ title: t("追加しました"), description: t("休診日を登録しました。") });
    } catch (error) {
      toast({
        title: t("追加に失敗しました"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteClosure = async (closureId?: string) => {
    if (!closureId) return;
    try {
      const response = await fetch(`/api/clinic/me/closures/${closureId}`, {
        method: "DELETE",
        headers: {
          ...getClinicAuthHeader(),
        },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to delete closure."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("削除しました"), description: t("休診日を削除しました。") });
    } catch (error) {
      toast({
        title: t("削除に失敗しました"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    }
  };

  const handlePhotosSave = async () => {
    setIsSavingPhotos(true);
    try {
      const payload: ClinicProfileUpdateRequest = {
        image: image.trim() || undefined,
      };
      const response = await fetch("/api/clinic/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getClinicAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? t("Unable to save photo."));
      }
      const updated = (await response.json()) as { clinic: ClinicProfile };
      setClinic(updated.clinic);
      toast({ title: t("保存しました"), description: t("写真を更新しました。") });
    } catch (error) {
      toast({
        title: t("保存に失敗しました"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSavingPhotos(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">{t("読み込み中...")}</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t("クリニック情報")}</h1>
        <p className="text-gray-500 mt-1">
          {t("予約受付に必要な情報をわかりやすくまとめました。")}
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("基本情報")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("患者さんに表示される情報です。")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("クリニック名")}</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("電話番号")}</label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("住所")}</label>
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("通知先メールアドレス")}</label>
          <Input
            value={notificationEmail}
            onChange={(event) => setNotificationEmail(event.target.value)}
            placeholder={t("clinic@example.com")}
            type="email"
          />
          <p className="text-xs text-slate-500 mt-2">
            {t("予約リクエストが入ると、このメールに通知が届きます。")}
          </p>
        </div>
        <Button onClick={handleBasicSave} disabled={isSavingBasic}>
          {isSavingBasic ? t("保存中...") : t("保存")}
        </Button>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("診療時間")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("曜日ごとの受付時間を設定してください。")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">{t("平日")}</label>
            <div className="flex items-center gap-3">
              <Input type="time" value={weekdayStart} onChange={(event) => setWeekdayStart(event.target.value)} />
              <span className="text-sm text-slate-500">{t("〜")}</span>
              <Input type="time" value={weekdayEnd} onChange={(event) => setWeekdayEnd(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">{t("土日")}</label>
            <div className="flex items-center gap-3">
              <Input type="time" value={weekendStart} onChange={(event) => setWeekendStart(event.target.value)} />
              <span className="text-sm text-slate-500">{t("〜")}</span>
              <Input type="time" value={weekendEnd} onChange={(event) => setWeekendEnd(event.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("定休日")}</label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const checked = closedDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setClosedDays((prev) =>
                      checked ? prev.filter((item) => item !== day) : [...prev, day],
                    );
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    checked
                      ? "bg-[#0089FF] text-white"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {t(day)}
                </button>
              );
            })}
          </div>
        </div>
        <Button onClick={handleHoursSave} disabled={isSavingHours}>
          {isSavingHours ? t("保存中...") : t("保存")}
        </Button>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("休診・受付停止")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("終日休診のみ対応しています。")}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowClosureForm((prev) => !prev)}>
          {t("休診・受付停止を追加")}
        </Button>
        {showClosureForm ? (
          <div className="grid gap-3 lg:grid-cols-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t("開始日")}</label>
              <Input
                type="date"
                value={closureDraft.startDate}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">{t("終了日（任意）")}</label>
              <Input
                type="date"
                value={closureDraft.endDate}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">{t("理由（任意）")}</label>
              <Input
                value={closureDraft.reason}
                onChange={(event) => setClosureDraft((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder={t("例：院内研修")}
              />
            </div>
            <div className="lg:col-span-4 flex gap-2">
              <Button type="button" onClick={handleAddClosure}>{t("追加")}</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowClosureForm(false);
                  setClosureDraft({ startDate: "", endDate: "", reason: "" });
                }}
              >
                {t("キャンセル")}
              </Button>
            </div>
          </div>
        ) : null}
        {sortedClosures.length === 0 ? (
          <p className="text-sm text-slate-500">{t("登録された休診日はありません。")}</p>
        ) : (
          <div className="space-y-2">
            {sortedClosures.map((closure) => (
              <div
                key={closure.id ?? `${closure.startDate}-${closure.endDate}`}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
                <span>
                  {formatDateJp(closure.startDate)}
                  {closure.endDate && closure.endDate !== closure.startDate
                    ? ` 〜 ${formatDateJp(closure.endDate)}`
                    : ""}
                  {closure.reason ? `（${closure.reason}）` : ""}
                </span>
                <Button type="button" variant="ghost" onClick={() => handleDeleteClosure(closure.id)}>
                  {t("削除")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("通知")}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t("予約リクエストが届くとメール通知が送られます。必要な場合のみ管理画面で承認してください。")}
          </p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-300 text-[#3A12DB]" />
            <span>{t("Email（必須）")}</span>
            <span className="text-xs text-slate-500">{t("ON")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-200" />
            <span>{t("Phone（自動音声）")}</span>
            <span className="text-xs text-slate-400">{t("準備中")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-200" />
            <span>{t("LINE Bot")}</span>
            <span className="text-xs text-slate-400">{t("準備中")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-200" />
            <span>{t("Dashboardのみ")}</span>
            <span className="text-xs text-slate-400">{t("準備中")}</span>
          </label>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("写真")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("クリニックの代表画像を設定します。")}</p>
        </div>
        {image ? (
          <img
            src={image}
            alt={t("Clinic image")}
            className="w-full max-w-sm rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <div className="w-full max-w-sm rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            {t("画像を設定するとプレビューが表示されます")}
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("画像（URL）")}</label>
          <Input
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder={t("https://example.com/clinic.jpg")}
          />
          <p className="text-xs text-slate-500 mt-2">{t("URLを貼り付けて保存してください。")}</p>
        </div>
        <Button onClick={handlePhotosSave} disabled={isSavingPhotos}>
          {isSavingPhotos ? t("保存中...") : t("保存")}
        </Button>
      </section>
    </div>
  );
}
