import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeartPulse, Stethoscope, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

type AuthMode = "login" | "signup";
type RoleOption = "patient" | "clinic";

const roleStyles: Record<RoleOption, { border: string; icon: string }> = {
  patient: { border: "border-primary bg-primary/5", icon: "text-primary" },
  clinic: { border: "border-lavender bg-lavender/10", icon: "text-lavender" },
};

export const Auth: React.FC = () => {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<RoleOption>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSignup = mode === "signup";
  const submitLabel = useMemo(() => {
    if (isLoading) return t("loading");
    return isSignup ? t("signUp") : t("login");
  }, [isLoading, isSignup, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    const normalizedEmail = email.trim();

    try {
      if (isSignup) {
        const normalizedFullName = fullName.trim();
        if (!normalizedFullName) {
          toast.error("Full name is required.");
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters.");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }
        const { error } = await signUp({
          email: normalizedEmail,
          password,
          role,
          fullName: normalizedFullName,
        });
        if (error) {
          toast.error(error);
          return;
        }
        toast.success(t("signupSuccess"));
      } else {
        const { error } = await signIn(normalizedEmail, password);
        if (error) {
          toast.error(error);
          return;
        }
        toast.success(t("loginSuccess"));
      }
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-gradient">{t("DocNearMe")}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card variant="glass" className="w-full max-w-md animate-slide-up">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">{isSignup ? t("createAccount") : t("welcomeBack")}</CardTitle>
            <CardDescription>{t("tagline")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {(["patient", "clinic"] as RoleOption[]).map((value) => {
                const active = role === value;
                const style = roleStyles[value];
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300",
                      active ? style.border : "border-border hover:border-primary/40",
                    )}
                  >
                    {value === "patient" ? (
                      <HeartPulse className={cn("h-8 w-8", active ? style.icon : "text-muted-foreground")} />
                    ) : (
                      <Stethoscope className={cn("h-8 w-8", active ? style.icon : "text-muted-foreground")} />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium capitalize",
                        active ? style.icon : "text-muted-foreground",
                      )}
                    >
                      {value === "patient" ? t("iAmPatient") : t("iAmClinic")}
                    </span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Jane Doe"
                    required
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    required
                    className="rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    required
                    className="rounded-xl"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                variant={role === "patient" ? "gradient" : "lavender"}
                size="lg"
                disabled={isLoading}
              >
                {submitLabel}
              </Button>
            </form>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isSignup ? t("alreadyHaveAccount") : t("dontHaveAccount")}
              </span>{" "}
              <button
                type="button"
                onClick={() => setMode(isSignup ? "login" : "signup")}
                className="text-primary font-medium hover:underline"
              >
                {isSignup ? t("login") : t("signUp")}
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
