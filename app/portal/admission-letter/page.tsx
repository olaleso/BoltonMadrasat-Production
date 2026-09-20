"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";

import "./admission-letter.css";

type Letter = {
  application_id: string;
  accepted_at?: string;
  enrolled_at?: string;
  student_number?: string;
  student_name: string;
  gender?: string;
  guardian_name?: string;
  class_name?: string;
  class_level?: string;
  class_subject?: string;
  class_room?: string;
  class_day_of_week?: number;
  start_time?: string;
  end_time?: string;
  accepted_by?: string;
};

type AcademicSettings = {
  academic_year_label: string;
  term_name: string;
  term_start_date: string;
  term_end_date: string;
  programme_start_date: string;
  assessment_dates_text: string;
  open_day_text: string;
  standard_session_start: string;
  standard_session_end: string;
};

const DEFAULT_ACADEMIC_SETTINGS: AcademicSettings = {
  academic_year_label: "2026/2027",
  term_name: "Autumn Term",
  term_start_date: "2026-09-05",
  term_end_date: "2026-12-20",
  programme_start_date: "2026-09-05",
  assessment_dates_text: "19th and 26th July 2026",
  open_day_text: "Sunday 30th August",
  standard_session_start: "09:30",
  standard_session_end: "11:30",
};

const POSTCODE = "BL2 1DZ";
const MONTHLY_FEE = "\u00A330 per month";

function parsedDate(value: unknown) {
  const text = String(value ?? "").trim();
  const parsed = text
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00Z` : text)
    : new Date();

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ordinal(day: number) {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatDate(value: unknown) {
  const date = parsedDate(value);
  if (!date) return String(value ?? "");

  const monthYear = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);

  const day = Number(
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      timeZone: "Europe/London",
    }).format(date),
  );

  return `${ordinal(day)} ${monthYear}`;
}

function firstClassDate(letter: Letter, programmeStartDate: string) {
  const floor =
    parsedDate(programmeStartDate || DEFAULT_ACADEMIC_SETTINGS.programme_start_date) ??
    parsedDate(DEFAULT_ACADEMIC_SETTINGS.programme_start_date) ??
    new Date();
  const source = parsedDate(letter.enrolled_at ?? letter.accepted_at) ?? floor;
  const date = new Date(Math.max(source.getTime(), floor.getTime()));
  const dayOfWeek = Number(letter.class_day_of_week);

  if (Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6) {
    const daysToAdd = (dayOfWeek - date.getUTCDay() + 7) % 7;
    date.setUTCDate(date.getUTCDate() + daysToAdd);
  }

  return formatDate(date.toISOString());
}

function formatTime(value: unknown) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value ?? "").trim();

  const hour24 = Number(match[1]);
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "pm" : "am";
  return `${hour12}.${match[2]}${suffix}`;
}

function categoryValue(letter: Letter) {
  for (const value of [letter.class_name, letter.class_level]) {
    const text = String(value ?? "").trim();
    const match = text.match(/(?:category|class|level)\s*[-:]?\s*([a-z0-9]+)/i);
    if (match?.[1]) return match[1];
  }

  return String(letter.class_level ?? letter.class_name ?? "To be confirmed").trim();
}

function dressCode(gender: unknown) {
  const value = String(gender ?? "").toLowerCase();
  if (value === "female" || value === "girl") return "Black Abaya with hijab";
  if (value === "male" || value === "boy") return "White Jubbah and cap";
  return "Madrasah-approved modest clothing";
}

function classScheduleNote(dayOfWeek: unknown) {
  const day = Number(dayOfWeek);
  if (day === 0 || day === 6) return "Weekends only";

  const names = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  return Number.isInteger(day) && names[day] ? names[day] : "Scheduled classes";
}

export default function AdmissionLetterPage() {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings>(
    DEFAULT_ACADEMIC_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const studentId = params.get("studentId");

      if (!id && !studentId) {
        setError("Application or student ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          id
            ? `/api/v1/admission-letter?id=${encodeURIComponent(id)}`
            : `/api/v1/admission-letter?studentId=${encodeURIComponent(studentId ?? "")}`,
          { cache: "no-store" },
        );

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }

        const result = (await response.json()) as {
          data?: Letter;
          error?: string;
        };

        if (!response.ok || !result.data) {
          setError(result.error ?? "Unable to generate admission letter.");
          return;
        }

        setLetter(result.data);
        document.title = `BNMC Admission Letter - ${result.data.student_name}`;

        // Academic dates/times are administered centrally in the portal.
        // Admission letters keep safe defaults so a settings/API issue never
        // prevents an accepted student's letter from being generated.
        try {
          const settingsResponse = await fetch("/api/v1/portal-settings", {
            cache: "no-store",
          });

          if (settingsResponse.ok) {
            const settingsResult = (await settingsResponse.json()) as {
              settings?: Partial<AcademicSettings>;
            };

            if (settingsResult.settings) {
              setAcademicSettings({
                ...DEFAULT_ACADEMIC_SETTINGS,
                ...settingsResult.settings,
              });
            }
          }
        } catch {
          // Keep the published fallback values above.
        }
      } catch {
        setError("Unable to connect to the admission letter service.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <main className="letter-message">
        <RefreshCw />
        Preparing admission letter...
      </main>
    );
  }

  if (error || !letter) {
    return (
      <main className="letter-message">
        <h1>Admission Letter</h1>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.assign("/portal")}>
          <ArrowLeft />
          Back
        </button>
      </main>
    );
  }

  const category = categoryValue(letter);
  const isCategoryOne = /^(1|one)$/i.test(category);
  const isCategoryTwo = /^(2|two)$/i.test(category);
  const isCategoryThree = /^(3|three)$/i.test(category);
  const start =
    formatTime(letter.start_time) ||
    formatTime(academicSettings.standard_session_start) ||
    "9.30am";
  const end =
    formatTime(letter.end_time) ||
    formatTime(academicSettings.standard_session_end) ||
    "11.30am";
  const schedule = classScheduleNote(letter.class_day_of_week);
  const reference = letter.student_number || letter.application_id;

  return (
    <main className="letter-screen">
      <div className="letter-controls">
        <button type="button" onClick={() => window.location.assign("/portal")}>
          <ArrowLeft />
          Back
        </button>

        <button type="button" className="primary" onClick={() => window.print()}>
          <Printer />
          Print / Save PDF
        </button>
      </div>

      <div className="letter-pages">
        <article className="admission-letter letter-page letter-page-one">
          <header className="letter-head">
            <Image
              src="/community-logo.png"
              width={112}
              height={112}
              alt="Bolton Nigerian Muslim Community logo"
              priority
            />

            <h1>BOLTON NIGERIAN MUSLIM COMMUNITY (BNMC)</h1>
            <h2>BNMC Madrassah</h2>
            <address>
              Venue: 1st and 2nd Floor Unit
              <br />
              1a Salop Street, Bolton BL2 1DZ
            </address>
          </header>

          <div className="letter-rule" />

          <p className="letter-date">{formatDate(letter.accepted_at)}</p>

          <section className="letter-title">
            <h2>ADMISSION LETTER</h2>
            <h3>
              {letter.student_name} - REG. NO. {reference}
            </h3>
          </section>

          <section className="letter-body">
            <p>
              Dear Parent of <strong>{letter.student_name}</strong>
            </p>

            <p>As-Salaamu alaykum wa rahmatulLahi wa barakatuhu,</p>

            <p>
              We are pleased to inform you that, following the BNMC assessment,{" "}
              <strong>{letter.student_name}</strong> has been assessed and placed
              into <strong>[CATEGORY {category}]</strong>. We ask Allah (<span lang="ar" dir="rtl">سبحانه وتعالى</span>) to make this a
              means of benefit and barakah for your child.
            </p>

            <section className="letter-section class-details">
              <h3>Class Details</h3>
              <dl>
                <div><dt>Category:</dt><dd>{category}</dd></div>
                <div><dt>Class start date:</dt><dd>{firstClassDate(letter, academicSettings.programme_start_date)} ({schedule})</dd></div>
                <div><dt>Class time:</dt><dd>{start} to {end} (strict adherence required)</dd></div>
                <div><dt>Venue:</dt><dd>{POSTCODE}</dd></div>
                <div><dt>Dress code:</dt><dd>{dressCode(letter.gender)} (strict adherence required)</dd></div>
                <div className="fee-row"><dt>Fee:</dt><dd>{MONTHLY_FEE}</dd></div>
              </dl>
            </section>

            <section className="letter-section objectives">
              <h3>
                {isCategoryOne
                  ? `Objectives of Class ${category}`
                  : `Objectives of Category ${category}`}
              </h3>

              {isCategoryOne && (
                <ul>
                  <li>
                    Focus will be on foundational recognition of the Arabic alphabets, correct
                    pronunciation (makharij), and the joining of letters.
                  </li>
                  <li>
                    Nurul Bayan will be used as the core resource, supported by video materials
                    covering alphabets, signs (harakat), and letter-joining.
                  </li>
                </ul>
              )}

              {isCategoryTwo && (
                <ul>
                  <li>
                    Focus will be on being able to recite the Qur&apos;an fluently and with tajweed.
                  </li>
                  <li>
                    Jannat Al Quran will be used as the core resource, supported by video materials
                    covering recitations, tajweed topics and practical usage.
                  </li>
                </ul>
              )}

              {isCategoryThree && (
                <ul>
                  <li>
                    Focus will be on memorizing the Qur&apos;an with Tajweed.
                  </li>
                  <li>
                    Students would be allowed to move at their individual pace.
                  </li>
                </ul>
              )}

              {!isCategoryOne && !isCategoryTwo && !isCategoryThree && (
                <p>
                  The detailed learning objectives and resources for this class will be communicated
                  by the Madrasah administration.
                </p>
              )}
            </section>
          </section>

          <footer>BNMC Madrassah</footer>
        </article>

        <article className="admission-letter letter-page letter-page-two">
          <section className="letter-body second-page-body">
            {isCategoryOne && (
              <ul className="continuation-list">
                <li>
                  Memorisation will progress along a set schedule, beginning with Suratun-Nas and
                  working upwards to Suratul-A&apos;la.
                </li>
                <li>
                  Parents will shortly be advised on obtaining a copy of Nurul Bayan for home
                  revision.
                </li>
              </ul>
            )}

            {isCategoryTwo && (
              <ul className="continuation-list">
                <li>
                  Memorisation will progress along a set schedule, beginning from Suratu Naas to
                  Suratu Nabai (Juz Amma).
                </li>
                <li>
                  Parents will shortly be advised on obtaining a copy of Jannat Al Quran book. Also,
                  student should come with a Makki Qur&apos;an.
                </li>
              </ul>
            )}

            {isCategoryThree && (
              <ul className="continuation-list">
                <li>
                  Students will also attend the Tajweed classes with category 2. Jannat Al Quran will
                  be used as the core resource, supported by video materials covering several
                  recitations, tajweed topics and practical usage.
                </li>
                <li>
                  Parents will shortly be advised on obtaining a copy of Jannat Al Quran book. Also,
                  student should come with a Makki Qur&apos;an.
                </li>
              </ul>
            )}

            <p>
              Kindly note that punctuality and adherence to the stated dress code are essential to
              the smooth running of classes and to maintaining a respectful learning environment for
              all children.
            </p>

            <p>
              Should you have any questions regarding this placement, or wish to discuss your
              child&apos;s category further, please do not hesitate to contact us. Further details
              regarding the open day/taster session on {academicSettings.open_day_text || DEFAULT_ACADEMIC_SETTINGS.open_day_text} at the venue ({POSTCODE}) will
              follow separately.
            </p>

            <p>
              We look forward to welcoming <strong>{letter.student_name}</strong> to the programme.
            </p>

            <p className="closing">Jazakumullahu Khayran,</p>

            <section className="letter-signature">
              <Image
                src="/ahmad-ajileye-signature.jpg"
                width={116}
                height={84}
                alt="Signature of Ustadh Ahmad Ajileye"
              />
              <strong>Ustadh Ahmad Ajileye</strong>
              <span>07438725293</span>
              <span>On behalf of BNMC</span>
            </section>
          </section>

          <footer>BNMC Madrassah</footer>
        </article>
      </div>
    </main>
  );
}