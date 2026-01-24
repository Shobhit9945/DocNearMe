import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClinicInfo() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Clinic info</h1>
        <p className="text-gray-500 mt-1">
          Update hours, pricing, and photos in one place.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Basic info</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Clinic name</label>
            <Input defaultValue="DocNearMe Shibuya Clinic" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Address</label>
            <Input defaultValue="1-2-3 Shibuya, Tokyo" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Phone</label>
            <Input defaultValue="03-1234-5678" />
          </div>
          <Button>Save</Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Clinic hours</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Weekdays</label>
              <Input defaultValue="09:00 - 18:00" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Weekend</label>
              <Input defaultValue="10:00 - 14:00" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Closed days</label>
            <Input defaultValue="Wednesday, National Holidays" />
          </div>
          <Button variant="outline">Update hours</Button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">First visit</label>
              <Input defaultValue="¥3,000" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Follow-up</label>
              <Input defaultValue="¥1,500" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Other services</label>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue="PCR test ¥6,000, Vaccination ¥4,500"
            />
          </div>
          <Button>Save</Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Photos</h2>
          <div className="grid grid-cols-3 gap-3">
            {["Waiting room", "Reception", "Exam room"].map((label) => (
              <div key={label} className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                <div className="h-20 bg-gray-50 rounded-md mb-2" />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <Button variant="outline">Add photo</Button>
        </section>
      </div>
    </div>
  );
}
