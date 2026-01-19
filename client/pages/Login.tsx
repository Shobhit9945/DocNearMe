import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

type LoginRole = "patient" | "clinic";

const Login = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<LoginRole>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Login failed");
      }

      setStatus("idle");
      navigate(data.redirectTo ?? (role === "clinic" ? "/clinic" : "/"));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to log in");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <h1 className="text-3xl font-semibold">DocNearMe Login</h1>
          <p className="mt-2 text-sm text-slate-300">
            Sign in as a patient or clinic to continue.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-200">Role</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    role === "patient"
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                      : "border-slate-700 text-slate-300"
                  }`}
                  onClick={() => setRole("patient")}
                >
                  Patient Login
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    role === "clinic"
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-slate-700 text-slate-300"
                  }`}
                  onClick={() => setRole("clinic")}
                >
                  Clinic Login
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {status === "error" ? (
              <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Patient logins continue to the main DocNearMe experience. Clinics are redirected to
          their dashboard.
        </p>
      </div>
    </div>
  );
};

export default Login;
