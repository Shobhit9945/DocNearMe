import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { Search as SearchIcon, ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Search() {
  const { t } = useTranslation();
  const roadmapItems = [
    "Specialty search with DocDaisy hand-off",
    "Realtime slot availability",
    "Saved providers & favourites",
  ];

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-10 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <h1 className="text-2xl font-bold text-[#002D55]">{t("Search")}</h1>
        <p className="text-sm text-slate-500 mt-2">{t("specialists, clinics and hospitals nearby.")}</p>
      </header>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="flex-1 rounded-[24px] border border-dashed border-[#0089FF]/40 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#0089FF]/10">
              <SearchIcon className="w-8 h-8 text-[#0089FF]" />
            </div>
            <h2 className="text-xl font-bold text-[#002D55] mb-2">{t("Search Coming Soon")}</h2>
            <p className="text-sm text-[#556070] max-w-md mx-auto">
              {t(
                "We're crafting a smarter way to discover nearby doctors and clinics. Filter by specialization, insurance and availability."
              )}
            </p>
          </section>

          <aside className="hidden lg:flex lg:w-1/3 flex-col gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t("Roadmap sneak peek")}</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {roadmapItems.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-[#0089FF]" /> {t(item)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFF] p-6">
              <p className="text-sm text-slate-600">
                {t(
                  "Need urgent help finding a doctor? Start a conversation with DocDaisy to get a recommendation instantly."
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
