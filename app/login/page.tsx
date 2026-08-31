"use client";
import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@boltonmadrasat.local"),
    [password, setPassword] = useState("Madrasat2026!"),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Sign in failed");
      return;
    }
    window.location.assign("/portal");
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <Image
          src="/community-logo.png"
          alt="Bolton Nigerian Muslim Community"
          width={150}
          height={150}
        />
        <p>Bolton Nigerian Muslim Community</p>
        <h1>Madrasat Management System</h1>
        <blockquote>
          “My Lord, increase me in knowledge.” <small>Qur’an 20:114</small>
        </blockquote>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <a href="/">← Return to website</a>
          <h2>Assalamu alaikum</h2>
          <p>Sign in to your secure Madrasat workspace.</p>
          <label>
            Email address
            <div>
              <Mail />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>
          <label>
            Password
            <div>
              <LockKeyhole />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label="Show password"
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {error && <output>{error}</output>}
          <button className="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in securely"}
          </button>
          <aside>
            <b>Local demonstration accounts</b>
            <span>Admin: admin@boltonmadrasat.local</span>
            <span>Teacher: teacher@boltonmadrasat.local</span>
            <span>Parent: parent@boltonmadrasat.local</span>
            <span>Password: Madrasat2026!</span>
          </aside>
        </form>
      </section>
    </main>
  );
}
