import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { getClinicAuthHeader, getClinicSession } from "@/lib/clinic-auth";
import { useClinicProfile } from "@/lib/clinic-data";
import type { AppointmentListResponse } from "@shared/api";

export default function ClinicDashboard() {
  const session = getClinicSession();
  const { data: clinicData } = useClinicProfile(session?.clinicId);
  const { data: appointmentsData } = useQuery<AppointmentListResponse>({
    queryKey: ["clinic-dashboard-appointments", session?.clinicId],
    queryFn: async () => {
      const response = await fetch("/api/clinic/appointments", {
        headers: {
          ...getClinicAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? "Unable to load appointments.");
      }

      return response.json() as Promise<AppointmentListResponse>;
    },
    enabled: Boolean(session?.clinicId),
  });

  const appointments = appointmentsData?.appointments ?? [];
  const todayKey = new Date().toISOString().split("T")[0];
  const todayAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (
        appointment.status === "CANCELLED_BY_PATIENT" ||
        appointment.status === "CANCELLED_BY_CLINIC" ||
        appointment.status === "DECLINED"
      ) {
        return false;
      }
      const rawDate = appointment.confirmedStart ?? appointment.preferredStart ?? appointment.date;
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0] === todayKey;
      }
      return appointment.dateKey === todayKey;
    });
  }, [appointments, todayKey]);

  const newPatientsThisWeek = useMemo(() => {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const patientIds = new Set<string>();
    appointments.forEach((appointment) => {
      const parsed = new Date(appointment.date);
      if (Number.isNaN(parsed.getTime())) return;
      if (parsed < weekStart) return;
      const key =
        appointment.patientId ??
        appointment.patientEmail ??
        appointment.patientPhone ??
        appointment.patientName ??
        appointment._id;
      if (key) patientIds.add(key);
    });
    return patientIds.size;
  }, [appointments]);

  const clinicHours = clinicData?.clinic?.hours?.weekdays ?? "09:00-18:00";
  const todayStatus =
    clinicData?.clinic?.nextAvailability?.toLowerCase() === "closed for today"
      ? "Closed for today"
      : `Clinic hours: ${clinicHours}`;

  const stats = [
    {
      label: "Appointments today",
      value: String(todayAppointments.length),
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "New patients this week",
      value: String(newPatientsThisWeek),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Here is a quick overview of today.</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>{todayStatus}</span>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Today</h2>
            <span className="text-sm text-blue-600">View all</span>
          </div>
          <div className="space-y-4">
            {todayAppointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                No appointments for today yet.
              </div>
            ) : (
              todayAppointments.map((item) => {
                const rawDate = item.confirmedStart ?? item.preferredStart ?? item.date;
                const parsed = new Date(rawDate);
                const timeLabel = Number.isNaN(parsed.getTime())
                  ? item.slot
                  : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const statusLabel = item.status === "CONFIRMED" ? "Confirmed" : "Pending";
                const statusStyle =
                  item.status === "CONFIRMED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700";

                return (
                  <div
                    key={item._id}
                    className="flex items-center justify-between border border-gray-100 rounded-lg p-4"
                  >
                    <div>
                      <p className="text-sm text-gray-500">{timeLabel}</p>
                      <p className="font-semibold text-gray-900">{item.patientName ?? "Patient"}</p>
                      <p className="text-sm text-gray-500">{item.specialization}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle}`}>
                        {statusLabel}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
