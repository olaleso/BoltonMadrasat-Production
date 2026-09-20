"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import "../login/login.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to request a password reset.");
        return;
      }

      setMessage(
        result.message ??
          "If an active account matches that email, password reset instructions have been sent.",
      );
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
          <h1>Account recovery</h1>
          <p className="brand-copy">
            We&apos;ll send a secure password reset link to your registered email.
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
              <small>ACCOUNT RECOVERY</small>
            </span>
          </div>

          <h2>Forgot password?</h2>
          <p className="login-intro">
            Enter the email address used for your BNMC Madrasah account.
          </p>

          <form onSubmit={submit}>
            <label>
              <span>Email address</span>
              <div className="login-input">
                <Mail />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={busy}
                />
              </div>
            </label>

            {message && <div className="auth-success">{message}</div>}
            {error && <div className="login-error" role="alert">{error}</div>}

            <button className="sign-in-button" disabled={busy}>
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <div className="auth-actions">
            <a href="/login">Return to sign in</a>
          </div>
        </div>
      </section>
    </main>
  );
}
