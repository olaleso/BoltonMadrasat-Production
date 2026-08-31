"use client";
import Image from "next/image";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import "./apply.css";
const fields = [
  ["firstName", "Child's first name", "text"],
  ["lastName", "Child's last name", "text"],
  ["dateOfBirth", "Date of birth", "date"],
  ["gender", "Gender", "text"],
  ["guardianName", "Parent / guardian name", "text"],
  ["relationship", "Relationship to child", "text"],
  ["email", "Email address", "email"],
  ["phone", "Telephone", "tel"],
  ["address", "Home address", "text"],
  ["preferredSession", "Preferred session", "text"],
  ["priorLevel", "Previous Arabic/Qur’an level", "text"],
  ["medicalNotes", "Medical information", "text"],
  ["allergyNotes", "Allergies", "text"],
  ["additionalNeeds", "Additional learning needs", "text"],
] as const;
export default function ApplyPage() {
  const [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget),
      payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/admissions/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to submit application");
      return;
    }
    setDone(true);
  }
  return (
    <main className="apply-page">
      <header>
        <a href="/">
          <Image
            src="/community-logo.png"
            width={65}
            height={65}
            alt="Community logo"
          />
          <span>
            <b>Bolton Madrasat</b>
            <small>Founding intake application</small>
          </span>
        </a>
      </header>
      {done ? (
        <section className="apply-success">
          <CheckCircle2 />
          <h1>Application received</h1>
          <p>
            JazakAllahu khayran. The admissions team will review the information
            and contact you about the appropriate learning group.
          </p>
          <a href="/">Return to the Madrasat website</a>
        </section>
      ) : (
        <form onSubmit={submit}>
          <small>Online admission</small>
          <h1>Begin your child’s learning journey</h1>
          <p>
            Please provide accurate information. Medical, allergy and
            additional-needs details help us prepare a safe and supportive
            learning environment.
          </p>
          <div>
            {fields.map(([name, label, type], i) => (
              <label key={name} className={i > 10 ? "wide" : ""}>
                {label}
                <input name={name} type={type} required={i < 8} />
              </label>
            ))}
          </div>
          <fieldset>
            <label>
              <input
                type="checkbox"
                name="emergencyConsent"
                value="true"
                required
              />{" "}
              I consent to emergency first aid where necessary.
            </label>
            <label>
              <input type="checkbox" name="photoConsent" value="true" /> I
              consent to appropriate photographs for internal learning records.
            </label>
          </fieldset>
          {error && <output>{error}</output>}
          <footer>
            <a href="/">Cancel</a>
            <button disabled={busy}>
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </footer>
        </form>
      )}
    </main>
  );
}
