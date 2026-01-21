import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { User, ShieldCheck, Bell, LogOut } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("Japanese");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const loadProfileFromStorage = () => {
    const storedProfile = localStorage.getItem("docnearme_profile");
    if (!storedProfile) {
      setProfileEmail("");
      setProfilePhone("");
      setProfileAddress("");
      setEmergencyContact("");
      setPreferredLanguage("Japanese");
      setNotificationsEnabled(true);
      return;
    }

    const parsed = JSON.parse(storedProfile) as {
      email?: string;
      phone?: string;
      address?: string;
      emergencyContact?: string;
      preferredLanguage?: string;
      notificationsEnabled?: boolean;
    };
    setProfileEmail(parsed.email ?? "");
    setProfilePhone(parsed.phone ?? "");
    setProfileAddress(parsed.address ?? "");
    setEmergencyContact(parsed.emergencyContact ?? "");
    setPreferredLanguage(parsed.preferredLanguage ?? "Japanese");
    setNotificationsEnabled(parsed.notificationsEnabled ?? true);
  };

  useEffect(() => {
    const storedName = localStorage.getItem("docnearme_user_name");
    if (storedName) {
      setUserName(storedName);
    }
    loadProfileFromStorage();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("docnearme_patient_token");
    localStorage.removeItem("docnearme_user_name");
    setUserName(null);
    navigate("/");
  };

  const handleProfileSave = () => {
    localStorage.setItem(
      "docnearme_profile",
      JSON.stringify({
        email: profileEmail,
        phone: profilePhone,
        address: profileAddress,
        emergencyContact,
        preferredLanguage,
        notificationsEnabled,
      })
    );
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
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-[#002D55]">{t("Profile")}</h1>
           <p className="text-sm text-slate-500 mt-2">{t("Manage your personal details and preferences.")}</p>
        </div>
        {userName && (
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2">
            <LogOut className="w-4 h-4" />
            {t("Sign out")}
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="flex-1 rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#0089FF]/10 flex items-center justify-center">
                <User className="w-6 h-6 text-[#0089FF]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Account</p>
                <p className="text-lg font-bold text-[#002D55]">
                  {userName ? userName : t("Guest profile")}
                </p>
                <p className="text-sm text-slate-600">
                  {userName ? t("You are signed in to DocNearMe.") : t("Sign in to personalize your profile.")}
                </p>
              </div>
            </div>
            {!userName && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-[#F5FAFF] text-[#1648CE] rounded-full text-xs font-semibold">
                  {t("Public access")}
                </span>
                <p className="text-sm text-slate-600">
                  {t("Book appointments without an account, or sign in to save your profile details.")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#0089FF] hover:bg-[#0077E6]"
                  onClick={() => navigate("/patient-auth")}
                >
                  {t("Login")}
                </Button>
              </div>
            )}
          </section>

          <section className="flex-1 rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0089FF]/10">
                  <User className="w-6 h-6 text-[#0089FF]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#002D55]">{t("Profile details")}</h2>
                  <p className="text-sm text-[#556070]">{t("Update your contact and care preferences.")}</p>
                </div>
              </div>
              {!isEditingProfile && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#0089FF] text-[#0089FF] hover:bg-[#E8F3FF]"
                  onClick={() => {
                    setIsEditingProfile(true);
                    setProfileSaved(false);
                  }}
                >
                  {t("Edit info")}
                </Button>
              )}
            </div>
            <div className="mt-6 grid gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("Email address")}
                </label>
                <Input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  placeholder="you@example.com"
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
                  placeholder="+81 90 0000 0000"
                  className="mt-2"
                  disabled={!isEditingProfile}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("Home address")}
                </label>
                <Input
                  type="text"
                  value={profileAddress}
                  onChange={(event) => setProfileAddress(event.target.value)}
                  placeholder="Chiyoda-ku, Tokyo"
                  className="mt-2"
                  disabled={!isEditingProfile}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("Emergency contact")}
                </label>
                <Input
                  type="text"
                  value={emergencyContact}
                  onChange={(event) => setEmergencyContact(event.target.value)}
                  placeholder="Name + phone"
                  className="mt-2"
                  disabled={!isEditingProfile}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("Preferred language")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Japanese", "English", "Korean", "Mandarin"].map((language) => (
                    <button
                      key={language}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        preferredLanguage === language
                          ? "border-[#0089FF] bg-[#0089FF]/10 text-[#1648CE]"
                          : "border-slate-200 text-slate-500 hover:border-[#0089FF]/40"
                      } ${!isEditingProfile ? "cursor-not-allowed opacity-60" : ""}`}
                      onClick={() => setPreferredLanguage(language)}
                      disabled={!isEditingProfile}
                    >
                      {t(language)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(event) => setNotificationsEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0089FF] focus:ring-[#0089FF]"
                  disabled={!isEditingProfile}
                />
                {t("Send me appointment reminders and care tips.")}
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isEditingProfile && (
                <>
                  <Button type="button" className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={handleProfileSave}>
                    {t("Save profile")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleProfileCancel}>
                    {t("Cancel")}
                  </Button>
                </>
              )}
              {profileSaved && <span className="text-sm text-emerald-600">{t("Profile saved.")}</span>}
            </div>
          </section>

          <aside className="hidden lg:flex lg:w-1/3 flex-col gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{t("Secure medical vault")}</p>
                  <p className="text-xs text-slate-500">{t("Encrypted storage for prescriptions and reports.")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{t("Smart reminders")}</p>
                  <p className="text-xs text-slate-500">{t("Custom follow-ups per specialist.")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFF] p-6">
              <p className="text-sm text-slate-600">
                {t(
                  "Set your communication preferences once and we'll keep every booking, reminder and lab result perfectly in sync."
                )}
              </p>
            </div>
          </aside>
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
