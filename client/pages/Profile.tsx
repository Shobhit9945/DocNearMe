import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { User, ShieldCheck, Bell } from "lucide-react";

export default function Profile() {
  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <h1 className="text-2xl font-bold text-[#002D55]">Profile</h1>
        <p className="text-sm text-slate-500 mt-2">Manage your personal details and preferences.</p>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="flex-1 rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#0089FF]/10">
              <User className="w-8 h-8 text-[#0089FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#002D55] mb-2">Profile Coming Soon</h2>
            <p className="text-sm text-[#556070] max-w-md mx-auto">
              Soon you'll be able to update insurance details, manage dependents and sync appointment reminders across devices.
            </p>
          </section>

          <aside className="hidden lg:flex lg:w-1/3 flex-col gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Secure medical vault</p>
                  <p className="text-xs text-slate-500">Encrypted storage for prescriptions and reports.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#0089FF]" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Smart reminders</p>
                  <p className="text-xs text-slate-500">Custom follow-ups per specialist.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFF] p-6">
              <p className="text-sm text-slate-600">
                Set your communication preferences once and we'll keep every booking, reminder and lab result perfectly in sync.
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
