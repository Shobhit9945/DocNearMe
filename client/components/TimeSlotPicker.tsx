import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useId } from "react";

interface TimeSlotPickerProps {
    slots: string[];
    selectedSlot: string | undefined;
    onSelect: (slot: string) => void;
}

export function TimeSlotPicker({ slots, selectedSlot, onSelect }: TimeSlotPickerProps) {
    const { t } = useTranslation();
    const headingId = useId();

    return (
        <div className="space-y-4">
            <h3 id={headingId} className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                {t("Select Time")}
            </h3>
            <div className="grid grid-cols-3 gap-3" role="group" aria-labelledby={headingId}>
                {slots.map((slot) => (
                    <button
                        key={slot}
                        type="button"
                        onClick={() => onSelect(slot)}
                        aria-pressed={selectedSlot === slot}
                        aria-label={t("Select time {slot}", `Select time ${slot}`).replace("{slot}", slot)}
                        className={cn(
                            "rounded-full border px-4 py-3 text-sm font-bold transition-all text-center",
                            selectedSlot === slot
                                ? "border-[#0089FF] bg-white text-[#0089FF] shadow-sm ring-1 ring-[#0089FF]"
                                : "border-slate-200 bg-white text-slate-700 hover:border-[#0089FF] hover:text-[#0089FF]"
                        )}
                    >
                        {slot}
                    </button>
                ))}
            </div>
        </div>
    );
}
