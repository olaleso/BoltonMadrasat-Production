"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileText,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoonStar,
  MoreHorizontal,
  Plus,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
type Role = "public" | "admin" | "teacher" | "parent";
type Item = { label: string; icon: any; children?: string[] };
const slides = [
  {
    tag: "Welcome to our Madrasat",
    title: "Faith, knowledge and character - growing together.",
    text: "A nurturing Arabic and Islamic learning programme for children in Bolton, rooted in the Qur'an, authentic knowledge and excellent manners.",
    cta: "Explore our programme",
    target: "programme",
    note: "A safe place to learn and belong",
  },
  {
    tag: "Qur'an & Tajwid",
    title: "A lifelong bond with the Qur'an starts here.",
    text: "Structured Qa'idah, recitation, memorisation and revision pathways with clear progress shared with parents.",
    cta: "View learning journey",
    target: "learning",
    note: "Personalised progress, every week",
  },
  {
    tag: "Arabic & Islamic Studies",
    title: "Understanding our deen with confidence and joy.",
    text: "Age-appropriate Arabic, seerah, aqidah, fiqh, duas and Islamic character - taught with warmth and purpose.",
    cta: "See our curriculum",
    target: "curriculum",
    note: "Knowledge that shapes daily life",
  },
];
const portalNav: Record<"admin" | "teacher" | "parent", Item[]> = {
  admin: [
    { label: "Overview", icon: LayoutDashboard },
    {
      label: "Admissions",
      icon: UserCheck,
      children: ["Applications", "Waiting list", "Enrolment"],
    },
    {
      label: "Students",
      icon: Users,
      children: ["Student directory", "Guardians", "Medical & consent"],
    },
    {
      label: "Classes",
      icon: School,
      children: ["Class groups", "Timetable", "Rooms"],
    },
    {
      label: "Attendance",
      icon: ClipboardCheck,
      children: ["Daily register", "Safe collection", "Absence follow-up"],
    },
    {
      label: "Learning",
      icon: BookOpen,
      children: ["Qa'idah", "Qur'an & Tajwid", "Arabic", "Islamic Studies"],
    },
    {
      label: "Fees",
      icon: WalletCards,
      children: ["Transactions", "Balances", "Discounts"],
    },
    {
      label: "Communication",
      icon: MessageSquare,
      children: ["Announcements", "Templates", "Message history"],
    },
    {
      label: "Staff",
      icon: HeartHandshake,
      children: ["Team directory", "DBS & training", "Assignments"],
    },
    {
      label: "Reports",
      icon: BarChart3,
      children: ["Attendance report", "Progress report", "Finance report"],
    },
  ],
  teacher: [
    { label: "My dashboard", icon: LayoutDashboard },
    {
      label: "My class",
      icon: Users,
      children: ["Student list", "Guardian contacts"],
    },
    {
      label: "Attendance",
      icon: ClipboardCheck,
      children: ["Take register", "Safe collection"],
    },
    {
      label: "Learning progress",
      icon: BookOpen,
      children: ["Qa'idah", "Qur'an & Tajwid", "Arabic & Islamic Studies"],
    },
    { label: "Homework", icon: FileText },
    { label: "Messages", icon: MessageSquare },
  ],
  parent: [
    { label: "Family dashboard", icon: LayoutDashboard },
    { label: "My children", icon: Users },
    {
      label: "Learning progress",
      icon: BookOpen,
      children: ["Weekly progress", "Curriculum", "Homework"],
    },
    { label: "Attendance", icon: ClipboardCheck },
    { label: "Fees & payments", icon: CreditCard },
    { label: "Notices", icon: Bell },
    { label: "Profile & consent", icon: ShieldCheck },
  ],
};
const records = [
  ["Aaliyah Ahmed", "BNMC-026", "Qa'idah A", "96%", "Active"],
  ["Bilal Musa", "BNMC-031", "Qur'an 2", "91%", "Active"],
  ["Fatimah Bello", "BNMC-044", "Qa'idah A", "98%", "Active"],
  ["Hamza Suleiman", "BNMC-052", "Arabic 3", "87%", "Follow up"],
  ["Maryam Ibrahim", "BNMC-061", "Qur'an 2", "95%", "Active"],
];
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="brand">
      <img
        src="/community-logo.png"
        alt="Bolton Nigerian Muslim Community logo"
      />
      <span className={small ? "hide" : ""}>
        <b>Bolton Madrasat</b>
        <small>Knowledge • Faith • Character</small>
      </span>
    </div>
  );
}
function Public({ enter }: { enter: (r: Role) => void }) {
  const [slide, setSlide] = useState(0),
    [mobile, setMobile] = useState(false),
    [drop, setDrop] = useState("");
  useEffect(() => {
    let i = setInterval(() => setSlide((x) => (x + 1) % 3), 6000);
    return () => clearInterval(i);
  }, []);
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div className="public" id="home">
      <div className="notice">
        <MoonStar /> Bismillah - enrolment is open for our founding classes{" "}
        <button onClick={() => go("admissions")}>
          Apply now <ArrowRight />
        </button>
      </div>
      <header>
        <Logo />
        <nav className={mobile ? "open" : ""}>
          <button onClick={() => go("home")}>Home</button>
          {[
            ["About", ["Our vision", "Our values", "Safeguarding"]],
            [
              "Learning",
              ["Qa'idah", "Qur'an & Tajwid", "Arabic", "Islamic Studies"],
            ],
            ["Admissions", ["How to apply", "Fees", "School calendar"]],
          ].map((m: any) => (
            <div className="drop" key={m[0]}>
              <button onClick={() => setDrop(drop === m[0] ? "" : m[0])}>
                {m[0]}
                <ChevronDown />
              </button>
              <div className={drop === m[0] ? "dropbox show" : "dropbox"}>
                {m[1].map((s: string) => (
                  <button
                    key={s}
                    onClick={() => {
                      go(
                        m[0].toLowerCase() === "about"
                          ? "about"
                          : m[0].toLowerCase(),
                      );
                      setDrop("");
                    }}
                  >
                    {s}
                    <ChevronRight />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => go("contact")}>Contact</button>
          <button className="login" onClick={() => enter("parent")}>
            Portal login <ArrowRight />
          </button>
        </nav>
        <button className="hamb" onClick={() => setMobile(!mobile)}>
          {mobile ? <X /> : <Menu />}
        </button>
      </header>
      <section className="hero">
        <div className="dots-bg" />
        <div className="hero-in" key={slide}>
          <div>
            <span className="tag">
              <Sparkles />
              {slides[slide].tag}
            </span>
            <h1>{slides[slide].title}</h1>
            <p>{slides[slide].text}</p>
            <div className="hero-buttons">
              <button className="gold" onClick={() => go(slides[slide].target)}>
                {slides[slide].cta}
                <ArrowRight />
              </button>
              <button onClick={() => go("about")}>Meet our Madrasat</button>
            </div>
          </div>
          <div className="arch">
            <img src="/community-logo.png" />
            <strong>بِسْمِ اللهِ</strong>
            <small>Begin with the name of Allah</small>
            <aside>
              <Star />
              {slides[slide].note}
            </aside>
          </div>
        </div>
        <button className="arr left" onClick={() => setSlide((slide + 2) % 3)}>
          <ArrowLeft />
        </button>
        <button className="arr right" onClick={() => setSlide((slide + 1) % 3)}>
          <ArrowRight />
        </button>
        <div className="pager">
          {slides.map((_, i) => (
            <button
              className={i === slide ? "active" : ""}
              onClick={() => setSlide(i)}
              key={i}
            />
          ))}
        </div>
      </section>
      <section className="quick">
        <div>
          <b>Saturday programme</b>
          <span>Structured weekly learning</span>
        </div>
        <div>
          <b>Children aged 5-16</b>
          <span>Ability-based classes</span>
        </div>
        <div>
          <b>Bolton community</b>
          <span>A welcoming, safe setting</span>
        </div>
        <button onClick={() => go("admissions")}>
          View admissions <ArrowRight />
        </button>
      </section>
      <section className="section intro" id="about">
        <span className="kicker">Our purpose</span>
        <div className="split">
          <h2>
            Raising confident young Muslims through knowledge and character.
          </h2>
          <p>
            Our Madrasat supports children to read the Qur'an correctly,
            understand their faith, develop excellent manners and feel deeply
            connected to the Muslim community.
          </p>
        </div>
        <div className="three">
          {[
            [
              BookOpen,
              "Sound learning",
              "A clear, age-appropriate curriculum with consistent teaching and meaningful assessment.",
            ],
            [
              HeartHandshake,
              "Beautiful character",
              "Adab, kindness, responsibility and service are woven into every learning experience.",
            ],
            [
              ShieldCheck,
              "Safe & nurturing",
              "Safeguarding, authorised collection and child wellbeing are central to our programme.",
            ],
          ].map(([I, t, p]: any) => (
            <article key={t}>
              <I />
              <h3>{t}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section programme" id="programme">
        <span className="kicker">Learning pathways</span>
        <div className="split">
          <h2>A complete foundation for every stage.</h2>
          <p>
            Children progress through connected learning pathways, with teachers
            recording achievements and the next step each week.
          </p>
        </div>
        <div className="four">
          {[
            [
              "01",
              "Qa'idah Foundation",
              "Arabic letters, joining, vowels and fluent word recognition.",
            ],
            [
              "02",
              "Qur'an & Tajwid",
              "Recitation, makharij, essential rules, memorisation and revision.",
            ],
            [
              "03",
              "Arabic Language",
              "Reading, writing, vocabulary and confident everyday understanding.",
            ],
            [
              "04",
              "Islamic Studies",
              "Aqidah, fiqh, seerah, duas, worship and Muslim character.",
            ],
          ].map((x) => (
            <article key={x[0]}>
              <span>{x[0]}</span>
              <h3>{x[1]}</h3>
              <p>{x[2]}</p>
              <button onClick={() => go("learning")}>
                Explore pathway <ArrowRight />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="section learning" id="learning">
        <div>
          <span className="kicker">Connected learning</span>
          <h2>Parents always know what their child is learning.</h2>
          <p>
            Weekly progress, attendance, homework and teacher feedback are
            brought together in one easy parent experience.
          </p>
          <ul>
            {[
              "Qa'idah pages and fluency",
              "Surah memorisation and revision",
              "Tajwid and Arabic development",
              "Homework and next lesson focus",
            ].map((x) => (
              <li key={x}>
                <Check />
                {x}
              </li>
            ))}
          </ul>
          <button className="green" onClick={() => enter("parent")}>
            Open parent portal demo
          </button>
        </div>
        <div className="phone">
          <small>THIS WEEK'S FOCUS</small>
          <h3>Qa'idah pages 18-20</h3>
          <p>Practise letter joining and revise Surah Al-Fil.</p>
          <label>
            <span>Qa'idah progress</span>
            <b>65%</b>
          </label>
          <div className="bar">
            <i />
          </div>
          <aside>
            <ClipboardCheck />
            <span>
              <b>96% attendance</b>
              <small>Excellent consistency</small>
            </span>
          </aside>
        </div>
      </section>
      <section className="section schedule" id="curriculum">
        <span className="kicker">A day at the Madrasat</span>
        <h2>Purposeful learning, paced for young minds.</h2>
        <div>
          {[
            ["09:30", "Welcome, duas & Qur'an"],
            ["10:20", "Arabic language"],
            ["11:05", "Break & community time"],
            ["11:25", "Islamic Studies"],
            ["12:15", "Review & home learning"],
          ].map((x) => (
            <article key={x[0]}>
              <b>{x[0]}</b>
              <i />
              <span>{x[1]}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="section admissions" id="admissions">
        <div>
          <span className="tag">
            <GraduationCap />
            Founding intake
          </span>
          <h2>Begin your child's learning journey.</h2>
          <p>
            Register your interest today. Our team will review the application,
            confirm the appropriate learning group and contact you about the
            next step.
          </p>
        </div>
        <aside>
          {[
            "Submit online application",
            "Learning-level review",
            "Class placement & welcome",
          ].map((s, i) => (
            <div key={s}>
              <b>{i + 1}</b>
              {s}
            </div>
          ))}
          <button onClick={() => window.location.assign("/apply")}>
            Start an application <ArrowRight />
          </button>
        </aside>
      </section>
      <section className="section roles">
        <span className="kicker">One connected community</span>
        <h2>Explore the Version 1 portal</h2>
        <p>
          Choose a role to demonstrate the complete experience during your
          meeting.
        </p>
        <div className="three">
          {[
            [
              "admin",
              LayoutDashboard,
              "Administrator",
              "Operations, admissions, fees and reports",
            ],
            [
              "teacher",
              BookOpen,
              "Teacher",
              "Attendance, progress and homework",
            ],
            [
              "parent",
              Users,
              "Parent / guardian",
              "Children, learning, payments and notices",
            ],
          ].map(([r, I, t, p]: any) => (
            <button key={r} onClick={() => enter(r)}>
              <I />
              <b>{t}</b>
              <span>{p}</span>
              <ArrowRight />
            </button>
          ))}
        </div>
      </section>
      <footer id="contact">
        <div>
          <Logo />
          <p>
            Serving children and families through Qur'an, Arabic, Islamic
            Studies and excellent character.
          </p>
        </div>
        <div>
          <b>Quick links</b>
          <button onClick={() => go("about")}>About us</button>
          <button onClick={() => go("programme")}>Our programme</button>
          <button onClick={() => go("admissions")}>Admissions</button>
        </div>
        <div>
          <b>Get in touch</b>
          <span>Bolton, Greater Manchester</span>
          <span>info@boltonmadrasat.org</span>
          <span>Saturday programme</span>
        </div>
        <div>
          <b>Portal access</b>
          <button onClick={() => enter("admin")}>Administrator</button>
          <button onClick={() => enter("teacher")}>Teacher</button>
          <button onClick={() => enter("parent")}>Parent / guardian</button>
        </div>
        <small>
          Prototype designed and delivered by NuraSpecs • Demonstration data
          only
        </small>
      </footer>
    </div>
  );
}
function Stat({
  I,
  n,
  t,
  tone = "",
}: {
  I: any;
  n: string;
  t: string;
  tone?: string;
}) {
  return (
    <article className={`stat ${tone}`}>
      <i>
        <I />
      </i>
      <div>
        <b>{n}</b>
        <small>{t}</small>
      </div>
      <MoreHorizontal />
    </article>
  );
}
function Title({
  title,
  text,
  button,
  notify,
}: {
  title: string;
  text: string;
  button: string;
  notify: (s: string) => void;
}) {
  return (
    <div className="title">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <button onClick={() => notify(`${button} opened in this demonstration`)}>
        <Plus />
        {button}
      </button>
    </div>
  );
}
function ClassList() {
  return (
    <section className="panel">
      <div className="paneltop">
        <div>
          <h3>Today's classes</h3>
          <p>Live capacity and session overview</p>
        </div>
        <button>View timetable</button>
      </div>
      <div className="classes">
        {[
          ["Qa'idah A", "09:30 • Room 1", "18 / 20"],
          ["Qur'an 2", "10:45 • Room 2", "15 / 18"],
          ["Arabic 3", "12:15 • Hall", "20 / 22"],
        ].map((x, i) => (
          <div key={x[0]}>
            <i className={`c${i}`}>
              <BookOpen />
            </i>
            <span>
              <b>{x[0]}</b>
              <small>{x[1]}</small>
            </span>
            <label>
              {x[2]}
              <em>
                <u style={{ width: [90, 83, 91][i] + "%" }} />
              </em>
            </label>
            <ChevronRight />
          </div>
        ))}
      </div>
    </section>
  );
}
function Actions() {
  return (
    <section className="panel">
      <div className="paneltop">
        <div>
          <h3>Action centre</h3>
          <p>Items needing attention</p>
        </div>
        <Bell />
      </div>
      <div className="actions">
        {[
          ["7 applications", "Awaiting admission review", "gold"],
          ["2 absences", "Parent follow-up required", "red"],
          ["3 checks", "DBS renewals due soon", "blue"],
          ["12 balances", "Fee reminder ready", "green"],
        ].map((x) => (
          <div key={x[0]}>
            <i className={x[2]} />
            <span>
              <b>{x[0]}</b>
              <small>{x[1]}</small>
            </span>
            <ChevronRight />
          </div>
        ))}
      </div>
    </section>
  );
}
function Table({ title = "Student directory" }: { title?: string }) {
  return (
    <section className="panel table">
      <div className="paneltop">
        <div>
          <h3>{title}</h3>
          <p>Manage records and view current status</p>
        </div>
        <label>
          <Search />
          <input placeholder="Search records" />
        </label>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>ID</th>
              <th>Class</th>
              <th>Attendance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r[1]}>
                <td>
                  <i>{r[0][0]}</i>
                  <b>{r[0]}</b>
                </td>
                <td>{r[1]}</td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td>
                  <em className={r[4] === "Active" ? "ok" : "warn"}>{r[4]}</em>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Register({ notify }: { notify: (s: string) => void }) {
  const [status, setStatus] = useState<Record<string, string>>({});
  return (
    <section className="panel">
      <div className="paneltop">
        <div>
          <h3>Qa'idah A - Morning register</h3>
          <p>Room 1 • 09:30-10:20 • Ustadha Maryam</p>
        </div>
        <span className="live">
          <i />
          Live register
        </span>
      </div>
      <div className="register">
        {records.map((r, i) => (
          <div key={r[1]}>
            <i>{r[0][0]}</i>
            <b>{r[0]}</b>
            <small>
              {i === 3
                ? "Collection note on file"
                : "Authorised collection confirmed"}
            </small>
            <span>
              {["Present", "Late", "Absent"].map((s) => (
                <button
                  className={
                    (status[r[1]] || (i === 3 ? "Late" : "Present")) === s
                      ? s.toLowerCase()
                      : ""
                  }
                  onClick={() => setStatus({ ...status, [r[1]]: s })}
                  key={s}
                >
                  {s}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="panelbottom">
        <b>4 present</b>
        <b>1 late</b>
        <b>0 absent</b>
        <button onClick={() => notify("Attendance saved successfully")}>
          Save register
        </button>
      </div>
    </section>
  );
}
function Learning() {
  const [tab, setTab] = useState("Qa'idah");
  return (
    <section className="panel learn">
      <nav>
        {["Qa'idah", "Qur'an & Tajwid", "Arabic", "Islamic Studies"].map(
          (t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {t}
            </button>
          ),
        )}
      </nav>
      <div>
        <aside>
          <div className="ring">
            <b>{tab === "Qa'idah" ? "68" : "74"}%</b>
            <small>Average progress</small>
          </div>
          <h3>{tab} pathway</h3>
          <p>Clear milestones, teacher observations and next steps.</p>
        </aside>
        <section>
          {[
            "Foundation secure",
            "Current lesson in progress",
            "Revision consistency",
            "Ready for next assessment",
          ].map((m, i) => (
            <div key={m}>
              <i className={i < 2 ? "done" : ""}>{i < 2 ? <Check /> : i + 1}</i>
              <span>
                <b>{m}</b>
                <small>
                  {i < 2
                    ? "Completed and verified"
                    : i === 2
                      ? "Practise 3 times this week"
                      : "Teacher review required"}
                </small>
              </span>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
function Fees() {
  return (
    <div className="grid">
      <section className="panel chart">
        <div className="paneltop">
          <div>
            <h3>Collection overview</h3>
            <p>Autumn term • weekly</p>
          </div>
        </div>
        <div>
          {[42, 68, 53, 82, 76, 91, 64].map((v, i) => (
            <span key={i}>
              <i style={{ height: v + "%" }} />
              <small>W{i + 1}</small>
            </span>
          ))}
        </div>
      </section>
      <Actions />
    </div>
  );
}
function Messages({ notify }: { notify: (s: string) => void }) {
  return (
    <div className="messages">
      <section className="panel">
        <div className="paneltop">
          <h3>Recent announcements</h3>
        </div>
        {[
          ["Madrasat closed - Eid break", "All families"],
          ["Qa'idah A homework", "18 guardians"],
          ["Autumn fee reminder", "12 guardians"],
          ["Teacher briefing", "Staff & volunteers"],
        ].map((m, i) => (
          <button className={i === 0 ? "active" : ""} key={m[0]}>
            <i>
              <Mail />
            </i>
            <span>
              <b>{m[0]}</b>
              <small>{m[1]}</small>
            </span>
          </button>
        ))}
      </section>
      <section className="panel letter">
        <small>ANNOUNCEMENT PREVIEW</small>
        <h3>Madrasat closed - Eid break</h3>
        <p>Assalamu alaikum dear parents and guardians,</p>
        <p>
          Please note that the Madrasat will be closed for the Eid break.
          Classes resume on the following Saturday, in sha Allah.
        </p>
        <p>May Allah accept from us all.</p>
        <button onClick={() => notify("Message sent to all selected families")}>
          Send announcement
        </button>
      </section>
    </div>
  );
}
function Staff() {
  return (
    <section className="panel staff">
      <div className="paneltop">
        <div>
          <h3>Team compliance overview</h3>
          <p>Safeguarding checks and training</p>
        </div>
      </div>
      <div>
        {[
          ["Ustadha Maryam", "Qa'idah A", "DBS verified", "Training current"],
          ["Ustadh Khalid", "Qur'an 2", "DBS verified", "Renewal in 21 days"],
          [
            "Sister Aminah",
            "Safeguarding lead",
            "DBS verified",
            "Training current",
          ],
          ["Brother Yusuf", "Volunteer", "Check pending", "Induction booked"],
        ].map((x, i) => (
          <article key={x[0]}>
            <i>{x[0].split(" ")[1][0]}</i>
            <span>
              <b>{x[0]}</b>
              <small>{x[1]}</small>
            </span>
            <em className={i === 3 ? "warn" : "ok"}>{x[2]}</em>
            <p>
              <ShieldCheck />
              {x[3]}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
function Reports() {
  return (
    <div className="reports">
      {[
        ["Attendance trend", "92%", "+4% this term", ClipboardCheck],
        ["Learning milestones", "418", "76 this month", BookOpen],
        ["Fee collection", "87%", "£8,460 received", WalletCards],
        ["Class capacity", "84%", "20 spaces available", Users],
      ].map(([a, b, d, I]: any) => (
        <section className="panel" key={a}>
          <i>
            <I />
          </i>
          <small>{a}</small>
          <b>{b}</b>
          <p>{d}</p>
          <div>
            {[20, 38, 30, 55, 47, 68, 82].map((v, i) => (
              <u style={{ height: v + "%" }} key={i} />
            ))}
          </div>
          <button>
            Open report <ArrowRight />
          </button>
        </section>
      ))}
    </div>
  );
}
function MainContent({
  role,
  active,
  notify,
}: {
  role: "admin" | "teacher" | "parent";
  active: string;
  notify: (s: string) => void;
}) {
  let a = active.toLowerCase();
  if (
    a.includes("attend") ||
    a.includes("register") ||
    a.includes("collection") ||
    a.includes("absence")
  )
    return (
      <>
        <Title
          title="Attendance & safe collection"
          text="Monitor attendance, absences and authorised collection."
          button="Add attendance note"
          notify={notify}
        />
        <div className="stats">
          <Stat I={ClipboardCheck} n="116" t="Present today" />
          <Stat I={Clock3} n="8" t="Late arrivals" tone="gold" />
          <Stat I={UserRound} n="2" t="Unexplained absence" tone="red" />
          <Stat I={ShieldCheck} n="74" t="Safely collected" tone="blue" />
        </div>
        <Register notify={notify} />
      </>
    );
  if (
    a.includes("learning") ||
    a.includes("qa'idah") ||
    a.includes("qur'an") ||
    a.includes("arabic") ||
    a.includes("islamic") ||
    a.includes("progress") ||
    a.includes("homework") ||
    a.includes("curriculum")
  )
    return (
      <>
        <Title
          title="Learning & curriculum"
          text="Qa'idah, Qur'an, tajwid, Arabic and Islamic Studies progress."
          button="Record progress"
          notify={notify}
        />
        <Learning />
      </>
    );
  if (
    a.includes("fee") ||
    a.includes("payment") ||
    a.includes("transaction") ||
    a.includes("balance") ||
    a.includes("discount")
  )
    return (
      <>
        <Title
          title="Fees & payments"
          text="Track charges, concessions, payments and balances."
          button="Record payment"
          notify={notify}
        />
        <div className="stats">
          <Stat I={WalletCards} n="£8,460" t="Collected this term" />
          <Stat I={Clock3} n="£1,240" t="Outstanding" tone="gold" />
          <Stat I={Users} n="14" t="Sibling discounts" tone="blue" />
          <Stat I={FileText} n="38" t="Receipts issued" />
        </div>
        <Fees />
      </>
    );
  if (
    a.includes("message") ||
    a.includes("communication") ||
    a.includes("announcement") ||
    a.includes("notice") ||
    a.includes("template")
  )
    return (
      <>
        <Title
          title="Communication centre"
          text="Send targeted messages to families and staff."
          button="New announcement"
          notify={notify}
        />
        <Messages notify={notify} />
      </>
    );
  if (
    a.includes("staff") ||
    a.includes("team") ||
    a.includes("dbs") ||
    a.includes("assignment")
  )
    return (
      <>
        <Title
          title="Staff & volunteers"
          text="Manage assignments, DBS status and training renewals."
          button="Add team member"
          notify={notify}
        />
        <Staff />
      </>
    );
  if (a.includes("report") || a.includes("finance"))
    return (
      <>
        <Title
          title="Reports & insight"
          text="Turn operational records into useful decisions."
          button="Export report"
          notify={notify}
        />
        <Reports />
      </>
    );
  if (
    a.includes("admission") ||
    a.includes("application") ||
    a.includes("waiting") ||
    a.includes("enrol")
  )
    return (
      <>
        <Title
          title="Admissions & applications"
          text="Review applications and place children in the right class."
          button="New application"
          notify={notify}
        />
        <div className="stats">
          <Stat I={FileText} n="18" t="New applications" />
          <Stat I={Clock3} n="7" t="Awaiting review" tone="gold" />
          <Stat I={UserCheck} n="9" t="Ready to enrol" />
          <Stat I={Users} n="12" t="Waiting list" tone="blue" />
        </div>
        <Table title="Recent applications" />
      </>
    );
  if (a.includes("class") || a.includes("timetable") || a.includes("room"))
    return (
      <>
        <Title
          title="Classes & timetable"
          text="Coordinate classes, teachers, rooms and capacity."
          button="Create class"
          notify={notify}
        />
        <ClassList />
        <Table />
      </>
    );
  if (
    a.includes("student") ||
    a.includes("guardian") ||
    a.includes("medical") ||
    a.includes("consent") ||
    a.includes("children") ||
    a.includes("profile")
  )
    return (
      <>
        <Title
          title={
            role === "parent" ? "My children & profile" : "Students & guardians"
          }
          text="Secure student, family, medical and consent records."
          button={role === "parent" ? "Update profile" : "Add student"}
          notify={notify}
        />
        <Table />
      </>
    );
  const names = {
    admin: ["Administrator", "the Madrasat's operational picture"],
    teacher: ["Ustadha Maryam", "your Qa'idah A class"],
    parent: ["Ibrahim", "Fatimah's week at the Madrasat"],
  }[role];
  return (
    <>
      <Title
        title={`Assalamu alaikum, ${names[0]}`}
        text={`Here is ${names[1]} for Saturday, 31 August.`}
        button={
          role === "teacher"
            ? "Take register"
            : role === "parent"
              ? "Report absence"
              : "Add student"
        }
        notify={notify}
      />
      {role === "parent" && (
        <section className="child">
          <i>F</i>
          <span>
            <small>MY CHILD</small>
            <h2>Fatimah Bello</h2>
            <p>Qa'idah A • BNMC-044</p>
          </span>
          <em>Active</em>
        </section>
      )}
      <div className="stats">
        <Stat
          I={Users}
          n={role === "teacher" ? "20" : "126"}
          t={
            role === "parent"
              ? "Qa'idah progress"
              : role === "teacher"
                ? "Students"
                : "Active students"
          }
        />
        <Stat
          I={ClipboardCheck}
          n={role === "parent" ? "96%" : "92%"}
          t="Attendance"
        />
        <Stat
          I={BookOpen}
          n={role === "parent" ? "2" : "6"}
          t={role === "parent" ? "Homework tasks" : "Updates due"}
          tone="gold"
        />
        <Stat I={Bell} n="4" t="Open actions" tone="blue" />
      </div>
      <div className="grid">
        <ClassList />
        <Actions />
      </div>
      {role === "admin" ? <Table /> : <Learning />}
    </>
  );
}
function Portal({
  role,
  back,
  backend,
}: {
  role: "admin" | "teacher" | "parent";
  back: () => void;
  backend: boolean;
}) {
  const [active, setActive] = useState(portalNav[role][0].label),
    [expanded, setExpanded] = useState<string[]>([]),
    [side, setSide] = useState(false),
    [toast, setToast] = useState("");
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 2600);
  };
  const rn = {
    admin: "Administrator",
    teacher: "Teacher",
    parent: "Parent / guardian",
  }[role];
  return (
    <div className="portal">
      <aside className={side ? "open" : ""}>
        <div className="sidelogo">
          <Logo small />
          <button onClick={() => setSide(false)}>
            <X />
          </button>
        </div>
        <div className="role">
          <i>{role[0].toUpperCase()}</i>
          <span>
            <b>{rn}</b>
            <small>Demo workspace</small>
          </span>
        </div>
        <nav>
          {portalNav[role].map((m) => {
            let I = m.icon,
              open = expanded.includes(m.label);
            return (
              <div key={m.label}>
                <button
                  className={active === m.label ? "active" : ""}
                  onClick={() => {
                    setActive(m.label);
                    if (m.children)
                      setExpanded(
                        open
                          ? expanded.filter((x) => x !== m.label)
                          : [...expanded, m.label],
                      );
                    setSide(false);
                  }}
                >
                  <I />
                  <span>{m.label}</span>
                  {m.children && (open ? <ChevronDown /> : <ChevronRight />)}
                </button>
                {m.children && open && (
                  <section>
                    {m.children.map((s) => (
                      <button
                        className={active === s ? "active" : ""}
                        onClick={() => {
                          setActive(s);
                          setSide(false);
                        }}
                        key={s}
                      >
                        {s}
                      </button>
                    ))}
                  </section>
                )}
              </div>
            );
          })}
        </nav>
        <button className="back" onClick={back}>
          <LogOut />
          Return to public website
        </button>
        <small className="powered">
          Designed & delivered by <b>NuraSpecs</b>
        </small>
      </aside>
      <main>
        <header>
          <button className="sidetoggle" onClick={() => setSide(true)}>
            <Menu />
          </button>
          <label>
            <Search />
            <input placeholder="Search students, classes or actions..." />
          </label>
          <div>
            <button>
              <Bell />
            </button>
            <i>{role[0].toUpperCase()}</i>
            <span>
              <b>{rn}</b>
              <small>View profile</small>
            </span>
            <ChevronDown />
          </div>
        </header>
        <div className="content">
          <MainContent role={role} active={active} notify={notify} />
        </div>
      </main>
      {toast && (
        <div className="toast">
          <Check />
          {toast}
        </div>
      )}
      <div className={`demo ${backend ? "connected" : ""}`}>
        {backend ? "Version 1 backend connected" : "Connecting to backend…"}
      </div>
    </div>
  );
}
export default function Page() {
  return <Public enter={() => window.location.assign("/login")} />;
}
