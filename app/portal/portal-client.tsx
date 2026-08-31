"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  School,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import "./portal.css";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "teacher" | "finance" | "safeguarding" | "parent";
};
type Row = Record<string, unknown>;
const nav = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard, roles: "all" },
  {
    key: "applications",
    label: "Admissions",
    icon: UserCheck,
    roles: ["admin"],
  },
  {
    key: "students",
    label: "Students",
    icon: Users,
    roles: ["admin", "teacher", "safeguarding"],
  },
  {
    key: "guardians",
    label: "Guardians",
    icon: ShieldCheck,
    roles: ["admin", "safeguarding"],
  },
  {
    key: "classes",
    label: "Classes",
    icon: School,
    roles: ["admin", "teacher"],
  },
  {
    key: "attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    roles: ["admin", "teacher"],
  },
  {
    key: "progress",
    label: "Learning progress",
    icon: BookOpen,
    roles: ["admin", "teacher", "parent"],
  },
  {
    key: "fees",
    label: "Fees",
    icon: CreditCard,
    roles: ["admin", "finance", "parent"],
  },
  {
    key: "payments",
    label: "Payments",
    icon: CreditCard,
    roles: ["admin", "finance"],
  },
  {
    key: "enrolments",
    label: "Enrolments",
    icon: GraduationCap,
    roles: ["admin"],
  },
  {
    key: "announcements",
    label: "Communication",
    icon: MessageSquare,
    roles: ["admin", "teacher", "parent"],
  },
  {
    key: "staff",
    label: "Staff",
    icon: GraduationCap,
    roles: ["admin", "safeguarding"],
  },
  {
    key: "compliance",
    label: "DBS & compliance",
    icon: ShieldCheck,
    roles: ["admin", "safeguarding"],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["admin", "finance", "safeguarding"],
  },
];
const fields: Record<
  string,
  { name: string; label: string; type?: string; required?: boolean }[]
> = {
  students: [
    { name: "studentNumber", label: "Student number", required: true },
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    {
      name: "dateOfBirth",
      label: "Date of birth",
      type: "date",
      required: true,
    },
    { name: "gender", label: "Gender", required: true },
    { name: "medicalNotes", label: "Medical notes" },
    { name: "allergyNotes", label: "Allergies" },
  ],
  guardians: [
    { name: "fullName", label: "Full name", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone", required: true },
    { name: "address", label: "Address" },
    { name: "relationship", label: "Relationship", required: true },
  ],
  classes: [
    { name: "name", label: "Class name", required: true },
    { name: "subject", label: "Subject", required: true },
    { name: "level", label: "Level", required: true },
    { name: "room", label: "Room", required: true },
    { name: "dayOfWeek", label: "Day (1–7)", type: "number", required: true },
    { name: "startTime", label: "Start time", type: "time", required: true },
    { name: "endTime", label: "End time", type: "time", required: true },
    { name: "capacity", label: "Capacity", type: "number", required: true },
  ],
  announcements: [
    { name: "title", label: "Title", required: true },
    { name: "body", label: "Message", required: true },
    { name: "audience", label: "Audience", required: true },
    { name: "status", label: "Status (draft/published)", required: true },
  ],
  fees: [
    { name: "studentId", label: "Student ID", required: true },
    { name: "description", label: "Description", required: true },
    {
      name: "amountPence",
      label: "Amount in pence",
      type: "number",
      required: true,
    },
    { name: "discountPence", label: "Discount in pence", type: "number" },
    { name: "dueDate", label: "Due date", type: "date", required: true },
  ],
  payments: [
    { name: "feeId", label: "Fee ID", required: true },
    {
      name: "amountPence",
      label: "Amount in pence",
      type: "number",
      required: true,
    },
    { name: "method", label: "Payment method", required: true },
    { name: "reference", label: "Reference" },
  ],
  enrolments: [
    { name: "studentId", label: "Student ID", required: true },
    { name: "classId", label: "Class ID", required: true },
  ],
  compliance: [
    { name: "userId", label: "Staff user ID", required: true },
    { name: "checkType", label: "Check or training type", required: true },
    { name: "status", label: "Status", required: true },
    { name: "completedAt", label: "Completed date", type: "date" },
    { name: "expiresAt", label: "Expiry date", type: "date" },
    { name: "notes", label: "Notes" },
  ],
  staff: [
    { name: "displayName", label: "Full name", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "role", label: "Role", required: true },
    {
      name: "password",
      label: "Temporary password",
      type: "password",
      required: true,
    },
  ],
  progress: [
    { name: "studentId", label: "Student ID", required: true },
    { name: "classId", label: "Class ID", required: true },
    { name: "strand", label: "Learning strand", required: true },
    { name: "currentUnit", label: "Current unit", required: true },
    { name: "achievement", label: "Achievement", required: true },
    { name: "score", label: "Score", type: "number" },
    { name: "teacherComment", label: "Teacher comment" },
    { name: "nextStep", label: "Next step" },
    {
      name: "assessedAt",
      label: "Assessment date",
      type: "date",
      required: true,
    },
  ],
  attendance: [
    { name: "studentId", label: "Student ID", required: true },
    { name: "classId", label: "Class ID", required: true },
    {
      name: "sessionDate",
      label: "Session date",
      type: "date",
      required: true,
    },
    { name: "status", label: "Status", required: true },
    { name: "arrivalTime", label: "Arrival", type: "time" },
    { name: "collectionTime", label: "Collection", type: "time" },
    { name: "collectedByGuardianId", label: "Collector guardian ID" },
    { name: "notes", label: "Notes" },
  ],
};
const headings: Record<string, string[]> = {
  applications: ["student_name", "preferred_session", "status", "submitted_at"],
  students: ["student_number", "name", "guardian", "phone", "status"],
  guardians: ["full_name", "email", "phone", "relationship", "children"],
  classes: [
    "name",
    "subject",
    "level",
    "teacher",
    "room",
    "enrolled",
    "capacity",
  ],
  attendance: [
    "session_date",
    "student_name",
    "class_name",
    "status",
    "arrival_time",
    "collection_time",
  ],
  progress: [
    "assessed_at",
    "student_name",
    "strand",
    "current_unit",
    "achievement",
    "score",
  ],
  fees: [
    "student_name",
    "description",
    "due_date",
    "amount_pence",
    "paid_pence",
    "status",
  ],
  payments: [
    "received_at",
    "student_name",
    "description",
    "amount_pence",
    "method",
    "reference",
  ],
  enrolments: ["student_name", "class_name", "enrolled_at", "status"],
  compliance: [
    "staff_name",
    "check_type",
    "status",
    "completed_at",
    "expires_at",
  ],
  announcements: ["title", "audience", "status", "author", "created_at"],
  staff: ["display_name", "email", "role", "status"],
};
const nice = (v: string) =>
  v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const money = (v: unknown) => `£${(Number(v || 0) / 100).toFixed(2)}`;

export default function PortalClient() {
  const [user, setUser] = useState<User | null>(null),
    [active, setActive] = useState("dashboard"),
    [data, setData] = useState<Row[]>([]),
    [summary, setSummary] = useState<Row>({}),
    [reports, setReports] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState(false),
    [side, setSide] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const endpoint =
      active === "dashboard"
        ? "/api/v1/dashboard"
        : active === "reports"
          ? "/api/v1/reports"
          : `/api/v1/${active}`;
    const response = await fetch(endpoint);
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to load records");
    else if (active === "dashboard") setSummary(result.summary);
    else if (active === "reports") setReports(result.reports);
    else setData(result.data);
    setLoading(false);
  }, [active]);
  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) {
        window.location.assign("/login");
        return;
      }
      const x = await r.json();
      setUser(x.user);
    });
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }
  const allowed = nav.filter(
    (n) => n.roles === "all" || (user && n.roles.includes(user.role)),
  );
  if (!user)
    return (
      <div className="portal-loading">
        <RefreshCw /> Loading secure workspace…
      </div>
    );
  return (
    <div className="real-portal">
      <aside className={side ? "open" : ""}>
        <header>
          <Image
            src="/community-logo.png"
            alt="Community logo"
            width={48}
            height={48}
          />
          <span>
            <b>Bolton Madrasat</b>
            <small>Management system</small>
          </span>
          <button onClick={() => setSide(false)}>
            <X />
          </button>
        </header>
        <section className="identity">
          <i>{user.displayName[0]}</i>
          <span>
            <b>{user.displayName}</b>
            <small>{nice(user.role)}</small>
          </span>
        </section>
        <nav>
          {allowed.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={active === item.key ? "active" : ""}
                onClick={() => {
                  setActive(item.key);
                  setSide(false);
                }}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <footer>
          <button onClick={logout}>
            <LogOut />
            Sign out
          </button>
          <small>
            Designed and delivered by <b>NuraSpecs</b>
          </small>
        </footer>
      </aside>
      <main>
        <header>
          <button className="mobile-menu" onClick={() => setSide(true)}>
            <Menu />
          </button>
          <div>
            <b>{allowed.find((n) => n.key === active)?.label}</b>
            <small>PostgreSQL-backed local workspace</small>
          </div>
          <section>
            <button aria-label="Notifications">
              <Bell />
            </button>
            <i>{user.displayName[0]}</i>
          </section>
        </header>
        <article>
          {error && (
            <div className="portal-error">
              {error}
              <button onClick={load}>Try again</button>
            </div>
          )}
          {active === "dashboard" ? (
            <Dashboard summary={summary} user={user} />
          ) : active === "reports" ? (
            <Reports reports={reports} />
          ) : (
            <Records
              resource={active}
              rows={data}
              loading={loading}
              canCreate={Boolean(fields[active]) && user.role !== "parent"}
              canManage={
                user.role === "admin" &&
                [
                  "applications",
                  "students",
                  "classes",
                  "attendance",
                  "fees",
                  "announcements",
                  "staff",
                ].includes(active)
              }
              create={() => setForm(true)}
              refresh={load}
            />
          )}
        </article>
      </main>
      {form && (
        <CreateForm
          resource={active}
          close={() => setForm(false)}
          saved={() => {
            setForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Dashboard({ summary, user }: { summary: Row; user: User }) {
  const cards = [
    {
      label: "Active students",
      value: summary.activeStudents ?? 0,
      icon: Users,
    },
    {
      label: "Open applications",
      value: summary.openApplications ?? 0,
      icon: FileText,
    },
    {
      label: "Active classes",
      value: summary.activeClasses ?? 0,
      icon: School,
    },
    {
      label: "Present today",
      value: summary.presentToday ?? 0,
      icon: CheckCircle2,
    },
    {
      label: "Outstanding fees",
      value: money(summary.outstandingPence),
      icon: CreditCard,
    },
    {
      label: "Compliance due",
      value: summary.complianceDue ?? 0,
      icon: ShieldCheck,
    },
  ];
  return (
    <>
      <div className="welcome">
        <div>
          <small>Assalamu alaikum, {user.displayName.split(" ")[0]}</small>
          <h1>Madrasat overview</h1>
          <p>
            Live operational information from the local PostgreSQL database.
          </p>
        </div>
        <Image src="/community-logo.png" alt="" width={82} height={82} />
      </div>
      <div className="metric-grid">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <section key={c.label}>
              <i>
                <Icon />
              </i>
              <span>
                <b>{String(c.value)}</b>
                <small>{c.label}</small>
              </span>
            </section>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="portal-card">
          <h3>Version 1 operational areas</h3>
          {[
            "Admissions and enrolment",
            "Attendance and safe collection",
            "Qur’an and Arabic progress",
            "Fees and payment balances",
            "Staff safeguarding compliance",
          ].map((v) => (
            <p key={v}>
              <CheckCircle2 />
              {v}
            </p>
          ))}
        </section>
        <section className="portal-card">
          <h3>Today’s focus</h3>
          <p>
            <ClipboardCheck />
            Complete the class registers as children arrive.
          </p>
          <p>
            <CreditCard />
            Follow up outstanding term balances.
          </p>
          <p>
            <ShieldCheck />
            Review compliance items approaching expiry.
          </p>
        </section>
      </div>
    </>
  );
}
function Records({
  resource,
  rows,
  loading,
  canCreate,
  canManage,
  create,
  refresh,
}: {
  resource: string;
  rows: Row[];
  loading: boolean;
  canCreate: boolean;
  canManage: boolean;
  create: () => void;
  refresh: () => void;
}) {
  const cols = headings[resource] ?? [];
  async function updateStatus(id: unknown, current: unknown) {
    const status = window.prompt(
      "Enter the new status",
      String(current ?? "active"),
    );
    if (!status) return;
    const response = await fetch(`/api/v1/${resource}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok)
      window.alert((await response.json()).error ?? "Unable to update status");
    else refresh();
  }
  return (
    <section className="records">
      <div className="records-head">
        <div>
          <h1>{nav.find((n) => n.key === resource)?.label}</h1>
          <p>
            {rows.length} database record{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <span>
          <button onClick={refresh}>
            <RefreshCw />
            Refresh
          </button>
          {canCreate && (
            <button className="primary" onClick={create}>
              <Plus />
              Add record
            </button>
          )}
        </span>
      </div>
      <div className="table-wrap">
        {loading ? (
          <div className="empty">Loading records…</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <FileText />
            <b>No records yet</b>
            <p>Use Add record to create the first entry.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{nice(c)}</th>
                ))}
                {canManage && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  {cols.map((c) => (
                    <td key={c}>
                      {c.includes("pence") ? (
                        money(row[c])
                      ) : c === "status" ? (
                        <em className={`status ${String(row[c])}`}>
                          {String(row[c] ?? "—")}
                        </em>
                      ) : (
                        String(row[c] ?? "—")
                      )}
                    </td>
                  ))}
                  {canManage && (
                    <td>
                      <button
                        className="row-action"
                        onClick={() => updateStatus(row.id, row.status)}
                      >
                        Update status
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
function Reports({ reports }: { reports: Record<string, Row[]> }) {
  return (
    <section className="records">
      <div className="records-head">
        <div>
          <h1>Management reports</h1>
          <p>Live summaries calculated by PostgreSQL</p>
        </div>
      </div>
      <div className="report-grid">
        {Object.entries(reports).map(([name, rows]) => (
          <section className="portal-card" key={name}>
            <h3>{nice(name)} report</h3>
            {rows.map((r, i) => (
              <p key={i}>
                {Object.entries(r).map(([k, v]) => (
                  <span key={k}>
                    <small>{nice(k)}</small>
                    <b>{k.includes("pence") ? money(v) : String(v)}</b>
                  </span>
                ))}
              </p>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
function CreateForm({
  resource,
  close,
  saved,
}: {
  resource: string;
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget),
      payload = Object.fromEntries(fd.entries());
    const response = await fetch(`/api/v1/${resource}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to save");
      return;
    }
    saved();
  }
  return (
    <div className="modal">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>New database record</small>
            <h2>Add {nice(resource)}</h2>
          </div>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="form-grid">
          {fields[resource].map((f) => (
            <label key={f.name}>
              {f.label}
              <input
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
              />
            </label>
          ))}
        </div>
        {error && <output>{error}</output>}
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save record"}
          </button>
        </footer>
      </form>
    </div>
  );
}
