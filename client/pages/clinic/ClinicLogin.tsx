import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { setClinicSession } from "@/lib/clinic-auth";
import type { ClinicLoginResponse } from "@shared/api";

export default function ClinicLogin() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/clinic-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? "Unable to sign in.");
      }

      const data = (await response.json()) as ClinicLoginResponse;
      setClinicSession({ token: data.token, clinicId: data.clinicId });
      toast({ title: "Welcome back!", description: "Clinic access granted." });
      navigate("/");
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Clinic login</h1>
          <p className="text-sm text-gray-500 mt-2">
            Sign in with the clinic admin email provided during onboarding.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">User ID</label>
            <Input
              type="text"
              placeholder="noguchi-admin"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Password</label>
            <Input
              type="password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-xs text-gray-500 text-center">
            Use the credentials generated for your clinic during onboarding.
          </p>
        </form>
      </div>
    </div>
  );
}
