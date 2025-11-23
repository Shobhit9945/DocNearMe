import { Calendar } from "@/components/ui/calendar";

interface AppointmentCalendarProps {
    selectedDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
}

export function AppointmentCalendar({ selectedDate, onSelect }: AppointmentCalendarProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Select Date</h3>
            <div className="p-6 border rounded-3xl bg-white shadow-sm flex justify-center">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={onSelect}
                    className="rounded-md border-0"
                    classNames={{
                        day_selected: "bg-[#0089FF] text-white hover:bg-[#0089FF] hover:text-white focus:bg-[#0089FF] focus:text-white",
                        day_today: "bg-slate-100 text-slate-900",
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
            </div>
        </div>
    );
}
