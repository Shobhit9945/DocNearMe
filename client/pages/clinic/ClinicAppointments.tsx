import React from "react";
import { Button } from "@/components/ui/button";

const appointments = [
  {
    id: "APT-001",
    name: "Sakura Yamamoto",
    time: "Today 09:30",
    type: "General Consultation",
    phone: "090-1234-5678",
    status: "Confirmed",
  },
  {
    id: "APT-002",
    name: "Haruto Sato",
    time: "Today 10:00",
    type: "Dermatology",
    phone: "080-9876-5432",
    status: "Pending",
  },
  {
    id: "APT-003",
    name: "Emily Tanaka",
    time: "Today 11:15",
    type: "Follow-up",
    phone: "070-2222-3333",
    status: "Confirmed",
  },
  {
    id: "APT-004",
    name: "Kenji Ito",
    time: "Tomorrow 13:00",
    type: "Orthopedics",
    phone: "080-5555-4444",
    status: "Pending",
  },
];

export default function ClinicAppointments() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <p className="text-gray-500 mt-1">
          Review appointments for today through next week.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{appointment.time}</p>
                <h2 className="text-lg font-semibold text-gray-900">{appointment.name}</h2>
                <p className="text-sm text-gray-500">{appointment.type}</p>
                <p className="text-sm text-gray-500 mt-1">Tel: {appointment.phone}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    appointment.status === "Confirmed"
                      ? "bg-green-50 text-green-700"
                      : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  {appointment.status === "Confirmed" ? "Confirmed" : "Pending"}
                </span>
                <Button variant="outline">Reschedule</Button>
                <Button variant="outline">Cancel</Button>
                <Button>Confirm</Button>
              </div>
            </div>
            <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              Notes: First visit. Verify insurance at check-in.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
