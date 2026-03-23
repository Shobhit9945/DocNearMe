import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star } from "lucide-react";
import { useClinics } from "@/lib/clinic-data";
import { getSpecializationLabel } from "@/lib/specializations";
import { useTranslation } from "@/lib/i18n";

interface ClinicRecommendationWidgetProps {
  specialization: string;
}

export const ClinicRecommendationWidget: React.FC<ClinicRecommendationWidgetProps> = ({
  specialization,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data } = useClinics();

  const label = getSpecializationLabel(specialization);

  const matchingClinics = (data?.clinics ?? [])
    .filter((c) => c.specializations.includes(specialization))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  if (matchingClinics.length === 0) return null;

  return (
    <div className="space-y-3 mt-2">
      <p className="text-sm font-semibold text-[#002D55]">
        {t("Top clinics for")} <span className="text-[#3A12DB]">{label}</span>
      </p>
      <div className="space-y-2">
        {matchingClinics.map((clinic) => (
          <div
            key={clinic.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{clinic.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5 text-amber-500">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-xs font-medium">{clinic.rating.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-0.5 text-slate-500">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs truncate">{clinic.location}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/clinics/${clinic.id}`)}
              className="ml-3 shrink-0 rounded-lg bg-[#3A12DB] px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-[#2A0F9D] transition-colors"
            >
              {t("Book")}
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate(`/clinics?specialization=${encodeURIComponent(specialization)}`)}
        className="w-full rounded-xl border border-[#3A12DB] py-2 text-sm font-semibold text-[#3A12DB] hover:bg-[#F2EEFF] transition-colors"
      >
        {t("View all clinics with")} {label}
      </button>
    </div>
  );
};
