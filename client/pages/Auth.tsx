import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthResponse } from "@shared/api";
import { PageScaffold } from "@/components/PageScaffold";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";

const patientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [patientMode, setPatientMode] = useState<"login" | "signup">("login");
  const [patientForm, setPatientForm] = useState({ name: "", email: "", password: "" });
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const validated =
        patientMode === "signup"
          ? patientSchema.parse(patientForm)
          : loginSchema.parse({ email: patientForm.email, password: patientForm.password });

      setLoading(true);
      const endpoint = patientMode === "signup" ? "/api/auth/patient/signup" : "/api/auth/patient/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Unable to continue");
      }

      const data = (await res.json()) as AuthResponse;
      login(data);
      navigate("/appointment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const validated = loginSchema.parse(adminForm);
      setLoading(true);
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Unable to login");
      }

      const data = (await res.json()) as AuthResponse;
      login(data);
      navigate("/admin/bookings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageScaffold contentClassName="pb-10">
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="mb-8 text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#0089FF] font-semibold">Secure access</p>
          <h1 className="text-3xl font-bold text-slate-900">Sign in to DocNearMe</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Patients can create an account to manage bookings, while administrators can review every appointment across clinics.
          </p>
        </div>

        <Tabs defaultValue="patient" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[360px]">
            <TabsTrigger value="patient">Patient login / sign up</TabsTrigger>
            <TabsTrigger value="admin">Admin login</TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="patient">
            <Card className="shadow-sm border border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{patientMode === "signup" ? "Create a patient account" : "Patient sign in"}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPatientMode((prev) => (prev === "signup" ? "login" : "signup"))}
                  >
                    {patientMode === "signup" ? "Use existing account" : "Create account"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handlePatientSubmit}>
                  {patientMode === "signup" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="patient-name">
                        Full name
                      </label>
                      <Input
                        id="patient-name"
                        value={patientForm.name}
                        onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                        placeholder="Alex Patient"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="patient-email">
                      Email
                    </label>
                    <Input
                      id="patient-email"
                      type="email"
                      value={patientForm.email}
                      onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="patient-password">
                      Password
                    </label>
                    <Input
                      id="patient-password"
                      type="password"
                      value={patientForm.password}
                      onChange={(e) => setPatientForm({ ...patientForm, password: e.target.value })}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? "Working..."
                      : patientMode === "signup"
                      ? "Create account"
                      : "Sign in"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin">
            <Card className="shadow-sm border border-slate-200">
              <CardHeader>
                <CardTitle>Admin access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
                  Use the admin credentials configured in the server environment. Clinic-level sign-ins will reuse this flow when
                  you provision individual accounts.
                </div>
                <form className="space-y-4" onSubmit={handleAdminSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="admin-email">
                      Admin email
                    </label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      placeholder="admin@docnearme.local"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="admin-password">
                      Password
                    </label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageScaffold>
  );
}
