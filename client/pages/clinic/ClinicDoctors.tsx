import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const doctors = [
  {
    name: "Dr. Hiroshi Tanaka",
    specialty: "Internal Medicine",
    availability: "Mon, Tue, Thu 09:00-17:00",
  },
  {
    name: "Dr. Aiko Sato",
    specialty: "Dermatology",
    availability: "Wed, Fri 10:00-18:00",
  },
  {
    name: "Dr. Kenji Yamamoto",
    specialty: "Orthopedics",
    availability: "Sat 09:00-13:00",
  },
];

export default function ClinicDoctors() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Doctors & staff</h1>
        <p className="text-gray-500 mt-1">
          Keep schedules up to date so patients see the right availability.
        </p>
      </header>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
        <div className="space-y-4">
          {doctors.map((doctor) => (
            <div key={doctor.name} className="border border-gray-100 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
              <p className="text-sm text-gray-500">{doctor.specialty}</p>
              <p className="text-sm text-gray-600 mt-1">
                {doctor.availability}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline">Edit</Button>
                <Button variant="outline">Time off</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Add doctor</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Name</label>
            <Input placeholder="Dr. Name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Specialty</label>
            <Input placeholder="Dermatology" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Hours</label>
            <Input placeholder="Mon-Fri 09:00-18:00" />
          </div>
        </div>
        <Button>Add</Button>
      </section>
    </div>
  );
}
