"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import "../login/login.css";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("reset");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    setMode(params.get("mode") === "setup" ? "setup" : "reset");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("This password link is missing or invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, mode }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to update your password.");
        return;
      }

      setMessage(
        mode === "setup"
          ? "Your portal password has been set successfully. You can now sign in."
          : "Your password has been reset successfully. You can now sign in.",
      );
      setPassword("");
      setConfirm("");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="central-login">
      <section className="login-brand-panel">
        <div className="brand-centre">
          <img src="/community-logo.png" alt="Bolton Nigerian Muslim Community" />
          <p className="community-name">Bolton Nigerian Muslim Community</p>
          <h1>{mode === "setup" ? "Set up your account" : "Choose a new password"}</h1>
          <p className="brand-copy">
            Create a secure password for your BNMC Madrasah portal account.
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-box">
          <a className="back-link" href="/login">
            &larr; Back to sign in
          </a>

          <div className="mobile-brand">
            <img src="/community-logo.png" alt="" />
            <span>
              <b>BNMC Madrasah</b>
              <small>SECURE PASSWORD</small>
            </span>
          </div>

          <h2>{mode === "setup" ? "Set your password" : "Reset password"}</h2>
          <p className="login-intro">
            Enter and confirm your new portal password.
          </p>

          <form onSubmit={submit}>
            <label>
              <span>New password</span>
              <div className="login-input">
                <LockKeyhole />
                <input
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter new password"
                  minLength={8}
                  required
                  disabled={busy || Boolean(message)}
                />
                <button
                  type="button"
                  className="show-password"
                  onClick={() => setReveal((value) => !value)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                >
                  {reveal ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            <p className="password-rules">Use at least 8 characters.</p>

            <label>
              <span>Confirm password</span>
              <div className="login-input">
                <LockKeyhole />
                <input
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Confirm new password"
                  minLength={8}
                  required
                  disabled={busy || Boolean(message)}
                />
              </div>
            </label>

            {message && <div className="auth-success">{message}</div>}
            {error && <div className="login-error" role="alert">{error}</div>}

            {!message && (
              <button className="sign-in-button" disabled={busy || !token}>
                {busy
                  ? "Saving..."
                  : mode === "setup"
                    ? "Set password"
                    : "Reset password"}
              </button>
            )}
          </form>

          <div className="auth-actions">
            <a href="/login">
              {message ? "Continue to sign in" : "Return to sign in"}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
