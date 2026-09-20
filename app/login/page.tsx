"use client";

import { FormEvent, useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import "./login.css";

type LoginResponse = {
  ok?: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    roles?: string[];
  };
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.user) {
        setError(result.error ?? "Sign in failed.");
        return;
      }

      // The account may hold several roles. Authentication is now account-based;
      // the portal handles the active view after sign-in.
      window.location.assign("/portal");
    } catch (signInError) {
      console.error(signInError);
      setError("Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="central-login">
      <section className="login-brand-panel">
        <div className="brand-centre">
          <img
            src="/community-logo.png"
            alt="Bolton Nigerian Muslim Community"
          />

          <p className="community-name">
            Bolton Nigerian Muslim Community
          </p>

          <h1>Welcome back</h1>

          <p className="brand-copy">
            Sign in to access your Madrasah account.
          </p>

          <blockquote>
            &ldquo;And say, &lsquo;My Lord, increase me in knowledge.&rsquo;&rdquo;
            <small>Qur&apos;an 20:114</small>
          </blockquote>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-box">
          <a className="back-link" href="/">
            &larr; Back to website
          </a>

          <div className="mobile-brand">
            <img src="/community-logo.png" alt="" />
            <span>
              <b>BNMC Madrasah</b>
              <small>PORTAL ACCESS</small>
            </span>
          </div>

          <h2>Sign in</h2>
          <p className="login-intro">
            Enter your account details to continue.
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

            <label>
              <span>Password</span>
              <div className="login-input">
                <LockKeyhole />
                <input
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={busy}
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

            <div className="login-recovery-row">
              <a href="/forgot-password">
                Forgot password?
              </a>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button className="sign-in-button" disabled={busy}>
              {busy ? "Signing in..." : "Sign in to portal"}
            </button>
          </form>

          <div className="login-help">
            <b>One account, all your access</b>
            <p>
              Your account can include parent, teaching, finance,
              safeguarding or administrator access. If you have more than
              one role, you can choose the view you need after signing in.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
