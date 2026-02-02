import { useQuery } from "@tanstack/react-query";
import { AppointmentListResponse } from "@shared/api";
import { PageScaffold } from "@/components/PageScaffold";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TranslatedText } from "@/components/TranslatedText";

function formatDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminBookings() {
  const { data, isLoading } = useQuery<AppointmentListResponse>({
    queryKey: ["admin-appointments"],
    queryFn: async () => {
      const res = await fetch("/api/appointments");
      if (!res.ok) throw new Error("Unable to load appointments");
      return (await res.json()) as AppointmentListResponse;
    },
    enabled: true,
  });

  return (
    <PageScaffold contentClassName="pb-10">
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#0089FF] font-semibold">Bookings console</p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-slate-900">All appointments</h1>
            <Badge variant="secondary">{data?.appointments.length ?? 0} bookings</Badge>
          </div>
          <p className="text-slate-600 max-w-3xl">
            View every appointment in a single place. Clinic-level filtering can be added once multi-clinic access is needed.
          </p>
        </div>

        <Card className="shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle>Upcoming bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-slate-600">Loading appointments…</div>
            ) : (data?.appointments.length ?? 0) > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & time</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Visa type</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.appointments.map((appt) => (
                      <TableRow key={appt._id}>
                        <TableCell className="font-medium">{formatDate(appt.date)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">
                              <TranslatedText text={appt.patientName ?? "Unknown"} inline />
                            </span>
                            <span className="text-xs text-slate-500">{appt.patientEmail ?? "Hidden"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{appt.specialization}</span>
                            <span className="text-xs text-slate-500">{appt.slot}</span>
                          </div>
                        </TableCell>
                        <TableCell>{appt.clinicId || "global"}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {appt.patientVisaType ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-slate-600">
                          {appt.notes?.trim() ? <TranslatedText text={appt.notes} inline /> : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500">No appointments found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageScaffold>
  );
}
