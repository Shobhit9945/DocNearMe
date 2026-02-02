import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { User, ShieldCheck, LogOut, Lock, Phone } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { phoneCountryOptions } from "@/lib/phone-countries";
import type { PatientProfile, PatientProfileResponse, PatientProfileUpdateRequest } from "@shared/api";

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileVisaType, setProfileVisaType] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactCountryIso, setEmergencyContactCountryIso] = useState("JP");
  const [emergencyContactNumber, setEmergencyContactNumber] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("Japanese");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [vaultEnabled, setVaultEnabled] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);

  const TOKEN_KEY = "docnearme_patient_token";
  const emergencyCountry = useMemo(
    () => phoneCountryOptions.find((option) => option.iso === emergencyContactCountryIso) ?? phoneCountryOptions[0],
    [emergencyContactCountryIso],
  );

  const formatEmergencyNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 15);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`.trim();
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`.trim();
  };

  const parseEmergencyContact = (value?: string) => {
    if (!value) return;
    const match = value.match(/(\+\d{1,4})\s*([\d\s-]{4,})/);
    const dialCode = match?.[1];
    const number = match?.[2];
    const name = value.replace(match?.[0] ?? "", "").replace(/[()·|-]/g, " ").trim();
    if (name) setEmergencyContactName(name);
    if (dialCode) {
      const country = phoneCountryOptions.find((option) => option.dialCode === dialCode);
      if (country) setEmergencyContactCountryIso(country.iso);
    }
    if (number) setEmergencyContactNumber(formatEmergencyNumber(number));
  };

  const loadProfileFromStorage = () => {
    const storedProfile = localStorage.getItem("docnearme_profile");
    const storedName = localStorage.getItem("docnearme_user_name") ?? "";
    const storedEmail = localStorage.getItem("docnearme_user_email") ?? "";
    if (!storedProfile) {
      setProfileName(storedName);
      setProfileEmail(storedEmail);
      setProfilePhone("");
      setProfileAddress("");
      setProfileVisaType("");
      setEmergencyContact("");
      setPreferredLanguage("Japanese");
      setNotificationsEnabled(true);
      return;
    }

    const parsed = JSON.parse(storedProfile) as {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      visaType?: string;
      emergencyContact?: string;
      preferredLanguage?: string;
      notificationsEnabled?: boolean;
    };
    setProfileName(parsed.name ?? storedName);
    setProfileEmail(parsed.email ?? storedEmail);
    setProfilePhone(parsed.phone ?? "");
    setProfileAddress(parsed.address ?? "");
    setProfileVisaType(parsed.visaType ?? "");
    setEmergencyContact(parsed.emergencyContact ?? "");
    parseEmergencyContact(parsed.emergencyContact);
    setPreferredLanguage(parsed.preferredLanguage ?? "Japanese");
    setNotificationsEnabled(parsed.notificationsEnabled ?? true);
  };

  const persistProfileToStorage = (profile: PatientProfile) => {
    localStorage.setItem("docnearme_user_name", profile.name);
    localStorage.setItem("docnearme_user_email", profile.email);
    localStorage.setItem(
      "docnearme_profile",
      JSON.stringify({
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        visaType: profile.visaType ?? "",
        emergencyContact: profile.emergencyContact ?? "",
        preferredLanguage: profile.preferredLanguage ?? "Japanese",
        notificationsEnabled: profile.notificationsEnabled ?? true,
      }),
    );
  };

  const applyProfile = (profile: PatientProfile) => {
    setProfileName(profile.name);
    setProfileEmail(profile.email);
    setProfilePhone(profile.phone ?? "");
    setProfileAddress(profile.address ?? "");
    setProfileVisaType(profile.visaType ?? "");
    setEmergencyContact(profile.emergencyContact ?? "");
    parseEmergencyContact(profile.emergencyContact);
    setPreferredLanguage(profile.preferredLanguage ?? "Japanese");
    setNotificationsEnabled(profile.notificationsEnabled ?? true);
    setUserName(profile.name);
    setUserEmail(profile.email);
    persistProfileToStorage(profile);
  };

  useEffect(() => {
    const storedName = localStorage.getItem("docnearme_user_name");
    const storedEmail = localStorage.getItem("docnearme_user_email");
    if (storedName) {
      setUserName(storedName);
    }
    if (storedEmail) {
      setUserEmail(storedEmail);
      if (!profileEmail) {
        setProfileEmail(storedEmail);
      }
    }
    loadProfileFromStorage();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || isEditingProfile) return;
    setIsSyncingProfile(true);
    void fetch("/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load profile");
        }
        return (await response.json()) as PatientProfileResponse;
      })
      .then((data) => {
        applyProfile(data.profile);
      })
      .catch((error) => {
        console.error("Profile sync failed", error);
      })
      .finally(() => {
        setIsSyncingProfile(false);
      });
  }, [isEditingProfile]);

  useEffect(() => {
    if (!userName) {
      setIsEditingProfile(false);
    }
  }, [userName]);

  const handleLogout = () => {
    localStorage.removeItem("docnearme_patient_token");
    localStorage.removeItem("docnearme_user_name");
    localStorage.removeItem("docnearme_user_email");
    setUserName(null);
    setUserEmail(null);
    navigate("/");
  };

  const handleProfileSave = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const composedEmergencyContact = [
      emergencyContactName.trim(),
      `${emergencyCountry.dialCode} ${emergencyContactNumber}`.trim(),
    ]
      .filter(Boolean)
      .join(" · ")
      .trim();

    const profilePayload: PatientProfileUpdateRequest = {
      name: profileName,
      email: profileEmail,
      phone: profilePhone,
      address: profileAddress,
      visaType: profileVisaType || undefined,
      emergencyContact: composedEmergencyContact,
      preferredLanguage,
      notificationsEnabled,
    };

    if (token) {
      setIsSyncingProfile(true);
      try {
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profilePayload),
        });
        if (!response.ok) {
          throw new Error("Failed to save profile");
        }
        const data = (await response.json()) as PatientProfileResponse;
        applyProfile(data.profile);
      } catch (error) {
        console.error("Profile update failed", error);
      } finally {
        setIsSyncingProfile(false);
      }
    } else {
      persistProfileToStorage({
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        address: profileAddress,
        visaType: profileVisaType || undefined,
        emergencyContact: composedEmergencyContact,
        preferredLanguage,
        notificationsEnabled,
      });
      setUserName(profileName);
      setUserEmail(profileEmail);
    }

    setProfileSaved(true);
    setIsEditingProfile(false);
    window.setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleProfileCancel = () => {
    loadProfileFromStorage();
    setIsEditingProfile(false);
    setProfileSaved(false);
  };

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-14 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-[#002D55]">{t("Profile")}</h1>
           <p className="text-sm text-slate-500 mt-2">{t("Manage your personal details and preferences.")}</p>
        </div>
        {userName && (
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden lg:inline-flex text-destructive hover:text-destructive hover:bg-destructive/10 gap-2">
            <LogOut className="w-4 h-4" />
            {t("Sign out")}
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF4FF]">
                      <User className="h-5 w-5 text-[#1E6FD9]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t("Personal information")}</p>
                      <p className="text-xs text-slate-500">{t("Manage your personal details and preferences.")}</p>
                    </div>
                  </div>
                  {!isEditingProfile && (userName || userEmail) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setIsEditingProfile(true);
                        setProfileSaved(false);
                      }}
                    >
                      {t("Edit info")}
                    </Button>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("Account")}</p>
                  <p className="mt-1 text-lg font-semibold text-[#0F2E4E]">
                    {userName ? userName : t("Guest profile")}
                  </p>
                  <p className="text-sm text-slate-600">
                    {userName ? t("You are signed in to DocNearMe.") : t("Sign in to personalize your profile.")}
                  </p>
                  {userEmail && <p className="text-sm text-slate-500">{userEmail}</p>}
                  {!userName && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 border border-slate-200">
                        {t("Public access")}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#1E6FD9] hover:bg-[#185DB8]"
                        onClick={() => navigate("/patient-auth")}
                      >
                        {t("Login")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Full name")}
                    </label>
                    <Input
                      type="text"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      placeholder={t("Full name")}
                      className="mt-2"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Email address")}
                    </label>
                    <Input
                      type="email"
                      value={profileEmail}
                      onChange={(event) => setProfileEmail(event.target.value)}
                      placeholder={t("Email address")}
                      className="mt-2"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Phone number")}
                    </label>
                    <Input
                      type="tel"
                      value={profilePhone}
                      onChange={(event) => setProfilePhone(event.target.value)}
                      placeholder={t("Phone number")}
                      className="mt-2"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Preferred language")}
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        "Japanese",
                        "English",
                        "Indonesian",
                        "Burmese",
                        "Bangla",
                        "Arabic",
                        "Hindi",
                        "Filipino",
                        "Thai",
                        "Chinese",
                        "Korean",
                        "Mexican",
                        "Vietnamese",
                      ].map((language) => (
                        <button
                          key={language}
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            preferredLanguage === language
                              ? "border-[#1E6FD9] bg-[#EAF4FF] text-[#1E6FD9]"
                              : "border-slate-200 text-slate-500 hover:border-[#1E6FD9]/40"
                          } ${!isEditingProfile ? "cursor-not-allowed opacity-60" : ""}`}
                          onClick={() => setPreferredLanguage(language)}
                          disabled={!isEditingProfile}
                        >
                          {t(language)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(event) => setNotificationsEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#1E6FD9] focus:ring-[#1E6FD9]"
                      disabled={!isEditingProfile}
                    />
                    {t("Send me appointment reminders and care tips.")}
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t("Clinic coordination")}</p>
                    <p className="text-xs text-slate-500">{t("Used only to help clinics prepare documents and communication support")}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    {t("Optional")}
                  </span>
                </div>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Home address")}
                    </label>
                    <Input
                      type="text"
                      value={profileAddress}
                      onChange={(event) => setProfileAddress(event.target.value)}
                      placeholder={t("Home address")}
                      className="mt-2"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Visa type")}
                    </label>
                    <Select
                      value={profileVisaType}
                      onValueChange={(value) => setProfileVisaType(value)}
                      disabled={!isEditingProfile}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("Select visa type")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tourist">{t("Tourist")}</SelectItem>
                        <SelectItem value="resident-work">{t("Resident (work visa)")}</SelectItem>
                        <SelectItem value="resident-student">{t("Resident (student visa)")}</SelectItem>
                        <SelectItem value="resident-family">{t("Resident (family/dependent)")}</SelectItem>
                        <SelectItem value="resident-permanent">{t("Resident (permanent)")}</SelectItem>
                        <SelectItem value="resident-long-term">{t("Resident (long-term)")}</SelectItem>
                        <SelectItem value="resident-other">{t("Resident (other)")}</SelectItem>
                        <SelectItem value="japanese-national">{t("Japanese national")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-[#D6E8FF] bg-[#F7FBFF] p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                  <ShieldCheck className="h-5 w-5 text-[#1E6FD9]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t("Medical safety")}</p>
                  <p className="text-xs text-slate-500">{t("Your information is protected with strong encryption.")}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-[#D6E8FF] bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF4FF]">
                    <Phone className="h-4 w-4 text-[#1E6FD9]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {t("Emergency contact (for clinics)")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("Used only if a clinic needs to reach someone on your behalf.")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Full name")}
                    </label>
                    <Input
                      type="text"
                      value={emergencyContactName}
                      onChange={(event) => setEmergencyContactName(event.target.value)}
                      placeholder={t("Full name")}
                      className="mt-2"
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("Phone number")}
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Select
                        value={emergencyContactCountryIso}
                        onValueChange={(value) => setEmergencyContactCountryIso(value)}
                        disabled={!isEditingProfile}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder={emergencyCountry.dialCode} />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneCountryOptions.map((option) => (
                            <SelectItem key={option.iso} value={option.iso}>
                              {option.flag} {option.name} ({option.dialCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="tel"
                        value={emergencyContactNumber}
                        onChange={(event) =>
                          setEmergencyContactNumber(formatEmergencyNumber(event.target.value))
                        }
                        placeholder={t("Phone number")}
                        className="flex-1 min-w-[180px]"
                        disabled={!isEditingProfile}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  {t("We never contact this person unless requested by a clinic.")}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t("Medical vault status")}</p>
                  <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#EAF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#1E6FD9]">
                    <Lock className="h-3.5 w-3.5" />
                    {t("End-to-End Encrypted")}
                  </div>
                </div>
                <label className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={vaultEnabled}
                    onChange={(event) => setVaultEnabled(event.target.checked)}
                    className="peer sr-only"
                    aria-label={t("Medical vault status")}
                  />
                  <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-[#1E6FD9]" />
                  <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                {t("Your data stays private and encrypted at rest and in transit.")}
              </p>
            </section>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isEditingProfile && (
              <>
                <Button type="button" className="bg-[#1E6FD9] hover:bg-[#185DB8]" onClick={handleProfileSave}>
                  {t("Save profile")}
                </Button>
                <Button type="button" variant="ghost" onClick={handleProfileCancel}>
                  {t("Cancel")}
                </Button>
              </>
            )}
            {profileSaved && <span className="text-sm text-emerald-600">{t("Profile saved.")}</span>}
            {isSyncingProfile && <span className="text-sm text-slate-500">{t("Syncing...")}</span>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              {t("Help & support")}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {t("Contact us at")}{" "}
              <a className="font-semibold text-[#1E6FD9] hover:underline" href="mailto:docnearme.jp@gmail.com">
                docnearme.jp@gmail.com
              </a>
            </p>
          </div>

          {userName && (
            <div className="lg:hidden">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 justify-center">
                <LogOut className="w-4 h-4" />
                {t("Sign out")}
              </Button>
            </div>
          )}
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
