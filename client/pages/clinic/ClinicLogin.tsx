import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClinicLogin() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Clinic login</h1>
          <p className="text-sm text-gray-500 mt-2">
            Sign in with the clinic admin email provided during onboarding.
          </p>
        </div>
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Email</label>
            <Input type="email" placeholder="clinic@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Password</label>
            <Input type="password" placeholder="********" />
          </div>
          <Button className="w-full">Sign in</Button>
          <p className="text-xs text-gray-500 text-center">
            You will receive your first login details from DocNearMe.
          </p>
        </form>
      </div>
    </div>
  );
}
