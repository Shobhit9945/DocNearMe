import { ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageScaffold } from "@/components/PageScaffold";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PolicySection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type RelatedPolicy = {
  label: string;
  href: string;
};

interface PolicyDocumentProps {
  badge: string;
  title: string;
  summary: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: PolicySection[];
  relatedPolicies: RelatedPolicy[];
}

export function PolicyDocument({
  badge,
  title,
  summary,
  effectiveDate,
  lastUpdated,
  sections,
  relatedPolicies,
}: PolicyDocumentProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  return (
    <PageScaffold contentClassName="pb-10">
      <main className="px-4 pt-16 pb-6 lg:px-10 lg:pt-14">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={handleBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[#0089FF] font-semibold">{badge}</p>
            <h1 className="mt-2 text-3xl font-bold text-[#002D55]">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                Effective: {effectiveDate}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                Last updated: {lastUpdated}
              </span>
            </div>
          </header>

          {sections.map((section, index) => (
            <Card key={section.title} className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-slate-700">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-base font-semibold text-slate-900">Related policies</h2>
              <p className="mt-2 text-sm text-slate-600">
                These documents work together and should be read as a set.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedPolicies.map((policy) => (
                  <Link
                    key={policy.href}
                    to={policy.href}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50"
                  >
                    {policy.label}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageScaffold>
  );
}
