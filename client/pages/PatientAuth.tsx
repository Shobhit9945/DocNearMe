import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageScaffold } from "@/components/PageScaffold";
import type { AuthResponse, OtpResponse, RequestOtpRequest, VerifyOtpRequest } from "@shared/api";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const TOKEN_KEY = "docnearme_patient_token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [otpValue, setOtpValue] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const navigate = useNavigate();

  const setError = (message: string) => setStatus({ type: "error", message });
  const setSuccess = (message: string) => setStatus({ type: "success", message });

  const validateSignup = () => {
    if (activeTab !== "signup") return true;
    if (signupData.name.trim().length < 2) {
      setError("Name must be at least 2 characters long.");
      return false;
    }
    if (!emailPattern.test(signupData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (signupData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return false;
    }
    if (!otpVerified || signupData.email.toLowerCase() !== otpEmail.toLowerCase()) {
      setError("Please verify your email with the OTP before signing up.");
      return false;
    }
    return true;
  };

  const validateLogin = () => {
    if (activeTab !== "login") return true;
    if (!emailPattern.test(loginData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (loginData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (endpoint: "/api/auth/signup" | "/api/auth/login", payload: object) => {
    if (endpoint === "/api/auth/signup" && !validateSignup()) {
      return;
    }
    if (endpoint === "/api/auth/login" && !validateLogin()) {
      return;
    }
    
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
      localStorage.setItem("docnearme_user_name", data.user.name);
      localStorage.setItem("docnearme_user_email", data.user.email);
      setUser(data.user);
      setSuccess(`Welcome back, ${data.user.name}!`);

      // Redirect to profile after a short delay
      setTimeout(() => {
         navigate("/profile");
      }, 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestOtp = async () => {
    if (!emailPattern.test(signupData.email)) {
      setError("Please enter a valid email address to request a verification code.");
      return;
    }

    setOtpLoading(true);
    setStatus(initialStatus);

    try {
      const payload: RequestOtpRequest = { email: signupData.email };
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as OtpResponse;
      if (!response.ok || !data.success) {
        setError(data.message || "Failed to send verification code.");
        return;
      }

      setOtpEmail(signupData.email);
      setOtpVerified(false);
      setOtpValue("");
      setSuccess(data.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtpCode = async () => {
    if (!otpValue || otpValue.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setOtpLoading(true);
    setStatus(initialStatus);

    try {
      const payload: VerifyOtpRequest = { email: signupData.email, otp: otpValue };
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as OtpResponse;
      if (!response.ok || !data.success) {
        setError(data.message || "Verification failed.");
        return;
      }

      setOtpVerified(true);
      setOtpEmail(signupData.email);
      setSuccess(data.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setOtpLoading(false);
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
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit("/api/auth/login", loginData);
                  }}
                >
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
                  <Button className="w-full" disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit("/api/auth/signup", signupData);
                  }}
                >
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
                      onChange={(event) => {
                        const nextEmail = event.target.value;
                        setSignupData((prev) => ({ ...prev, email: nextEmail }));
                        if (otpEmail && nextEmail.toLowerCase() !== otpEmail.toLowerCase()) {
                          setOtpVerified(false);
                          setOtpValue("");
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Verification code</Label>
                    <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={otpLoading}
                        onClick={requestOtp}
                      >
                        {otpLoading ? "Sending..." : "Send OTP"}
                      </Button>
                      <Button type="button" disabled={otpLoading || otpValue.length < 6} onClick={verifyOtpCode}>
                        {otpLoading ? "Verifying..." : "Verify OTP"}
                      </Button>
                      {otpVerified && (
                        <span className="text-sm font-medium text-emerald-600">Email verified</span>
                      )}
                    </div>
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
                  <Button className="w-full" disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </Button>
                </form>
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
