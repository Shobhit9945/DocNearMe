import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageScaffold } from "@/components/PageScaffold";
import type { AuthResponse } from "@shared/api";

const TOKEN_KEY = "docnearme_patient_token";

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

const initialStatus: StatusState = { type: "idle", message: "" };

const PatientAuth = () => {
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "" });
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setError = (message: string) => setStatus({ type: "error", message });
  const setSuccess = (message: string) => setStatus({ type: "success", message });

  const handleSubmit = async (endpoint: "/api/auth/signup" | "/api/auth/login", payload: object) => {
    setIsSubmitting(true);
    setStatus(initialStatus);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as AuthResponse | { error?: string };
      if (!response.ok) {
        const errorMessage = "error" in data && data.error ? data.error : "Something went wrong. Please try again.";
        setError(errorMessage);
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      setSuccess(`Welcome back, ${data.user.name}!`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageScaffold contentClassName="py-8 px-4 lg:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Patient Access</p>
          <h1 className="text-2xl font-bold text-slate-900">Sign in or create your patient profile</h1>
          <p className="text-sm text-slate-500">
            Use your email to access appointments, manage bookings, and keep track of your care.
          </p>
          <Link to="/" className="text-sm font-medium text-[#0089FF] hover:underline">
            Back to home
          </Link>
        </div>

        {status.type !== "idle" && (
          <Alert variant={status.type === "error" ? "destructive" : "default"}>
            <AlertTitle>{status.type === "error" ? "Authentication failed" : "Success"}</AlertTitle>
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Patient login</CardTitle>
            <CardDescription>Secure access to your DocNearMe patient account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="patient@email.com"
                    value={loginData.email}
                    onChange={(event) => setLoginData((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit("/api/auth/login", loginData)}
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Jane Doe"
                    value={signupData.name}
                    onChange={(event) => setSignupData((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="patient@email.com"
                    value={signupData.email}
                    onChange={(event) => setSignupData((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={signupData.password}
                    onChange={(event) => setSignupData((prev) => ({ ...prev, password: event.target.value }))}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit("/api/auth/signup", signupData)}
                >
                  {isSubmitting ? "Creating account..." : "Create account"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {user && (
          <Card>
            <CardHeader>
              <CardTitle>Signed in patient</CardTitle>
              <CardDescription>Session details stored locally in your browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">Name:</span> {user.name}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Email:</span> {user.email}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Member since:</span>{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageScaffold>
  );
};

export default PatientAuth;
