"use client";

import React, { useState } from "react";
import { AgrosmartLogo } from "@/components/ui/AgrosmartLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveSession } from "@/lib/session";

interface LoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

interface FormState {
  email: string;
  password: string;
  emailError: string;
  passwordError: string;
}

function validateEmail(email: string): string {
  if (!email) return "Email address is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address";
  return "";
}

function validatePassword(password: string): string {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  return "";
}

export default function Login({ onSuccess, onBack }: LoginProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    emailError: "",
    passwordError: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: "email" | "password", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      [`${field}Error`]: "",
    }));
  };

  const handleBlur = (field: "email" | "password") => {
    const error =
      field === "email" ? validateEmail(form.email) : validatePassword(form.password);
    setForm((prev) => ({ ...prev, [`${field}Error`]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (emailError || passwordError) {
      setForm((prev) => ({ ...prev, emailError, passwordError }));
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);

    // Persist the session so a page refresh / new tab keeps the user logged in.
    saveSession({ loggedIn: true, user: form.email.split("@")[0] || "Mohamed" });

    toast("Authentication successful — Welcome to AgroSmart", "success");
    setTimeout(onSuccess, 400);
  };

  return (
    <div
      className="h-full w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(0,200,150,0.05) 0%, transparent 70%)",
        }}
      />

      {/* Grid lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(42,42,51,0.6) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(42,42,51,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-5 left-6 z-10 flex items-center gap-1.5 text-xs text-[#9898a8] hover:text-[#f4f4f6] transition-colors duration-150"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to home
      </button>

      {/* Auth card */}
      <div className="animate-fade-in-up relative z-10 w-full max-w-sm mx-4">
        {/* Top glow border */}
        <div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(0,200,150,0.2) 0%, transparent 50%, transparent 100%)",
          }}
        />

        <div
          className="relative rounded-2xl border border-[#2a2a33] p-8 flex flex-col gap-6"
          style={{ background: "var(--bg-secondary)" }}
        >
          {/* Logo + title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <AgrosmartLogo variant="wordmark" theme="dark" iconSize={34} />
            <div>
              <h1 className="text-lg font-semibold text-[#f4f4f6] tracking-tight">Connexion</h1>
              <p className="text-xs text-[#9898a8] mt-0.5">
                AI-powered water stress prediction platform
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#1e1e24]" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              id="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              error={form.emailError}
              disabled={loading}
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              error={form.passwordError}
              disabled={loading}
            />

            <div className="flex items-center justify-between text-[11px] mt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-[#9898a8] hover:text-[#f4f4f6] transition-colors">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-[#3a3a47] bg-[#111114] accent-[#00c896]"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-[#00c896] hover:text-[#00a87b] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-1 w-full font-semibold"
            >
              {loading ? "Authenticating…" : "Sign In"}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-[11px] text-[#5a5a6a]">
            Demo credentials work with any valid email format and{" "}
            <span className="text-[#9898a8]">6+ character password</span>.
          </p>
        </div>

        {/* Metadata strip */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <Badge variant="green" className="text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00c896] animate-pulse" />
            Model Ready
          </Badge>
          <Badge variant="neutral" className="text-[10px]">Souss-Massa · 2024</Badge>
          <Badge variant="neutral" className="text-[10px]">U-Net · 92.4% F1</Badge>
        </div>
      </div>
    </div>
  );
}
