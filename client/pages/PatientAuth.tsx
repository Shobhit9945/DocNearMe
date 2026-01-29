import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageScaffold } from "@/components/PageScaffold";
import { useTranslation } from "@/lib/i18n";
import { countries } from "@/lib/countries";
import { RecaptchaWidget, type RecaptchaWidgetHandle } from "@/components/RecaptchaWidget";
import type {
  AuthResponse,
  CheckEmailRequest,
  CheckEmailResponse,
  OtpResponse,
  RequestOtpRequest,
  RequestPasswordResetRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SignupPhotoPayload,
  VerifyOtpRequest,
} from "@shared/api";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TOKEN_KEY = "docnearme_patient_token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECAPTCHA_SITE_KEY = "6LdYQFosAAAAABcfNljyySbgpKtmKKmYG4o96-qQ";

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

const initialStatus: StatusState = { type: "idle", message: "" };

const PatientAuth = () => {
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    dateOfBirth: "",
    nationality: "",
    visaType: "",
    photo: null as SignupPhotoPayload | null,
    consentAccepted: false,
  });
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [signupStep, setSignupStep] = useState<"email" | "otp" | "details">("email");
  const [checkEmailLoading, setCheckEmailLoading] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetData, setResetData] = useState({ email: "", otp: "", password: "" });
  const [resetOtpCooldown, setResetOtpCooldown] = useState(0);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpLoading, setResetOtpLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaWidgetHandle | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isSignupEmailValid = emailPattern.test(signupData.email);

  const setError = (message: string) => setStatus({ type: "error", message });
  const setSuccess = (message: string) => setStatus({ type: "success", message });
  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };
  const resetOtpState = () => {
    setOtpValue("");
    setOtpEmail("");
    setOtpVerified(false);
    setOtpSent(false);
    setOtpCooldown(0);
    setCaptchaToken(null);
    recaptchaRef.current?.reset();
  };
  const resetSignupFlow = () => {
    setSignupStep("email");
    setEmailAvailable(false);
    resetOtpState();
  };

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [otpCooldown]);

  useEffect(() => {
    if (resetOtpCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setResetOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resetOtpCooldown]);

  useEffect(() => {
    if (activeTab === "signup") {
      resetSignupFlow();
      setStatus(initialStatus);
    }
  }, [activeTab]);

  useEffect(() => {
    if (signupStep !== "otp") return;
    setCaptchaToken(null);
    recaptchaRef.current?.reset();
  }, [signupStep]);

  const validateSignup = () => {
    if (activeTab !== "signup") return true;
    if (signupStep !== "details") {
      setError("Please complete email verification before finishing signup.");
      return false;
    }
    if (signupData.name.trim().length < 2) {
      setError("Name must be at least 2 characters long.");
      return false;
    }
    if (!emailPattern.test(signupData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!signupData.dateOfBirth) {
      setError("Please provide your date of birth.");
      return false;
    }
    const dobTimestamp = Date.parse(signupData.dateOfBirth);
    if (Number.isNaN(dobTimestamp)) {
      setError("Please provide a valid date of birth.");
      return false;
    }
    if (dobTimestamp > Date.now()) {
      setError("Date of birth cannot be in the future.");
      return false;
    }
    if (signupData.nationality.trim().length < 2) {
      setError(t("Please select your country."));
      return false;
    }
    if (signupData.visaType.trim().length < 2) {
      setError("Please select your visa type.");
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
    if (!signupData.consentAccepted) {
      setError("Please provide consent to proceed with account creation.");
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
      if (!("token" in data) || !("user" in data)) {
        setError("Unexpected response from the server. Please try again.");
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem("docnearme_user_name", data.user.name);
      localStorage.setItem("docnearme_user_email", data.user.email);
      setUser(data.user);
      setSuccess(`Welcome back, ${data.user.name}!`);

      // Redirect after a short delay
      setTimeout(() => {
        navigate(endpoint === "/api/auth/signup" ? "/" : "/profile");
      }, 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkEmailAvailability = async () => {
    if (!emailPattern.test(signupData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setCheckEmailLoading(true);
    setStatus(initialStatus);

    try {
      const payload: CheckEmailRequest = { email: signupData.email };
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CheckEmailResponse;
      if (!response.ok) {
        setError(data.message || "Unable to verify email availability.");
        return;
      }

      if (data.exists) {
        setEmailAvailable(false);
        setSignupStep("email");
        setError(data.message);
        return;
      }

      setEmailAvailable(true);
      setSignupStep("otp");
      setSuccess(data.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setCheckEmailLoading(false);
    }
  };

  const handlePhotoChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file for your profile photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photos must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setError("Unable to read the selected photo. Please try another image.");
        return;
      }
      setSignupData((prev) => ({
        ...prev,
        photo: {
          dataUrl,
          fileName: file.name,
          fileType: file.type,
          size: file.size,
        },
      }));
      setPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const requestOtp = async () => {
    if (otpCooldown > 0) {
      setError(`Please wait ${formatCountdown(otpCooldown)} before requesting another code.`);
      return;
    }
    if (!emailAvailable) {
      setError("Please confirm your email availability before requesting a verification code.");
      return;
    }
    if (!emailPattern.test(signupData.email)) {
      setError("Please enter a valid email address to request a verification code.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete the captcha before requesting a verification code.");
      return;
    }

    setOtpLoading(true);
    setStatus(initialStatus);
    let shouldResetCaptcha = false;

    try {
      shouldResetCaptcha = true;
      const payload: RequestOtpRequest = { email: signupData.email, captchaToken };
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
      setOtpSent(true);
      setOtpCooldown(60);
      setSuccess(data.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setOtpLoading(false);
      if (shouldResetCaptcha) {
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
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
      setSignupStep("details");
      setSuccess(data.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const requestPasswordResetOtp = async () => {
    if (resetOtpCooldown > 0) {
      setError(`Please wait ${formatCountdown(resetOtpCooldown)} before requesting another code.`);
      return;
    }
    if (!emailPattern.test(resetData.email)) {
      setError("Please enter a valid email address to reset your password.");
      return;
    }

    setResetOtpLoading(true);
    setStatus(initialStatus);

    try {
      const payload: RequestPasswordResetRequest = { email: resetData.email };
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as OtpResponse;
      if (!response.ok || !data.success) {
        setError(data.message || "Failed to send reset code.");
        return;
      }

      setResetOtpSent(true);
      setResetOtpCooldown(60);
      setSuccess(data.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setResetOtpLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!emailPattern.test(resetData.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (resetData.otp.length < 6) {
      setError("Please enter the 6-digit reset code.");
      return;
    }
    if (resetData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setResetPasswordLoading(true);
    setStatus(initialStatus);

    try {
      const payload: ResetPasswordRequest = {
        email: resetData.email,
        otp: resetData.otp,
        password: resetData.password,
      };
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ResetPasswordResponse;
      if (!response.ok || !data.success) {
        setError(data.message || "Unable to reset password.");
        return;
      }

      setSuccess(data.message);
      setResetOpen(false);
      setResetData({ email: "", otp: "", password: "" });
      setResetOtpSent(false);
      setResetOtpCooldown(0);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setResetPasswordLoading(false);
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
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Forgot your password?</p>
                      <p className="text-xs text-slate-500">Request a one-time code to reset it.</p>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-[#0089FF]"
                      onClick={() => setResetOpen((prev) => !prev)}
                    >
                      {resetOpen ? "Hide" : "Reset password"}
                    </Button>
                  </div>
                  {resetOpen && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="patient@email.com"
                          value={resetData.email}
                          onChange={(event) =>
                            setResetData((prev) => ({ ...prev, email: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reset code</Label>
                        <InputOTP maxLength={6} value={resetData.otp} onChange={(value) =>
                          setResetData((prev) => ({ ...prev, otp: value }))
                        }>
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
                            disabled={resetOtpLoading || resetOtpCooldown > 0}
                            onClick={requestPasswordResetOtp}
                          >
                            {resetOtpLoading ? "Sending..." : "Send reset OTP"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!resetOtpSent || resetOtpLoading || resetOtpCooldown > 0}
                            onClick={requestPasswordResetOtp}
                          >
                            {resetOtpLoading
                              ? "Sending..."
                              : resetOtpCooldown > 0
                                ? `Resend in ${formatCountdown(resetOtpCooldown)}`
                                : "Resend OTP"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reset-password">New password</Label>
                        <Input
                          id="reset-password"
                          type="password"
                          placeholder="Enter a new password"
                          value={resetData.password}
                          onChange={(event) =>
                            setResetData((prev) => ({ ...prev, password: event.target.value }))
                          }
                        />
                      </div>
                      <Button
                        className="w-full"
                        type="button"
                        disabled={resetPasswordLoading}
                        onClick={resetPassword}
                      >
                        {resetPasswordLoading ? "Updating..." : "Reset password"}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit("/api/auth/signup", signupData);
                  }}
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">Signup progress</p>
                    <p>
                      Step{" "}
                      {signupStep === "email" ? "1" : signupStep === "otp" ? "2" : "3"} of 3:{" "}
                      {signupStep === "email"
                        ? "Confirm your email"
                        : signupStep === "otp"
                          ? "Verify your email"
                          : "Complete your profile"}
                    </p>
                  </div>

                  {signupStep === "email" && (
                    <div className="space-y-4">
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
                            resetSignupFlow();
                            setStatus(initialStatus);
                          }}
                        />
                        <p className="text-xs text-slate-500">
                          We&apos;ll check if the email is already registered before sending the verification code.
                        </p>
                      </div>
                      {isSignupEmailValid && (
                        <div className="space-y-2">
                          <Label>Security check</Label>
                          <RecaptchaWidget
                            ref={recaptchaRef}
                            siteKey={RECAPTCHA_SITE_KEY}
                            onVerify={setCaptchaToken}
                            onExpire={() => setCaptchaToken(null)}
                            onError={() => setCaptchaToken(null)}
                          />
                          <p className="text-xs text-slate-500">
                            Complete the captcha to unlock verification for this email.
                          </p>
                        </div>
                      )}
                      <Button
                        type="button"
                        className="w-full"
                        disabled={checkEmailLoading}
                        onClick={checkEmailAvailability}
                      >
                        {checkEmailLoading ? "Checking..." : "Check email"}
                      </Button>
                    </div>
                  )}

                  {signupStep === "otp" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Verify your email</p>
                          <p className="text-xs text-slate-500">{signupData.email}</p>
                        </div>
                        <Button type="button" variant="link" className="px-0 text-[#0089FF]" onClick={resetSignupFlow}>
                          Change email
                        </Button>
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
                        <div className="space-y-2">
                          <Label>Security check</Label>
                          <RecaptchaWidget
                            ref={recaptchaRef}
                            siteKey={RECAPTCHA_SITE_KEY}
                            onVerify={setCaptchaToken}
                            onExpire={() => setCaptchaToken(null)}
                            onError={() => setCaptchaToken(null)}
                          />
                          {captchaToken ? (
                            <p className="text-xs font-medium text-emerald-600">
                              Captcha completed. You can send your verification code.
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Complete the captcha to enable sending your verification code.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={otpLoading || otpCooldown > 0 || !captchaToken}
                            onClick={requestOtp}
                          >
                            {otpLoading ? "Sending..." : "Send OTP"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!otpSent || otpLoading || otpCooldown > 0 || !captchaToken}
                            onClick={requestOtp}
                          >
                            {otpLoading
                              ? "Sending..."
                              : otpCooldown > 0
                                ? `Resend in ${formatCountdown(otpCooldown)}`
                                : "Resend OTP"}
                          </Button>
                          <Button type="button" disabled={otpLoading || otpValue.length < 6} onClick={verifyOtpCode}>
                            {otpLoading ? "Verifying..." : "Verify OTP"}
                          </Button>
                          {otpVerified && (
                            <span className="text-sm font-medium text-emerald-600">Email verified</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {signupStep === "details" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Email verified</p>
                          <p className="text-xs text-slate-500">{signupData.email}</p>
                        </div>
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 text-[#0089FF]"
                          onClick={() => setSignupStep("otp")}
                        >
                          Back to verification
                        </Button>
                      </div>

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
                        <Label htmlFor="signup-dob">Date of birth</Label>
                        <Input
                          id="signup-dob"
                          type="date"
                          value={signupData.dateOfBirth}
                          onChange={(event) =>
                            setSignupData((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Country")}</Label>
                        <Select
                          value={signupData.nationality}
                          onValueChange={(value) => setSignupData((prev) => ({ ...prev, nationality: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("Select your country")} />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country} value={country}>
                                {t(country)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                          {t("Select your country from the list.")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Visa type</Label>
                        <Select
                          value={signupData.visaType}
                          onValueChange={(value) => setSignupData((prev) => ({ ...prev, visaType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your visa type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tourist">Tourist</SelectItem>
                            <SelectItem value="resident-work">Resident (work visa)</SelectItem>
                            <SelectItem value="resident-student">Resident (student visa)</SelectItem>
                            <SelectItem value="resident-family">Resident (family/dependent)</SelectItem>
                            <SelectItem value="resident-permanent">Resident (permanent)</SelectItem>
                            <SelectItem value="resident-long-term">Resident (long-term)</SelectItem>
                            <SelectItem value="resident-other">Resident (other)</SelectItem>
                            <SelectItem value="japanese-national">Japanese national</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                          This helps clinics prepare registration paperwork ahead of your visit.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Profile photo (optional)</Label>
                        <div className="space-y-3 rounded-lg border border-dashed border-slate-200 p-4">
                          <div className="flex flex-wrap gap-2">
                            <Button asChild type="button" variant="secondary">
                              <label htmlFor="signup-photo-upload">Upload from gallery</label>
                            </Button>
                            <Button asChild type="button" variant="secondary">
                              <label htmlFor="signup-photo-selfie">Take selfie</label>
                            </Button>
                            <input
                              id="signup-photo-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? null)}
                            />
                            <input
                              id="signup-photo-selfie"
                              type="file"
                              accept="image/*"
                              capture="user"
                              className="hidden"
                              onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? null)}
                            />
                          </div>
                          {photoPreview ? (
                            <div className="flex flex-wrap items-center gap-4">
                              <img
                                src={photoPreview}
                                alt="Profile preview"
                                className="h-20 w-20 rounded-lg object-cover"
                              />
                              <div className="text-xs text-slate-500">
                                <p className="font-semibold text-slate-700">{signupData.photo?.fileName}</p>
                                <p>{signupData.photo?.fileType}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-slate-500"
                                onClick={() => {
                                  setSignupData((prev) => ({ ...prev, photo: null }));
                                  setPhotoPreview(null);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">Optional. Max size 5MB.</p>
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
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">Consent for medical data handling (Japan APPI)</p>
                        <p>
                          I consent to DocNearMe collecting, using, and securely storing my personal information,
                          including health-related data, in compliance with Japan&apos;s Act on the Protection of
                          Personal Information (APPI), for account creation, care coordination, and secure service
                          delivery.
                        </p>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={signupData.consentAccepted}
                            onChange={(event) =>
                              setSignupData((prev) => ({ ...prev, consentAccepted: event.target.checked }))
                            }
                          />
                          <span>I agree and provide my explicit consent.</span>
                        </label>
                      </div>
                      <Button className="w-full" disabled={isSubmitting} type="submit">
                        {isSubmitting ? "Creating account..." : "Create account"}
                      </Button>
                    </div>
                  )}
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
