"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Images,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Download,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  School,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  WalletCards,
  UserRound,
  X,
} from "lucide-react";

import StudentAdmissionPaymentCard from "@/components/portal/student-admission-payment-card";

import "./portal.css";
import "./multirole-ui.css";

type PortalRole =
  | "admin"
  | "teacher"
  | "finance"
  | "safeguarding"
  | "parent";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: PortalRole;
  roles?: PortalRole[];
  permissions?: string[];
};

type Row = Record<
  string,
  unknown
>;

type AdmissionClass = {
  id: string;
  name: string;
  enrolled: number;
  capacity: number;
  status: string;
};

type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: {
    value: string;
    label: string;
  }[];
};

type BillingSection =
  | "plans"
  | "agreements"
  | "invoices"
  | "direct_debit";

type PortalMessage = {
  type:
    | "success"
    | "info";
  text: string;
};

type PaymentReturn =
  | "success"
  | "cancelled"
  | null;

type DirectDebitReturn =
  | "success"
  | "cancelled"
  | null;

type DirectDebitStatus = {
  ok?: boolean;
  billingRequestId?: string;
  billingRequestStatus?: string;
  mandateId?: string | null;
  mandateStatus?: string;
  customerId?: string | null;
  last4?: string | null;
  bankName?: string | null;
  collectionMethod?: string;
  cached?: boolean;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  error?: string;
};


type StudentProfileData = {
  student: Row;
  guardians: Row[];
  enrolments: Row[];
  attendance: Row[];
  progress: Row[];
  agreements: Row[];
  invoices: Row[];
  directDebit: Row | null;
};

const nav = [
  {
    key: "dashboard",
    label: "Home",
    icon: LayoutDashboard,
    roles: "all",
    sidebar: true,
  },

  {
    key: "students",
    label: "Students",
    icon: Users,
    roles: [
      "admin",
      "teacher",
      "safeguarding",
    ],
    sidebar: true,
  },

  {
    key: "my_children",
    label: "My Children",
    icon: Users,
    roles: ["parent"],
    sidebar: true,
  },

  {
    key: "classes",
    label: "Classes & Attendance",
    icon: School,
    roles: [
      "admin",
      "teacher",
    ],
    sidebar: true,
  },

  {
    key: "billing",
    label: "Fees & Payments",
    icon: WalletCards,
    roles: [
      "admin",
      "finance",
      "parent",
    ],
    sidebar: true,
  },

  {
    key: "fee_reconciliation",
    label: "Fee Reconciliation",
    icon: ReceiptText,
    roles: [
      "admin",
      "finance",
    ],
    sidebar: true,
  },

  {
    key: "announcements",
    label: "Communication",
    icon: MessageSquare,
    roles: [
      "admin",
      "teacher",
      "parent",
    ],
    sidebar: true,
  },

  {
    key: "media_gallery",
    label: "Media Gallery",
    icon: Images,
    roles: ["admin"],
    sidebar: true,
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: [
      "admin",
      "finance",
      "safeguarding",
    ],
    sidebar: true,
  },

  /*
   * The resources below remain fully available, but
   * are intentionally hidden from the main sidebar.
   * They are reached from the task-focused workspaces
   * above so a small Madrasah does not need to navigate
   * a long list of database entities.
   */
  {
    key: "applications",
    label: "Admissions",
    icon: UserCheck,
    roles: ["admin"],
    sidebar: false,
  },

  {
    key: "guardians",
    label: "Guardians",
    icon: ShieldCheck,
    roles: [
      "admin",
      "safeguarding",
    ],
    sidebar: false,
  },

  {
    key: "enrolments",
    label: "Enrolments",
    icon: GraduationCap,
    roles: ["admin", "teacher"],
    sidebar: false,
  },

  {
    key: "attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    roles: [
      "admin",
      "teacher",
    ],
    sidebar: false,
  },

  {
    key: "progress",
    label: "Progress & Assessments",
    icon: BookOpen,
    roles: [
      "admin",
      "teacher",
      "parent",
    ],
    sidebar: false,
  },

  {
    key: "staff",
    label: "Staff & access",
    icon: GraduationCap,
    roles: [
      "admin",
      "safeguarding",
    ],
    sidebar: true,
  },

  {
    key: "settings",
    label: "Settings",
    icon: ShieldCheck,
    roles: [
      "admin",
      "safeguarding",
    ],
    sidebar: true,
  },

  {
    key: "compliance",
    label: "DBS & compliance",
    icon: ShieldCheck,
    roles: [
      "admin",
      "safeguarding",
    ],
    sidebar: false,
  },

  {
    key: "activity_log",
    label: "Activity log",
    icon: FileText,
    roles: ["admin"],
    sidebar: false,
  },

  {
    key: "academic_settings",
    label: "Academic calendar",
    icon: FileText,
    roles: ["admin"],
    sidebar: false,
  },

  {
    key: "automation_centre",
    label: "Automation & reminders",
    icon: RefreshCw,
    roles: ["admin"],
    sidebar: false,
  },

  {
    key: "system_health",
    label: "System health",
    icon: ShieldCheck,
    roles: ["admin"],
    sidebar: false,
  },
];

function sidebarSectionFor(
  key: string,
) {
  if (
    [
      "students",
      "applications",
      "guardians",
    ].includes(key)
  ) {
    return "students";
  }

  if (
    [
      "classes",
      "attendance",
      "enrolments",
      "progress",
    ].includes(key)
  ) {
    return "classes";
  }

  if (
    [
      "settings",
      "staff",
      "compliance",
      "activity_log",
      "academic_settings",
      "automation_centre",
      "system_health",
    ].includes(key)
  ) {
    return "settings";
  }

  return key;
}

function portalNavLabel(
  key: string,
  user: User | null,
) {
  if (
    key ===
      "announcements" &&
    user?.role ===
      "parent"
  ) {
    return "Messages";
  }

  return (
    nav.find(
      (item) =>
        item.key === key,
    )?.label ??
    nice(key)
  );
}


const fields: Record<
  string,
  FormField[]
> = {
  students: [
    {
      name: "studentNumber",
      label: "Student number",
      required: true,
    },

    {
      name: "firstName",
      label: "First name",
      required: true,
    },

    {
      name: "lastName",
      label: "Last name",
      required: true,
    },

    {
      name: "dateOfBirth",
      label: "Date of birth",
      type: "date",
      required: true,
    },

    {
      name: "gender",
      label: "Gender",
      required: true,
    },

    {
      name: "medicalNotes",
      label: "Medical notes",
    },

    {
      name: "allergyNotes",
      label: "Allergies",
    },
  ],

  guardians: [
    {
      name: "fullName",
      label: "Full name",
      required: true,
    },

    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
    },

    {
      name: "phone",
      label: "Phone",
      required: true,
    },

    {
      name: "address",
      label: "Address",
    },

    {
      name: "postcode",
      label: "Postcode",
    },

    {
      name: "emergencyContactNumber",
      label: "Emergency contact number",
    },

    {
      name: "relationship",
      label: "Relationship",
      required: true,
    },
  ],

  classes: [
    {
      name: "name",
      label: "Class name",
      required: true,
    },

    {
      name: "categoryId",
      label: "Category",
      required: true,
    },

    {
      name: "subject",
      label: "Subject",
      required: true,
    },

    {
      name: "teacherId",
      label: "Assigned teacher",
    },

    {
      name: "room",
      label: "Room",
      required: true,
    },

    {
      name: "dayOfWeek",
      label: "Day (0=Sun, 6=Sat)",
      type: "number",
      required: true,
    },

    {
      name: "startTime",
      label: "Start time",
      type: "time",
      required: true,
    },

    {
      name: "endTime",
      label: "End time",
      type: "time",
      required: true,
    },

    {
      name: "capacity",
      label: "Capacity",
      type: "number",
      required: true,
    },
  ],

  enrolments: [
    {
      name: "studentId",
      label: "Student ID",
      required: true,
    },

    {
      name: "classId",
      label: "Class ID",
      required: true,
    },
  ],

  attendance: [
    {
      name: "studentId",
      label: "Student ID",
      required: true,
    },

    {
      name: "classId",
      label: "Class ID",
      required: true,
    },

    {
      name: "sessionDate",
      label: "Session date",
      type: "date",
      required: true,
    },

    {
      name: "status",
      label: "Status",
      required: true,

      options: [
        {
          value: "present",
          label: "Present",
        },

        {
          value: "absent",
          label: "Absent",
        },

        {
          value: "late",
          label: "Late",
        },

        {
          value: "excused",
          label: "Excused",
        },
      ],
    },

    {
      name: "arrivalTime",
      label: "Arrival",
      type: "time",
    },

    {
      name: "collectionTime",
      label: "Collection",
      type: "time",
    },

    {
      name:
        "collectedByGuardianId",
      label:
        "Collector guardian ID",
    },

    {
      name: "notes",
      label: "Notes",
    },
  ],

  progress: [
    {
      name: "studentId",
      label: "Student ID",
      required: true,
    },

    {
      name: "classId",
      label: "Class ID",
      required: true,
    },

    {
      name: "strand",
      label: "Learning strand",
      required: true,
    },

    {
      name: "currentUnit",
      label: "Current unit",
      required: true,
    },

    {
      name: "achievement",
      label: "Achievement",
      required: true,

      options: [
        {
          value: "emerging",
          label: "Emerging",
        },

        {
          value: "developing",
          label: "Developing",
        },

        {
          value: "secure",
          label: "Secure",
        },

        {
          value: "mastered",
          label: "Mastered",
        },
      ],
    },

    {
      name: "score",
      label: "Score",
      type: "number",
    },

    {
      name: "teacherComment",
      label: "Teacher comment",
    },

    {
      name: "nextStep",
      label: "Next step",
    },

    {
      name: "assessedAt",
      label: "Assessment date",
      type: "date",
      required: true,
    },
  ],

  announcements: [
    {
      name: "title",
      label: "Title",
      required: true,
    },

    {
      name: "body",
      label: "Message",
      required: true,
    },

    {
      name: "audience",
      label: "Audience",
      required: true,
    },

    {
      name: "status",
      label:
        "Status (draft/published)",
      required: true,
    },
  ],

  compliance: [
    {
      name: "userId",
      label: "Staff user ID",
      required: true,
    },

    {
      name: "checkType",
      label:
        "Check or training type",
      required: true,
    },

    {
      name: "status",
      label: "Status",
      required: true,
    },

    {
      name: "completedAt",
      label: "Completed date",
      type: "date",
    },

    {
      name: "expiresAt",
      label: "Expiry date",
      type: "date",
    },

    {
      name: "notes",
      label: "Notes",
    },
  ],

  staff: [
    {
      name: "displayName",
      label: "Full name",
      required: true,
    },

    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
    },

    {
      name: "role",
      label: "Role",
      required: true,

      options: [
        {
          value: "teacher",
          label: "Teacher",
        },

        {
          value: "finance",
          label: "Finance",
        },

        {
          value: "safeguarding",
          label: "Safeguarding",
        },

        {
          value: "admin",
          label: "Administrator",
        },
      ],
    },

    {
      name: "password",
      label: "Temporary password (new accounts only)",
      type: "password",
      required: false,
    },
  ],
};

const headings: Record<
  string,
  string[]
> = {
  applications: [
    "student_name",
    "gender",
    "preferred_session",
    "status",
    "submitted_at",
  ],

  students: [
    "student_number",
    "name",
    "guardian",
    "phone",
    "guardian_status",
    "status",
  ],

  guardians: [
    "full_name",
    "email",
    "phone",
    "relationship",
    "children",
  ],

  classes: [
    "name",
    "subject",
    "level",
    "teacher",
    "room",
    "enrolled",
    "capacity",
  ],

  enrolments: [
    "student_name",
    "student_number",
    "class_name",
    "teacher",
    "enrolled_at",
    "status",
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
    "class_name",
    "strand",
    "current_unit",
    "achievement",
    "score",
    "next_step",
  ],

  compliance: [
    "staff_name",
    "check_type",
    "status",
    "completed_at",
    "expires_at",
  ],

  announcements: [
    "title",
    "audience",
    "status",
    "author",
    "created_at",
  ],

  staff: [
    "display_name",
    "email",
    "roles",
    "status",
  ],

  activity_log: [
    "created_at",
    "actor",
    "action",
    "entity_type",
    "entity_id",
  ],
};

const nice = (
  value: string,
) =>
  value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (c) =>
        c.toUpperCase(),
    );

const money = (
  value: unknown,
) =>
  new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    },
  ).format(
    Number(
      value || 0,
    ) / 100,
  );
function friendlyPaymentError(
  value: unknown,
  method: "card" | "direct_debit",
) {
  const raw = String(
    value ?? "",
  ).trim();

  const fallback =
    method === "direct_debit"
      ? "Direct Debit setup is temporarily unavailable. Please try again later. If the problem continues, contact the Madrasah administrator."
      : "Card payment is temporarily unavailable. Please try again later. If the problem continues, contact the Madrasah administrator.";

  if (!raw) {
    return fallback;
  }

  const lower =
    raw.toLowerCase();

  const technicalOrGeneric =
    [
      "unknown server error",
      "unexpected server error",
      "internal server error",
      "server error",
      "failed to fetch",
      "network error",
      "service unavailable",
      "bad gateway",
      "gateway timeout",
      "stripe did not return",
      "gocardless did not return",
    ].some(
      (message) =>
        lower.includes(
          message,
        ),
    );

  return technicalOrGeneric
    ? fallback
    : raw;
}

function dateValue(
  value: unknown,
) {
  if (!value) {
    return "-";
  }

  const raw =
    String(value);

  return raw.length >= 10
    ? raw.slice(
        0,
        10,
      )
    : raw;
}


type GlobalSearchResult = {
  id: string;
  kind:
    | "student"
    | "guardian"
    | "staff"
    | "application";
  title: string;
  subtitle: string;
  meta?: string;
  section: string;
  studentId?: string;
};

function GlobalSearch({
  onSelect,
}: {
  onSelect: (
    result: GlobalSearchResult,
  ) => void;
}) {
  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    results,
    setResults,
  ] =
    useState<
      GlobalSearchResult[]
    >([]);

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const shellRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(
    () => {
      const close = (
        event: MouseEvent,
      ) => {
        if (
          shellRef.current &&
          !shellRef.current.contains(
            event.target as Node,
          )
        ) {
          setOpen(false);
        }
      };

      document.addEventListener(
        "mousedown",
        close,
      );

      return () =>
        document.removeEventListener(
          "mousedown",
          close,
        );
    },
    [],
  );

  useEffect(
    () => {
      const value =
        query.trim();

      if (
        value.length < 2
      ) {
        setResults([]);
        setLoading(false);
        setError("");
        return;
      }

      const controller =
        new AbortController();

      const timer =
        window.setTimeout(
          async () => {
            setLoading(true);
            setError("");

            try {
              const response =
                await fetch(
                  `/api/v1/global-search?q=${encodeURIComponent(value)}`,
                  {
                    cache:
                      "no-store",
                    signal:
                      controller.signal,
                  },
                );

              if (
                response.status ===
                401
              ) {
                window.location.assign(
                  "/login",
                );
                return;
              }

              const payload =
                (await response
                  .json()
                  .catch(
                    () => ({}),
                  )) as {
                  data?: GlobalSearchResult[];
                  error?: string;
                };

              if (
                !response.ok
              ) {
                setResults([]);
                setError(
                  payload.error ??
                    "Unable to search.",
                );
                setOpen(true);
                return;
              }

              setResults(
                payload.data ??
                  [],
              );
              setOpen(true);
            }
            catch (
              searchError
            ) {
              if (
                searchError instanceof
                  DOMException &&
                searchError.name ===
                  "AbortError"
              ) {
                return;
              }

              setResults([]);
              setError(
                "Unable to search right now.",
              );
              setOpen(true);
            }
            finally {
              if (
                !controller
                  .signal
                  .aborted
              ) {
                setLoading(false);
              }
            }
          },
          250,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
        controller.abort();
      };
    },
    [
      query,
    ],
  );

  function choose(
    result:
      GlobalSearchResult,
  ) {
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(result);
  }

  return (
    <div
      className="global-search"
      ref={shellRef}
    >
      <Search />

      <input
        value={query}
        onChange={(event) => {
          setQuery(
            event.target.value,
          );
          setOpen(true);
        }}
        onFocus={() => {
          if (
            query.trim().length >=
            2
          ) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (
            event.key ===
            "Escape"
          ) {
            setOpen(false);
          }
        }}
        placeholder="Search students, guardians, staff..."
        aria-label="Search students, guardians, staff and applications"
        autoComplete="off"
      />

      {loading && (
        <span className="global-search-loading">
          Searching...
        </span>
      )}

      {open &&
        query.trim().length >=
          2 && (
          <div
            className="global-search-results"
            role="listbox"
          >
            {error ? (
              <div className="global-search-empty">
                {error}
              </div>
            ) : !loading &&
              results.length ===
                0 ? (
              <div className="global-search-empty">
                No matching records
              </div>
            ) : (
              results.map(
                (result) => (
                  <button
                    type="button"
                    key={`${result.kind}-${result.id}`}
                    onClick={() =>
                      choose(
                        result,
                      )
                    }
                    role="option"
                  >
                    <span className="global-search-type">
                      {nice(
                        result.kind,
                      )}
                    </span>

                    <span className="global-search-copy">
                      <b>
                        {
                          result.title
                        }
                      </b>

                      <small>
                        {
                          result.subtitle
                        }
                      </small>

                      {result.meta && (
                        <em>
                          {
                            result.meta
                          }
                        </em>
                      )}
                    </span>
                  </button>
                ),
              )
            )}
          </div>
        )}
    </div>
  );
}

export default function PortalClient() {
  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null,
    );

  const [
    active,
    setActive,
  ] =
    useState(
      "dashboard",
    );

  /*
   * Keep the current portal workspace across a normal browser refresh.
   * sessionStorage is intentionally used instead of permanent localStorage:
   * it survives refreshes in this tab but does not permanently pin a future
   * login to an old screen.
   */
  useEffect(
    () => {
      try {
        const remembered =
          window.sessionStorage.getItem(
            "bnmc_portal_active_workspace",
          );

        if (
          remembered
        ) {
          setActive(
            remembered,
          );
        }
      }
      catch {}
    },
    [],
  );

  useEffect(
    () => {
      try {
        window.sessionStorage.setItem(
          "bnmc_portal_active_workspace",
          active,
        );
      }
      catch {}
    },
    [active],
  );

  const [
    data,
    setData,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    summary,
    setSummary,
  ] =
    useState<Row>(
      {},
    );

  const [
    reports,
    setReports,
  ] =
    useState<
      Record<
        string,
        Row[]
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState(false);

  const [
    profileForm,
    setProfileForm,
  ] =
    useState(false);

  const [
    editingRecord,
    setEditingRecord,
  ] =
    useState<Row | null>(
      null,
    );

  const [
    side,
    setSide,
  ] =
    useState(false);

  const [
    portalMessage,
    setPortalMessage,
  ] =
    useState<PortalMessage | null>(
      null,
    );

  const [
    paymentReturn,
    setPaymentReturn,
  ] =
    useState<PaymentReturn>(
      null,
    );

  const [
    directDebitReturn,
    setDirectDebitReturn,
  ] =
    useState<DirectDebitReturn>(
      null,
    );

  const [
    billingStartSection,
    setBillingStartSection,
  ] =
    useState<BillingSection | null>(
      null,
    );

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    communicationFocusId,
    setCommunicationFocusId,
  ] =
    useState<string | null>(
      null,
    );

  const load =
    useCallback(
      async () => {
        if (
          [
            "billing",
            "my_children",
            "settings",
            "announcements",
            "academic_settings",
            "automation_centre",
            "system_health",
            "failed_emails",
            "homepage_settings",
            "fee_reconciliation",
          ].includes(
            active,
          )
        ) {
          setError(
            "",
          );

          setLoading(
            false,
          );

          return;
        }

        setLoading(
          true,
        );

        setError("");

        const endpoint =
          active ===
          "dashboard"
            ? "/api/v1/dashboard"
            : active ===
                "reports"
              ? "/api/v1/reports"
              : `/api/v1/${active}`;

        const response =
          await fetch(
            endpoint,
          );

        if (
          response.status ===
          401
        ) {
          window.location.assign(
            "/login",
          );

          return;
        }

        const result =
          (await response.json()) as any;

        if (
          !response.ok
        ) {
          setError(
            result.error ??
              "Unable to load records",
          );
        } else if (
          active ===
          "dashboard"
        ) {
          setSummary(
            result.summary,
          );
        } else if (
          active ===
          "reports"
        ) {
          setReports(
            result.reports,
          );
        } else {
          setData(
            result.data,
          );
        }

        setLoading(
          false,
        );
      },
      [active],
    );

  useEffect(
    () => {
      fetch(
        "/api/auth/me",
      ).then(
        async (response) => {
          if (
            !response.ok
          ) {
            window.location.assign(
              "/login",
            );

            return;
          }

          const result =
            (await response.json()) as {
              user: User;
            };

          setUser(
            result.user,
          );
        },
      );
    },
    [],
  );

  /*
   * Payment providers redirect back to the portal
   * with query parameters used only for navigation
   * and user-facing messages.
   *
   * Stripe:
   * /portal?payment=success
   * /portal?payment=cancelled
   *
   * GoCardless:
   * /portal?direct_debit=success
   * /portal?direct_debit=cancelled
   *
   * These parameters never change payment or mandate
   * state by themselves. Stripe webhooks and the
   * GoCardless sync/webhook endpoints remain the
   * authoritative sources of truth.
   */
  useEffect(
    () => {
      const params =
        new URLSearchParams(
          window.location.search,
        );

      const payment =
        params.get(
          "payment",
        );

      const directDebit =
        params.get(
          "direct_debit",
        );

      if (
        directDebit ===
          "success" ||
        directDebit ===
          "cancelled"
      ) {
        setActive(
          "billing",
        );

        setBillingStartSection(
          "direct_debit",
        );

        setDirectDebitReturn(
          directDebit,
        );

        setPortalMessage({
          type:
            directDebit ===
            "success"
              ? "success"
              : "info",

          text:
            directDebit ===
            "success"
              ? "Direct Debit details were received successfully. We are confirming the bank mandate automatically."
              : "Direct Debit setup was cancelled. No bank mandate has been activated.",
        });

        window.history.replaceState(
          {},
          "",
          "/portal",
        );

        return;
      }

      if (
        payment !==
          "success" &&
        payment !==
          "cancelled"
      ) {
        return;
      }

      setActive(
        "billing",
      );

      setBillingStartSection(
        "invoices",
      );

      setPaymentReturn(
        payment,
      );

      if (
        payment ===
        "success"
      ) {
        setPortalMessage({
          type: "success",
          text:
            "Payment successful. Your payment has been confirmed and the invoice has been updated.",
        });
      } else {
        setPortalMessage({
          type: "info",
          text:
            "Payment was cancelled. No payment has been taken.",
        });
      }

      window.history.replaceState(
        {},
        "",
        "/portal",
      );
    },
    [],
  );

  /*
   * Automatically dismiss payment
   * notifications after eight seconds.
   */
  useEffect(
    () => {
      if (
        !portalMessage
      ) {
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            setPortalMessage(
              null,
            );
          },
          8000,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      portalMessage,
    ],
  );

  useEffect(
    () => {
      if (user) {
        load();
      }
    },
    [
      user,
      load,
    ],
  );

  async function logout() {
    await fetch(
      "/api/auth/logout",
      {
        method:
          "POST",
      },
    );

    window.location.assign(
      "/",
    );
  }

  function openStudentProfile(
    studentId: unknown,
  ) {
    const id =
      String(
        studentId ??
          "",
      ).trim();

    if (!id) {
      return;
    }

    setSelectedStudentId(
      id,
    );

    setSide(
      false,
    );

    setForm(
      false,
    );
  }

  function goToBilling(
    section:
      BillingSection =
      "invoices",
  ) {
    setSelectedStudentId(
      null,
    );

    setBillingStartSection(
      section,
    );

    setActive(
      "billing",
    );

    setSide(
      false,
    );

    setForm(
      false,
    );
  }

  function leaveStudentProfile(
    target?: string,
  ) {
    setSelectedStudentId(
      null,
    );

    if (target) {
      setActive(
        target,
      );
    }
  }
  const hasPortalPermission =
    (
      permission: string,
    ) =>
      Boolean(
        user?.permissions
          ?.includes(
            permission,
          ),
      );

  const userRoles =
    user
      ? (
          user.roles?.length
            ? user.roles
            : [user.role]
        )
      : [];

  const allowed =
    nav.filter(
      (item) =>
        item.sidebar !==
          false &&
        (
          item.key ===
            "billing"
            ? (
                userRoles.some(
                  (role) =>
                    ["admin", "finance", "parent"].includes(
                      role,
                    ),
                ) ||
                hasPortalPermission(
                  "billing.view",
                )
              )
            : item.roles ===
                "all" ||
              (
                user &&
                Array.isArray(
                  item.roles,
                ) &&
                item.roles.some(
                  (role) =>
                    userRoles.includes(
                      role as PortalRole,
                    ),
                )
              )
        ),
    );
if (!user) {
    return (
      <div className="portal-loading">
        <RefreshCw />

        Loading secure workspace...
      </div>
    );
  }

  return (
    <div className="real-portal">
      <aside
        className={
          side
            ? "open"
            : ""
        }
      >
        <header>
          <a
            href="/"
            className="portal-brand-home"
            aria-label="Go to the BNMC Madrasah public homepage"
          >
            <Image
              src="/community-logo.png"
              alt="Community logo"
              width={48}
              height={48}
            />

            <span>
              <b>
                BNMC Madrasah
              </b>

              <small>
                Management system
              </small>
            </span>
          </a>

          <button
            onClick={() =>
              setSide(
                false,
              )
            }
          >
            <X />
          </button>
        </header>

        <button
          type="button"
          className="identity identity-button"
          onClick={() => {
            setProfileForm(true);
            setSide(false);
          }}
          title="Edit my profile"
        >
          <i>
            {
              user
                .displayName[0]
            }
          </i>

          <span>
            <b>
              {
                user.displayName
              }
            </b>

            <small>
              {nice(
                user.role,
              )}
            </small>
          </span>
          <Pencil className="identity-edit-icon" />
        </button>

        {userRoles.length > 1 && (
          <div
            className="portal-role-switcher"
            style={{
              margin: "0 12px 14px",
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "10px",
            }}
          >
            <small
              style={{
                display: "block",
                marginBottom: "6px",
              }}
            >
              View portal as
            </small>

            <select
              value={user.role}
              onChange={(event) => {
                const nextRole =
                  event.target.value as PortalRole;

                document.cookie =
                  `madrasat_active_role=${encodeURIComponent(nextRole)}; Path=/; SameSite=Lax; Max-Age=43200`;

                window.location.assign(
                  "/portal",
                );
              }}
              style={{
                width: "100%",
              }}
              aria-label="Choose active portal role"
            >
              {userRoles.map((role) => (
                <option
                  key={role}
                  value={role}
                >
                  {nice(role)}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav>
          {allowed.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={
                    item.key
                  }
                  className={
                    sidebarSectionFor(
                      active,
                    ) ===
                    item.key
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    if (
                      item.roles !== "all" &&
                      Array.isArray(item.roles) &&
                      !item.roles.includes(user.role)
                    ) {
                      const nextRole =
                        userRoles.find(
                          (role) =>
                            item.roles.includes(
                              role,
                            ),
                        );

                      if (nextRole) {
                        document.cookie =
                          `madrasat_active_role=${encodeURIComponent(nextRole)}; Path=/; SameSite=Lax; Max-Age=43200`;

                        setUser(
                          (current) =>
                            current
                              ? {
                                  ...current,
                                  role: nextRole,
                                }
                              : current,
                        );
                      }
                    }

                    if (
                      item.key ===
                      "media_gallery"
                    ) {
                      window.location.assign(
                        "/portal/media-gallery",
                      );
                      return;
                    }

                    if (
                      item.key ===
                      "billing"
                    ) {
                      setBillingStartSection(
                        "invoices",
                      );
                    }

                    setSelectedStudentId(
                      null,
                    );

                    setActive(
                      item.key,
                    );

                    setSide(
                      false,
                    );

                    setForm(
                      false,
                    );
                  }}
                >
                  <Icon />

                  <span>
                    {
                      item.label
                    }
                  </span>
                </button>
              );
            },
          )}
        </nav>

        <footer>
          <button
            onClick={
              logout
            }
          >
            <LogOut />

            Sign out
          </button>

          <small>
            Designed by{" "}

            <a
              href="https://nuraspecs.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <b>
                NuraSpecs
              </b>
            </a>
          </small>
        </footer>
      </aside>

      <main>
        <header>
          <button
            className="mobile-menu"
            onClick={() =>
              setSide(
                true,
              )
            }
          >
            <Menu />
          </button>

          <div>
            {selectedStudentId ? (
              <b>
                Student profile
              </b>
            ) : sidebarSectionFor(
                active,
              ) === "dashboard" ? (
              <a
                href="/"
                className="portal-public-home"
                title="Return to the public homepage"
              >
                Home
              </a>
            ) : (
              <b>
                {portalNavLabel(
                  sidebarSectionFor(
                    active,
                  ),
                  user,
                )}
              </b>
            )}

            <small>
              Cloudflare D1-backed workspace
            </small>
          </div>

          <section>
            {user.role === "admin" && (
              <GlobalSearch
                onSelect={(result) => {
                  setForm(false);
                  setEditingRecord(null);
                  setCommunicationFocusId(null);
                  setSide(false);

                  if (
                    result.kind ===
                      "student" &&
                    result.studentId
                  ) {
                    setActive(
                      "students",
                    );
                    setSelectedStudentId(
                      result.studentId,
                    );
                    return;
                  }

                  setSelectedStudentId(
                    null,
                  );
                  setActive(
                    result.section,
                  );
                }}
              />
            )}

            <NotificationBell
              user={user}
              openCommunication={(communicationId) => {
                setSelectedStudentId(null);
                setCommunicationFocusId(communicationId || null);
                setActive("announcements");
                setSide(false);
                setForm(false);
              }}
            />

            <button
              type="button"
              className="header-profile-button"
              onClick={() => setProfileForm(true)}
              aria-label="Edit my profile and notification preferences"
              title="My profile"
            >
              <i>
                {
                  user
                    .displayName[0]
                }
              </i>
            </button>
          </section>
        </header>

        <article>
          {portalMessage && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: "16px",
                padding:
                  "14px 16px",
                marginBottom:
                  "18px",
                borderRadius:
                  "10px",
                fontSize:
                  "14px",
                fontWeight:
                  600,
                background:
                  portalMessage.type ===
                  "success"
                    ? "#ecfdf3"
                    : "#eff6ff",
                border:
                  portalMessage.type ===
                  "success"
                    ? "1px solid #a7f3d0"
                    : "1px solid #bfdbfe",
                color:
                  portalMessage.type ===
                  "success"
                    ? "#166534"
                    : "#1e40af",
              }}
            >
              <span>
                {
                  portalMessage.text
                }
              </span>

              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() =>
                  setPortalMessage(
                    null,
                  )
                }
                style={{
                  background:
                    "transparent",
                  border: 0,
                  padding: 0,
                  color:
                    "inherit",
                  fontSize:
                    "20px",
                  lineHeight: 1,
                  cursor:
                    "pointer",
                }}
              >
                x
              </button>
            </div>
          )}

          {error && (
            <div className="portal-error">
              {error}

              <button
                onClick={
                  load
                }
              >
                Try again
              </button>
            </div>
          )}

          {selectedStudentId ? (
            <StudentProfile
              studentId={
                selectedStudentId
              }
              user={
                user
              }
              back={() =>
                leaveStudentProfile()
              }
              goTo={(
                target,
              ) => {
                if (
                  target ===
                  "billing"
                ) {
                  goToBilling(
                    "invoices",
                  );

                  return;
                }

                leaveStudentProfile(
                  target,
                );
              }}
            />
          ) : active ===
          "dashboard" ? (
            <Dashboard
              summary={
                summary
              }
              user={
                user
              }
              navigate={(
                target,
              ) => {
                setSelectedStudentId(
                  null,
                );

                setActive(
                  target,
                );
              }}
              openBilling={
                goToBilling
              }
            />
          ) : active ===
            "my_children" ? (
            <MyChildren
              openStudent={
                openStudentProfile
              }
            />
          ) : active ===
            "settings" ? (
            <SettingsHome
              user={user}
              navigate={(
                target,
              ) =>
                setActive(
                  target,
                )
              }
              openBilling={
                goToBilling
              }
            />
          ) : active ===
            "homepage_settings" ? (
            <HomepageSettings />
          ) : active ===
            "academic_settings" ? (
            <AcademicSettings
              user={user}
            />
          ) : active ===
            "automation_centre" ? (
            <AutomationCentre />
          ) : active ===
            "system_health" ? (
            <SystemHealth />
          ) : active ===
            "failed_emails" ? (
            <FailedEmails
              back={() =>
                setActive(
                  "dashboard",
                )
              }
            />
          ) : active ===
            "reports" ? (
            <Reports
              reports={
                reports
              }
            />
          ) : active ===
            "fee_reconciliation" ? (
            <FeeReconciliation
              user={user}
            />
          ) : active ===
            "billing" ? (
            <Billing
              user={
                user
              }
              paymentReturn={
                paymentReturn
              }
              directDebitReturn={
                directDebitReturn
              }
              startSection={
                billingStartSection
              }
              openStudent={
                openStudentProfile
              }
            />
          ) : active ===
            "announcements" ? (
            <CommunicationCentre
              user={
                user
              }
              focusId={communicationFocusId}
              onFocusHandled={() =>
                setCommunicationFocusId(null)
              }
            />
          ) : (
            <Records
              resource={
                active
              }
              rows={
                data
              }
              loading={
                loading
              }
              canCreate={
                Boolean(
                  fields[
                    active
                  ],
                ) &&
                (
                  user.role === "admin" ||
                  (
                    user.role === "teacher" &&
                    [
                      "attendance",
                      "progress",
                    ].includes(
                      active,
                    )
                  )
                )
              }
              canManage={
                user.role ===
                  "admin" &&
                [
                  "applications",
                  "students",
                  "guardians",
                  "classes",
                  "enrolments",
                  "attendance",
                  "announcements",
                  "staff",
                ].includes(
                  active,
                )
              }
              create={() => {
                setEditingRecord(
                  null,
                );

                setForm(
                  true,
                );
              }}
              edit={(row) => {
                setEditingRecord(
                  row,
                );

                setForm(
                  true,
                );
              }}
              refresh={
                load
              }
              openStudent={
                openStudentProfile
              }
              user={
                user
              }
              navigate={(
                target,
              ) =>
                setActive(
                  target,
                )
              }
              openBilling={
                goToBilling
              }
              recordProgress={(row) => {
                setActive(
                  "progress",
                );
                setEditingRecord({
                  student_id:
                    row.student_id,
                  student_name:
                    row.student_name,
                  student_number:
                    row.student_number,
                  class_id:
                    row.class_id,
                  class_name:
                    row.class_name,
                });
                setForm(
                  true,
                );
              }}
            />
          )}
        </article>
      </main>

      {form &&
        active !==
          "billing" && (
          active ===
            "enrolments" ? (
            <EnrolmentForm
              initial={
                editingRecord
              }
              close={() => {
                setEditingRecord(
                  null,
                );
                setForm(
                  false,
                );
              }}
              saved={() => {
                setEditingRecord(
                  null,
                );
                setForm(
                  false,
                );
                load();
              }}
            />
          ) : active ===
            "progress" ? (
            <ProgressAssessmentForm
              user={
                user
              }
              initial={
                editingRecord
              }
              close={() => {
                setEditingRecord(
                  null,
                );
                setForm(
                  false,
                );
              }}
              saved={() => {
                setEditingRecord(
                  null,
                );
                setForm(
                  false,
                );
                load();
              }}
            />
          ) : (
            <CreateForm
              resource={
                active
              }
              initial={
                editingRecord
              }
              close={() => {
                setEditingRecord(
                  null,
                );

                setForm(
                  false,
                );
              }}
              saved={() => {
                setEditingRecord(
                  null,
                );

                setForm(
                  false,
                );

                load();
              }}
            />
          )
        )}

      {profileForm && (
        <MyProfileForm
          user={user}
          close={() =>
            setProfileForm(false)
          }
          saved={(updated) => {
            setUser((current) =>
              current
                ? {
                    ...current,
                    ...updated,
                  }
                : current,
            );
            setProfileForm(false);
          }}
        />
      )}
    </div>
  );
}


function MyProfileForm({
  user,
  close,
  saved,
}: {
  user: User;
  close: () => void;
  saved: (
    updated: Pick<
      User,
      "displayName" | "email"
    >,
  ) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parentDetails, setParentDetails] = useState<Row | null>(null);
  const [parentLoading, setParentLoading] = useState(user.role === "parent");
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState({
    appMessages: true,
    emailMessages: true,
    feeReminders: true,
    attendanceAlerts: true,
    weeklySummary: false,
  });

  useEffect(() => {
    if (user.role !== "parent") {
      setParentLoading(false);
      return;
    }

    let cancelled = false;

    fetch("/api/v1/parent-profile", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          data?: Row;
          error?: string;
        };

        if (!response.ok || !result.data) {
          throw new Error(result.error ?? "Unable to load your contact details.");
        }

        if (!cancelled) {
          setParentDetails(result.data);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your contact details.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setParentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.role]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/portal-settings", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          preferences?: {
            appMessages?: boolean;
            emailMessages?: boolean;
            feeReminders?: boolean;
            attendanceAlerts?: boolean;
            weeklySummary?: boolean;
          };
        };

        if (!cancelled && response.ok && result.preferences) {
          setNotificationPreferences({
            appMessages: result.preferences.appMessages !== false,
            emailMessages: result.preferences.emailMessages !== false,
            feeReminders: result.preferences.feeReminders !== false,
            attendanceAlerts: result.preferences.attendanceAlerts !== false,
            weeklySummary: result.preferences.weeklySummary === true,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setPreferencesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData(
      event.currentTarget,
    );

    try {
      const response = await fetch(
        user.role === "parent"
          ? "/api/v1/parent-profile"
          : "/api/v1/profile",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            displayName: formData.get("displayName"),
            email: formData.get("email"),
            ...(user.role === "parent"
              ? {
                  phone: formData.get("phone"),
                  address: formData.get("address"),
                  postcode: formData.get("postcode"),
                  emergencyContactNumber: formData.get("emergencyContactNumber"),
                }
              : {}),
          }),
        },
      );
      const result = (await response
        .json()
        .catch(() => ({}))) as {
        data?: Pick<User, "displayName" | "email">;
        error?: string;
      };

      if (!response.ok || !result.data) {
        setError(
          result.error ?? "Unable to update your profile.",
        );
        return;
      }

      const preferencesResponse = await fetch("/api/v1/portal-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: "notifications",
          ...notificationPreferences,
        }),
      });

      if (!preferencesResponse.ok) {
        const preferencesResult = (await preferencesResponse.json().catch(() => ({}))) as { error?: string };
        setError(preferencesResult.error ?? "Your profile was saved, but notification preferences could not be updated.");
        return;
      }

      saved(result.data);
    } catch {
      setError(
        "Unable to connect to the profile service.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>Account profile</small>
            <h2>Edit my profile</h2>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        {parentLoading ? (
          <div className="profile-self-service-loading">
            <RefreshCw /> Loading your contact details...
          </div>
        ) : (
          <div className="form-grid">
            <label>
              Full name
              <input
                name="displayName"
                defaultValue={String(parentDetails?.full_name ?? user.displayName)}
                required
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                defaultValue={String(parentDetails?.email ?? user.email)}
                required
              />
            </label>

            {user.role === "parent" && (
              <>
                <label>
                  Phone
                  <input
                    name="phone"
                    defaultValue={String(parentDetails?.phone ?? "")}
                    required
                  />
                </label>
                <label>
                  Postcode
                  <input
                    name="postcode"
                    defaultValue={String(parentDetails?.postcode ?? "")}
                  />
                </label>
                <label className="profile-wide-field">
                  Address
                  <input
                    name="address"
                    defaultValue={String(parentDetails?.address ?? "")}
                  />
                </label>
                <label>
                  Emergency contact number
                  <input
                    name="emergencyContactNumber"
                    defaultValue={String(parentDetails?.emergency_contact_number ?? "")}
                  />
                </label>
              </>
            )}
          </div>
        )}

        <fieldset className="notification-preferences-fieldset" disabled={preferencesLoading || busy}>
          <legend>Automated notification preferences</legend>
          <p>
            Choose how optional automated reminders should reach you. Important manual messages from the Madrasah are not blocked by these preferences.
          </p>
          <div className="notification-preferences-grid">
            {[
              ["appMessages", "Portal notifications"],
              ["emailMessages", "Email notifications"],
              ["feeReminders", "Fee reminders"],
              ["attendanceAlerts", "Attendance alerts"],
              ["weeklySummary", "Weekly summary (when scheduled delivery is enabled)"],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(notificationPreferences[key as keyof typeof notificationPreferences])}
                  onChange={(event) =>
                    setNotificationPreferences((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="profile-form-note">
          {user.role === "parent"
            ? "You can update your own contact details here. Changes to a child's legal name, date of birth or guardian relationship should still be requested through the Madrasah administrator."
            : "Your role and access permissions can only be changed by another administrator."}
        </p>

        {error && <output>{error}</output>}

        <footer>
          <button
            type="button"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || parentLoading || preferencesLoading}
          >
            {busy ? "Saving..." : "Save profile"}
          </button>
        </footer>
      </form>
    </div>
  );
}


function MyChildren({
  openStudent,
}: {
  openStudent:
    (studentId: unknown) => void;
}) {
  const [
    rows,
    setRows,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const loadChildren =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError("");

        try {
          const response =
            await fetch(
              "/api/v1/my-children",
              {
                cache:
                  "no-store",
              },
            );

          if (
            response.status ===
            401
          ) {
            window.location.assign(
              "/login",
            );

            return;
          }

          const result =
            (await response.json()) as {
              data?: Row[];
              error?: string;
            };

          if (
            !response.ok
          ) {
            setError(
              result.error ??
                "Unable to load your children.",
            );

            return;
          }

          setRows(
            result.data ??
              [],
          );
        } catch {
          setError(
            "Unable to connect to the student service.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      loadChildren();
    },
    [
      loadChildren,
    ],
  );

  return (
    <section className="records family-workspace">
      <div className="records-head">
        <div>
          <h1>
            My Children
          </h1>

          <p>
            Open a child to see classes, attendance, progress assessments, fees and payments in one place.
          </p>
        </div>

        <span>
          <button
            type="button"
            onClick={
              loadChildren
            }
          >
            <RefreshCw />

            Refresh
          </button>
        </span>
      </div>

      {error && (
        <div className="portal-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty">
          <RefreshCw />

          Loading children...
        </div>
      ) : rows.length ===
        0 ? (
        <div className="empty">
          <Users />

          <b>
            No children linked yet
          </b>

          <p>
            Please contact the Madrasah administrator if a child should appear here.
          </p>
        </div>
      ) : (
        <div className="children-grid">
          {rows.map(
            (
              row,
              index,
            ) => {
              const name =
                String(
                  row.name ??
                    `${row.first_name ?? ""} ${row.last_name ?? ""}`,
                ).trim() ||
                "Student";

              return (
                <button
                  type="button"
                  className="child-card"
                  key={String(
                    row.id ??
                      index,
                  )}
                  onClick={() =>
                    openStudent(
                      row.id,
                    )
                  }
                >
                  <span className="child-avatar">
                    {name
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span className="child-card-copy">
                    <strong>
                      {name}
                    </strong>

                    <small>
                      {String(
                        row.student_number ??
                          "",
                      )}
                    </small>

                    <small>
                      {String(
                        row.class_name ??
                          "No current class",
                      )}
                    </small>
                  </span>

                  <span className="child-card-action">
                    View profile
                  </span>
                </button>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

function SettingsHome({
  user,
  navigate,
  openBilling,
}: {
  user: User;
  navigate:
    (target: string) => void;
  openBilling:
    (
      section?:
        BillingSection,
    ) => void;
}) {
  const cards = [
    {
      title:
        "Fee setup",
      text:
        "Set the standard Madrasah fee and review fee plans. This is normally configured once and changed only when needed.",
      icon:
        CreditCard,
      action:
        () =>
          openBilling(
            "plans",
          ),
      label:
        "Manage fee setup",
    },

    {
      title:
        "Staff & access",
      text:
        "Add the administrator or teacher accounts that need access to the portal.",
      icon:
        GraduationCap,
        Images,
      action:
        () =>
          navigate(
            "staff",
          ),
      label:
        "Manage staff",
    },
    {
      title:
        "Users & permissions",
      text:
        "Grant or revoke billing and payment permissions for staff and parent accounts.",
      icon:
        ShieldCheck,
      action:
        () =>
          window.location.assign(
            "/portal/permissions",
          ),
      label:
        "Manage permissions",
    },


    {
      title:
        "Safeguarding & compliance",
      text:
        "Keep DBS checks, training and expiry dates together.",
      icon:
        ShieldCheck,
      action:
        () =>
          navigate(
            "compliance",
          ),
      label:
        "Open compliance",
    },

    {
      title:
        "Activity log",
      text:
        "Review important administrative actions such as deletions, status changes, admissions, billing and communications.",
      icon:
        FileText,
      action:
        () =>
          navigate(
            "activity_log",
          ),
      label:
        "View activity",
    },

    ...(user.role === "admin"
      ? [
          {
            title: "Public homepage",
            text: "Update the admissions banner, parent testimonial and choose the gallery images shown in the homepage hero.",
            icon: Images,
            action: () => navigate("homepage_settings"),
            label: "Manage homepage",
          },
          {
            title: "Academic year & calendar",
            text: "Manage the academic year, term dates, programme start date, assessment wording and standard session times used across the portal.",
            icon: FileText,
            action: () => navigate("academic_settings"),
            label: "Manage calendar",
          },
          {
            title: "Automation & reminders",
            text: "Review overdue-fee, attendance and compliance reminder rules, notification candidates and management report delivery settings.",
            icon: RefreshCw,
            action: () => navigate("automation_centre"),
            label: "Open automation",
          },
          {
            title: "System health",
            text: "Check database, email, card payment, Direct Debit and recent payment webhook health without exposing credentials.",
            icon: ShieldCheck,
            action: () => navigate("system_health"),
            label: "Check system health",
          },
        ]
      : []),

    {
      title:
        "Guardian records",
      text:
        "Review parent and guardian contact records when a correction is needed.",
      icon:
        Users,
      action:
        () =>
          navigate(
            "guardians",
          ),
      label:
        "View guardians",
    },
  ];

  return (
    <section className="settings-workspace">
      <div className="records-head">
        <div>
          <h1>
            Settings
          </h1>

          <p>
            Less frequently used administration is kept here so the daily workspace stays simple.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {cards.map(
          (card) => {
            const Icon =
              card.icon;

            return (
              <section
                className="portal-card settings-card"
                key={
                  card.title
                }
              >
                <i>
                  <Icon />
                </i>

                <div>
                  <h3>
                    {card.title}
                  </h3>

                  <p>
                    {card.text}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    card.action
                  }
                >
                  {card.label}
                </button>
              </section>
            );
          },
        )}
      </div>
    </section>
  );
}



function HomepageSettings() {
  const [
    settings,
    setSettings,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    media,
    setMedia,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    notice,
    setNotice,
  ] =
    useState(
      "",
    );

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );
        setError(
          "",
        );

        try {
          const [
            settingsResponse,
            galleryResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/v1/portal-settings",
                {
                  cache:
                    "no-store",
                },
              ),
              fetch(
                "/api/gallery?limit=60",
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const settingsResult =
            (await settingsResponse
              .json()
              .catch(
                () => ({}),
              )) as {
              settings?:
                Record<
                  string,
                  string
                >;
              error?: string;
            };

          const galleryResult =
            (await galleryResponse
              .json()
              .catch(
                () => ({}),
              )) as {
              data?: Row[];
            };

          if (
            !settingsResponse.ok
          ) {
            setError(
              settingsResult.error ??
                "Unable to load homepage settings.",
            );
            return;
          }

          setSettings(
            settingsResult.settings ??
              {},
          );

          if (
            galleryResponse.ok
          ) {
            setMedia(
              (
                galleryResult.data ??
                []
              ).filter(
                (item) =>
                  String(
                    item.media_type ??
                      "",
                  ) ===
                    "image" &&
                  Boolean(
                    item.mediaUrl,
                  ),
              ),
            );
          }
        }
        catch {
          setError(
            "Unable to connect to the homepage settings service.",
          );
        }
        finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );

  function update(
    key: string,
    value: string,
  ) {
    setSettings(
      (current) => ({
        ...current,
        [key]:
          value,
      }),
    );
  }

  function selectedHeroIds() {
    try {
      const parsed =
        JSON.parse(
          settings.homepage_hero_media_ids ??
            "[]",
        );

      return Array.isArray(
        parsed,
      )
        ? parsed.filter(
            (value) =>
              typeof value ===
              "string",
          )
        : [];
    }
    catch {
      return [];
    }
  }

  function toggleHero(
    id: string,
  ) {
    const selected =
      selectedHeroIds();

    const exists =
      selected.includes(
        id,
      );

    if (
      !exists &&
      selected.length >=
        6
    ) {
      setError(
        "Choose up to 6 hero images.",
      );
      return;
    }

    setError(
      "",
    );

    update(
      "homepage_hero_media_ids",
      JSON.stringify(
        exists
          ? selected.filter(
              (value) =>
                value !==
                id,
            )
          : [
              ...selected,
              id,
            ],
      ),
    );
  }

  async function save(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(
      true,
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      const response =
        await fetch(
          "/api/v1/portal-settings",
          {
            method:
              "PATCH",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                scope:
                  "homepage",
                settings: {
                  homepage_announcement_enabled:
                    settings.homepage_announcement_enabled ??
                    "true",
                  homepage_announcement_text:
                    settings.homepage_announcement_text ??
                    "",
                  homepage_announcement_cta_label:
                    settings.homepage_announcement_cta_label ??
                    "",
                  homepage_announcement_cta_url:
                    settings.homepage_announcement_cta_url ??
                    "/apply",
                  homepage_testimonial_quote:
                    settings.homepage_testimonial_quote ??
                    "",
                  homepage_testimonial_author:
                    settings.homepage_testimonial_author ??
                    "",
                  homepage_hero_media_ids:
                    settings.homepage_hero_media_ids ??
                    "[]",
                },
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          settings?:
            Record<
              string,
              string
            >;
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to save homepage settings.",
        );
        return;
      }

      if (
        result.settings
      ) {
        setSettings(
          result.settings,
        );
      }

      setNotice(
        "Public homepage settings saved. Changes appear on the public page within about a minute.",
      );
    }
    catch {
      setError(
        "Unable to connect to the homepage settings service.",
      );
    }
    finally {
      setSaving(
        false,
      );
    }
  }

  const selected =
    selectedHeroIds();

  return (
    <section className="settings-workspace homepage-settings-workspace">
      <div className="records-head">
        <div>
          <h1>
            Public homepage
          </h1>

          <p>
            Keep the public page fresh without changing code. These are intentionally the few homepage items an administrator is likely to update.
          </p>
        </div>

        <a
          className="homepage-preview-link"
          href="/"
          target="_blank"
          rel="noreferrer"
        >
          Preview public page
        </a>
      </div>

      {error && (
        <div className="portal-error">
          {error}
        </div>
      )}

      {notice && (
        <div className="portal-success">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="portal-card homepage-settings-loading">
          Loading homepage settings...
        </div>
      ) : (
        <form
          className="homepage-settings-form"
          onSubmit={
            save
          }
        >
          <section className="portal-card homepage-settings-section">
            <header>
              <div>
                <small>
                  Top of homepage
                </small>

                <h2>
                  Admissions announcement
                </h2>

                <p>
                  Use this for admissions, opening dates or an important short notice.
                </p>
              </div>

              <label className="homepage-setting-toggle">
                <input
                  type="checkbox"
                  checked={
                    settings.homepage_announcement_enabled !==
                    "false"
                  }
                  onChange={(event) =>
                    update(
                      "homepage_announcement_enabled",
                      event.target.checked
                        ? "true"
                        : "false",
                    )
                  }
                />

                <span>
                  Show announcement
                </span>
              </label>
            </header>

            <div className="homepage-settings-fields">
              <label className="wide">
                Announcement text

                <input
                  value={
                    settings.homepage_announcement_text ??
                    ""
                  }
                  onChange={(event) =>
                    update(
                      "homepage_announcement_text",
                      event.target.value,
                    )
                  }
                  maxLength={180}
                  placeholder="Admissions are now open..."
                />
              </label>

              <label>
                Button label

                <input
                  value={
                    settings.homepage_announcement_cta_label ??
                    ""
                  }
                  onChange={(event) =>
                    update(
                      "homepage_announcement_cta_label",
                      event.target.value,
                    )
                  }
                  maxLength={40}
                  placeholder="Apply now"
                />
              </label>

              <label>
                Button link

                <input
                  value={
                    settings.homepage_announcement_cta_url ??
                    "/apply"
                  }
                  onChange={(event) =>
                    update(
                      "homepage_announcement_cta_url",
                      event.target.value,
                    )
                  }
                  maxLength={300}
                  placeholder="/apply"
                />
              </label>
            </div>
          </section>

          <section className="portal-card homepage-settings-section">
            <header>
              <div>
                <small>
                  Community voice
                </small>

                <h2>
                  Parent testimonial
                </h2>

                <p>
                  A single short quote keeps the homepage credible without turning it into a complicated testimonial system.
                </p>
              </div>
            </header>

            <div className="homepage-settings-fields">
              <label className="wide">
                Testimonial

                <textarea
                  value={
                    settings.homepage_testimonial_quote ??
                    ""
                  }
                  onChange={(event) =>
                    update(
                      "homepage_testimonial_quote",
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="A warm and nurturing environment..."
                />
              </label>

              <label className="wide">
                Attribution

                <input
                  value={
                    settings.homepage_testimonial_author ??
                    ""
                  }
                  onChange={(event) =>
                    update(
                      "homepage_testimonial_author",
                      event.target.value,
                    )
                  }
                  maxLength={100}
                  placeholder="A Parent, Bolton"
                />
              </label>
            </div>
          </section>

          <section className="portal-card homepage-settings-section">
            <header>
              <div>
                <small>
                  First impression
                </small>

                <h2>
                  Hero gallery
                </h2>

                <p>
                  Select up to six existing gallery photos. Their order below is the order they were selected.
                </p>
              </div>

              <span className="homepage-selection-count">
                {selected.length}/6 selected
              </span>
            </header>

            {media.length ===
            0 ? (
              <div className="homepage-media-empty">
                No public gallery images are available yet. Add images in Media Gallery first.
              </div>
            ) : (
              <div className="homepage-media-picker">
                {media.map(
                  (item) => {
                    const id =
                      String(
                        item.id ??
                          "",
                      );

                    const checked =
                      selected.includes(
                        id,
                      );

                    const position =
                      selected.indexOf(
                        id,
                      );

                    return (
                      <button
                        type="button"
                        key={
                          id
                        }
                        className={
                          checked
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          toggleHero(
                            id,
                          )
                        }
                      >
                        <img
                          src={
                            String(
                              item.mediaUrl ??
                                "",
                            )
                          }
                          alt={
                            String(
                              item.title ??
                                "Gallery image",
                            )
                          }
                        />

                        <span>
                          {checked
                            ? position +
                              1
                            : "Select"}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            <p className="phase3-note">
              If no photos are selected, the homepage continues using the normal featured gallery/carousel automatically.
            </p>
          </section>

          <footer className="phase3-form-footer">
            <button
              className="primary"
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : "Save homepage settings"}
            </button>
          </footer>
        </form>
      )}
    </section>
  );
}

function AcademicSettings({
  user,
}: {
  user: User;
}) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/portal-settings", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as {
        settings?: Record<string, string>;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to load academic settings.");
        return;
      }

      setSettings(result.settings ?? {});
    } catch {
      setError("Unable to connect to the settings service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update(key: string, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/v1/portal-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: "academic",
          settings: {
            academic_year_label: settings.academic_year_label,
            term_name: settings.term_name,
            term_start_date: settings.term_start_date,
            term_end_date: settings.term_end_date,
            programme_start_date: settings.programme_start_date,
            assessment_dates_text: settings.assessment_dates_text,
            open_day_text: settings.open_day_text,
            standard_session_start: settings.standard_session_start,
            standard_session_end: settings.standard_session_end,
            holiday_notes: settings.holiday_notes,
          },
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        settings?: Record<string, string>;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to save academic settings.");
        return;
      }

      if (result.settings) setSettings(result.settings);
      setNotice("Academic calendar settings saved successfully.");
    } catch {
      setError("Unable to connect to the settings service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="records phase3-workspace">
      <div className="records-head">
        <div>
          <h1>Academic year & calendar</h1>
          <p>
            Central dates and session details used by the portal and admission letters.
          </p>
        </div>
        <span>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw /> Refresh
          </button>
        </span>
      </div>

      {error && <div className="portal-error">{error}</div>}
      {notice && <div className="records-notice success">{notice}</div>}

      {loading ? (
        <div className="empty"><RefreshCw /> Loading academic settings...</div>
      ) : (
        <form className="portal-card phase3-form" onSubmit={save}>
          <div className="phase3-form-grid">
            <label>
              Academic year
              <input
                value={settings.academic_year_label ?? ""}
                onChange={(event) => update("academic_year_label", event.target.value)}
                placeholder="2026/2027"
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Current term
              <input
                value={settings.term_name ?? ""}
                onChange={(event) => update("term_name", event.target.value)}
                placeholder="Autumn Term"
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Term start date
              <input
                type="date"
                value={settings.term_start_date ?? ""}
                onChange={(event) => update("term_start_date", event.target.value)}
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Term end date
              <input
                type="date"
                value={settings.term_end_date ?? ""}
                onChange={(event) => update("term_end_date", event.target.value)}
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Programme start date
              <input
                type="date"
                value={settings.programme_start_date ?? ""}
                onChange={(event) => update("programme_start_date", event.target.value)}
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Open day / taster wording
              <input
                value={settings.open_day_text ?? ""}
                onChange={(event) => update("open_day_text", event.target.value)}
                placeholder="Sunday 30th August"
                disabled={user.role !== "admin"}
              />
            </label>
            <label className="phase3-wide-field">
              Assessment dates wording for admission letters
              <input
                value={settings.assessment_dates_text ?? ""}
                onChange={(event) => update("assessment_dates_text", event.target.value)}
                placeholder="19th and 26th July 2026"
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Standard session start
              <input
                type="time"
                value={settings.standard_session_start ?? ""}
                onChange={(event) => update("standard_session_start", event.target.value)}
                disabled={user.role !== "admin"}
              />
            </label>
            <label>
              Standard session end
              <input
                type="time"
                value={settings.standard_session_end ?? ""}
                onChange={(event) => update("standard_session_end", event.target.value)}
                disabled={user.role !== "admin"}
              />
            </label>
            <label className="phase3-wide-field">
              Holiday / closure notes
              <textarea
                rows={4}
                value={settings.holiday_notes ?? ""}
                onChange={(event) => update("holiday_notes", event.target.value)}
                placeholder="Example: 20 December 2026 – 3 January 2027: Winter break"
                disabled={user.role !== "admin"}
              />
            </label>
          </div>

          <p className="phase3-note">
            Class-specific times still take precedence where a class has its own timetable. The programme start, assessment wording and open-day text are used by admission letters when available.
          </p>

          {user.role === "admin" && (
            <footer className="phase3-form-footer">
              <button className="primary" disabled={saving}>
                {saving ? "Saving..." : "Save academic settings"}
              </button>
            </footer>
          )}
        </form>
      )}
    </section>
  );
}

function AutomationCentre() {
  const [data, setData] = useState<{
    settings?: Record<string, string>;
    candidates?: {
      fee?: Row[];
      compliance?: Row[];
      absences?: Row[];
    };
    recentRuns?: Row[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/automation-centre", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as typeof data & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to load automation centre.");
        return;
      }
      setData(result);
    } catch {
      setError("Unable to connect to the automation service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setting(key: string, fallback = "") {
    return String(data.settings?.[key] ?? fallback);
  }

  function updateSetting(key: string, value: string) {
    setData((current) => ({
      ...current,
      settings: {
        ...(current.settings ?? {}),
        [key]: value,
      },
    }));
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/v1/portal-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: "automation",
          settings: data.settings ?? {},
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save automation settings.");
        return;
      }
      setNotice("Automation rules saved successfully.");
      await load();
    } catch {
      setError("Unable to connect to the settings service.");
    } finally {
      setSaving(false);
    }
  }

  async function run(action: string) {
    setRunning(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/automation-centre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to run this reminder action.");
        return;
      }
      setNotice(result.message ?? "Automation action completed.");
      await load();
      window.dispatchEvent(new Event("bnmc-notifications-changed"));
    } catch {
      setError("Unable to connect to the automation service.");
    } finally {
      setRunning("");
    }
  }

  const fee = data.candidates?.fee ?? [];
  const compliance = data.candidates?.compliance ?? [];
  const absences = data.candidates?.absences ?? [];

  return (
    <section className="records phase3-workspace">
      <div className="records-head">
        <div>
          <h1>Automation & reminders</h1>
          <p>
            Configure reminder rules, preview who needs attention, and run controlled communication batches.
          </p>
        </div>
        <span>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw /> Refresh candidates
          </button>
        </span>
      </div>

      {error && <div className="portal-error">{error}</div>}
      {notice && <div className="records-notice success">{notice}</div>}

      <div className="automation-summary-grid">
        <section className="portal-card">
          <small>Overdue fee candidates</small>
          <strong>{loading ? "..." : fee.length}</strong>
          <span>{setting("fee_reminder_days_overdue", "7")}+ days overdue</span>
        </section>
        <section className="portal-card">
          <small>Attendance alert candidates</small>
          <strong>{loading ? "..." : absences.length}</strong>
          <span>{setting("absence_alert_threshold", "2")}+ absences in 30 days</span>
        </section>
        <section className="portal-card">
          <small>Compliance due soon</small>
          <strong>{loading ? "..." : compliance.length}</strong>
          <span>Within {setting("compliance_reminder_days", "30")} days</span>
        </section>
      </div>

      <form className="portal-card phase3-form" onSubmit={saveSettings}>
        <div className="phase3-section-head">
          <div>
            <small>Rules</small>
            <h3>Reminder thresholds</h3>
          </div>
        </div>

        <div className="automation-rules-grid">
          <label className="automation-toggle">
            <input
              type="checkbox"
              checked={setting("fee_reminder_enabled", "true") === "true"}
              onChange={(event) => updateSetting("fee_reminder_enabled", String(event.target.checked))}
            />
            <span><b>Fee reminders</b><small>Notify parents when invoices remain overdue.</small></span>
          </label>
          <label>
            Days overdue before reminder
            <input
              type="number"
              min="1"
              value={setting("fee_reminder_days_overdue", "7")}
              onChange={(event) => updateSetting("fee_reminder_days_overdue", event.target.value)}
            />
          </label>

          <label className="automation-toggle">
            <input
              type="checkbox"
              checked={setting("absence_alert_enabled", "true") === "true"}
              onChange={(event) => updateSetting("absence_alert_enabled", String(event.target.checked))}
            />
            <span><b>Attendance alerts</b><small>Flag repeated absences within the last 30 days.</small></span>
          </label>
          <label>
            Absence threshold
            <input
              type="number"
              min="1"
              value={setting("absence_alert_threshold", "2")}
              onChange={(event) => updateSetting("absence_alert_threshold", event.target.value)}
            />
          </label>

          <label className="automation-toggle">
            <input
              type="checkbox"
              checked={setting("compliance_reminder_enabled", "true") === "true"}
              onChange={(event) => updateSetting("compliance_reminder_enabled", String(event.target.checked))}
            />
            <span><b>Compliance reminders</b><small>Email staff before DBS/training records expire.</small></span>
          </label>
          <label>
            Days before expiry
            <input
              type="number"
              min="1"
              value={setting("compliance_reminder_days", "30")}
              onChange={(event) => updateSetting("compliance_reminder_days", event.target.value)}
            />
          </label>
        </div>

        <div className="phase3-section-head scheduled-report-head">
          <div>
            <small>Management report</small>
            <h3>Scheduled report preferences</h3>
          </div>
        </div>

        <div className="automation-rules-grid">
          <label className="automation-toggle">
            <input
              type="checkbox"
              checked={setting("scheduled_report_enabled", "false") === "true"}
              onChange={(event) => updateSetting("scheduled_report_enabled", String(event.target.checked))}
            />
            <span><b>Scheduled report enabled</b><small>Store the preferred recurring delivery rule.</small></span>
          </label>
          <label>
            Cadence
            <select
              value={setting("scheduled_report_cadence", "weekly")}
              onChange={(event) => updateSetting("scheduled_report_cadence", event.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label>
            Delivery day
            <select
              value={setting("scheduled_report_day", "Monday")}
              onChange={(event) => updateSetting("scheduled_report_day", event.target.value)}
            >
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
          <label>
            Recipient email
            <input
              type="email"
              value={setting("scheduled_report_recipient", "")}
              onChange={(event) => updateSetting("scheduled_report_recipient", event.target.value)}
              placeholder="admin@example.com"
            />
          </label>
        </div>

        <p className="phase3-note warning-note">
          Reminder batches are intentionally run from this control centre while the client validates thresholds and wording. The recurring report schedule is stored now; unattended Cloudflare Cron execution can be enabled as the next production-hardening step after validation.
        </p>

        <footer className="phase3-form-footer">
          <button className="primary" disabled={saving}>
            {saving ? "Saving..." : "Save automation settings"}
          </button>
        </footer>
      </form>

      <div className="automation-actions-grid">
        <section className="portal-card automation-action-card">
          <div><CreditCard /><span><b>Fee reminders</b><small>{fee.length} candidate invoice{fee.length === 1 ? "" : "s"}</small></span></div>
          <button type="button" className="primary" disabled={Boolean(running) || fee.length === 0} onClick={() => void run("run_fee_reminders")}>
            {running === "run_fee_reminders" ? "Sending..." : "Send fee reminders"}
          </button>
          <ul>{fee.slice(0, 5).map((row) => <li key={String(row.invoice_id)}>{String(row.student_name)} · {money(row.balance_pence)}</li>)}</ul>
        </section>

        <section className="portal-card automation-action-card">
          <div><ClipboardCheck /><span><b>Attendance alerts</b><small>{absences.length} student{absences.length === 1 ? "" : "s"} meet the threshold</small></span></div>
          <button type="button" className="primary" disabled={Boolean(running) || absences.length === 0} onClick={() => void run("run_absence_alerts")}>
            {running === "run_absence_alerts" ? "Sending..." : "Send attendance alerts"}
          </button>
          <ul>{absences.slice(0, 5).map((row) => <li key={String(row.student_id)}>{String(row.student_name)} · {String(row.absence_count)} absences</li>)}</ul>
        </section>

        <section className="portal-card automation-action-card">
          <div><ShieldCheck /><span><b>Compliance reminders</b><small>{compliance.length} staff record{compliance.length === 1 ? "" : "s"} due soon</small></span></div>
          <button type="button" className="primary" disabled={Boolean(running) || compliance.length === 0} onClick={() => void run("run_compliance_reminders")}>
            {running === "run_compliance_reminders" ? "Sending..." : "Email compliance reminders"}
          </button>
          <ul>{compliance.slice(0, 5).map((row) => <li key={String(row.id)}>{String(row.display_name)} · {String(row.check_type)} · {dateValue(row.expires_at)}</li>)}</ul>
        </section>

        <section className="portal-card automation-action-card">
          <div><BarChart3 /><span><b>Management summary</b><small>Send the current management snapshot now</small></span></div>
          <button type="button" className="primary" disabled={Boolean(running) || !setting("scheduled_report_recipient")} onClick={() => void run("send_management_report")}>
            {running === "send_management_report" ? "Sending..." : "Send report now"}
          </button>
          <p>{setting("scheduled_report_recipient") || "Add a recipient email above first."}</p>
        </section>
      </div>

      {(data.recentRuns ?? []).length > 0 && (
        <section className="portal-card automation-history">
          <h3>Recent automation runs</h3>
          {(data.recentRuns ?? []).map((row, index) => (
            <p key={`${String(row.created_at)}-${index}`}>
              <span><b>{nice(String(row.action ?? ""))}</b><small>{dateValue(row.created_at)}</small></span>
              <small>{String(row.details ?? "")}</small>
            </p>
          ))}
        </section>
      )}
    </section>
  );
}

function SystemHealth() {
  const [data, setData] = useState<{
    checkedAt?: string;
    services?: Row[];
    webhooks?: Row[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/system-health", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as typeof data & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to load system health.");
        return;
      }
      setData(result);
    } catch {
      setError("Unable to connect to the health service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="records phase3-workspace">
      <div className="records-head">
        <div>
          <h1>System health</h1>
          <p>Operational checks for the services BNMC depends on. Secrets are never displayed.</p>
        </div>
        <span>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw /> Run checks
          </button>
        </span>
      </div>

      {error && <div className="portal-error">{error}</div>}

      <div className="health-grid">
        {(data.services ?? []).map((service) => (
          <section className={`portal-card health-card ${String(service.status ?? "warning")}`} key={String(service.key)}>
            <div className="health-card-head">
              <i><ShieldCheck /></i>
              <em className={`status ${String(service.status ?? "warning")}`}>
                {String(service.status ?? "warning") === "healthy" ? "Healthy" : String(service.status ?? "warning") === "error" ? "Error" : "Needs attention"}
              </em>
            </div>
            <h3>{String(service.label ?? "Service")}</h3>
            <p>{String(service.detail ?? "")}</p>
          </section>
        ))}
      </div>

      <section className="portal-card webhook-health-card">
        <div className="phase3-section-head">
          <div>
            <small>Last 24 hours</small>
            <h3>Payment webhook activity</h3>
          </div>
          {data.checkedAt && <span>Checked {new Date(data.checkedAt).toLocaleString("en-GB")}</span>}
        </div>

        {(data.webhooks ?? []).length === 0 ? (
          <p className="phase3-note">No Stripe or GoCardless webhook events were recorded in the last 24 hours.</p>
        ) : (
          <div className="table-wrap compact-health-table">
            <table>
              <thead><tr><th>Provider</th><th>Events</th><th>Failed</th><th>Last received</th><th>Last processed</th></tr></thead>
              <tbody>
                {(data.webhooks ?? []).map((row) => (
                  <tr key={String(row.provider)}>
                    <td><b>{nice(String(row.provider ?? ""))}</b></td>
                    <td>{String(row.total_24h ?? 0)}</td>
                    <td><em className={`status ${Number(row.failed_24h ?? 0) > 0 ? "overdue" : "active"}`}>{String(row.failed_24h ?? 0)}</em></td>
                    <td>{String(row.last_received_at ?? "-")}</td>
                    <td>{String(row.last_processed_at ?? "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function WorkspaceTabs({
  resource,
  user,
  navigate,
  openBilling,
}: {
  resource: string;
  user: User;
  navigate:
    (target: string) => void;
  openBilling:
    (
      section?:
        BillingSection,
    ) => void;
}) {
  const group =
    sidebarSectionFor(
      resource,
    );

  let tabs:
    {
      key: string;
      label: string;
      icon:
        typeof Users;
      action?:
        () => void;
    }[] = [];

  if (
    group ===
    "students"
  ) {
    tabs = [
      {
        key:
          "students",
        label:
          "Students",
        icon:
          Users,
      },

      ...([
        "admin",
        "teacher",
      ].includes(
        user.role,
      )
        ? [
            {
              key:
                "applications",
              label:
                "Applications",
              icon:
                UserCheck,
            },

            {
              key:
                "guardians",
              label:
                "Guardians",
              icon:
                ShieldCheck,
            },
          ]
        : []),
    ];
  }

  if (
    group ===
    "classes"
  ) {
    tabs = [
      {
        key:
          "classes",
        label:
          "Classes",
        icon:
          School,
      },

      {
        key:
          "attendance",
        label:
          "Attendance",
        icon:
          ClipboardCheck,

        action:
          () =>
            window.location.assign(
              "/portal/attendance",
            ),
      },

      ...(user.role ===
      "admin"
        ? [
            {
              key:
                "enrolments",
              label:
                "Enrolments",
              icon:
                GraduationCap,
            },
          ]
        : []),

      {
        key:
          "progress",
        label:
          "Progress & assessments",
        icon:
          BookOpen,
      },
    ];
  }

  if (
    group ===
    "settings"
  ) {
    tabs = [
      {
        key:
          "settings",
        label:
          "Settings home",
        icon:
          ShieldCheck,
      },

      {
        key:
          "staff",
        label:
          "Staff & access",
        icon:
          GraduationCap,
      },

      {
        key:
          "compliance",
        label:
          "Compliance",
        icon:
          ShieldCheck,
      },

      ...(user.role ===
      "admin"
        ? [
            {
              key:
                "homepage_settings",
              label:
                "Public homepage",
              icon:
                Images,
            },
            {
              key:
                "activity_log",
              label:
                "Activity log",
              icon:
                FileText,
            },
          ]
        : []),

      {
        key:
          "fee_setup",
        label:
          "Fee setup",
        icon:
          CreditCard,
        action:
          () =>
            openBilling(
              "plans",
            ),
      },
    ];
  }

  if (
    tabs.length ===
    0
  ) {
    return null;
  }

  return (
    <div className="workspace-tabs">
      {tabs.map(
        (tab) => {
          const Icon =
            tab.icon;

          return (
            <button
              type="button"
              key={
                tab.key
              }
              className={
                resource ===
                tab.key
                  ? "active"
                  : ""
              }
              onClick={() => {
                if (
                  tab.action
                ) {
                  tab.action();

                  return;
                }

                navigate(
                  tab.key,
                );
              }}
            >
              <Icon />

              {tab.label}
            </button>
          );
        },
      )}
    </div>
  );
}

function StudentProfile({
  studentId,
  user,
  back,
  goTo,
}: {
  studentId: string;
  user: User;
  back: () => void;
  goTo: (target: string) => void;
}) {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [guardianModal, setGuardianModal] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [timeline, setTimeline] = useState<Row[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const response = await fetch(
        `/api/v1/student-timeline?id=${encodeURIComponent(studentId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json().catch(() => ({}))) as {
        data?: Row[];
      };
      if (response.ok) {
        setTimeline(result.data ?? []);
      }
    } catch {
      // Timeline is supplementary; the main profile should remain usable.
    } finally {
      setTimelineLoading(false);
    }
  }, [studentId]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const profileEndpoint =
        user.role === "teacher"
          ? "/api/v1/teacher-student-profile"
          : "/api/v1/student-profile";

      const response = await fetch(
        `${profileEndpoint}?id=${encodeURIComponent(studentId)}`,
        { cache: "no-store" },
      );
      if (response.status === 401) { window.location.assign("/login"); return; }
      const result = (await response.json()) as { data?: StudentProfileData; error?: string };
      if (!response.ok || !result.data) { setError(result.error ?? "Unable to load the student profile."); return; }
      setProfile(result.data);
    } catch { setError("Unable to connect to the student profile service."); }
    finally { setLoading(false); }
  }, [studentId, user.role]);

  useEffect(() => {
    loadProfile();
    loadTimeline();
  }, [loadProfile, loadTimeline]);

  if (loading) return <div className="empty student-profile-loading"><RefreshCw />Loading student profile...</div>;
  if (error || !profile) return <section className="records"><div className="records-head"><div><h1>Student profile</h1><p>Unable to open this student.</p></div><span><button onClick={back}><ArrowLeft />Back</button></span></div><div className="portal-error">{error || "Student profile was not found."}</div></section>;

  const student = profile.student;
  const studentName = String(student.name ?? `${student.first_name ?? ""} ${student.last_name ?? ""}`).trim() || "Student";
  const outstanding = profile.invoices.reduce((total, invoice) => total + Number(invoice.balance_pence ?? (Number(invoice.amount_due_pence ?? 0) - Number(invoice.amount_paid_pence ?? 0))), 0);
  const activeAgreement = profile.agreements.find((agreement) => String(agreement.status ?? "") === "active");
  const directDebitStatus = String(profile.directDebit?.status ?? "not_setup").trim().toLowerCase().replace(/[.\s-]+/g, "_");
  const canManage = user.role === "admin";

  return (
    <section className="student-profile">
      <div className="student-profile-top"><button type="button" className="profile-back" onClick={back}><ArrowLeft />Back</button><span>{(user.role === "admin" || user.role === "parent") && <button type="button" onClick={() => setEditProfile(true)}><Pencil />{user.role === "parent" ? "Edit child's profile" : "Edit student profile"}</button>}<button type="button" className="profile-refresh" onClick={() => { loadProfile(); loadTimeline(); }}><RefreshCw />Refresh</button></span></div>
      {profileNotice && <div className="records-notice success" role="status"><span>{profileNotice}</span><button type="button" onClick={() => setProfileNotice("")} aria-label="Dismiss notification">x</button></div>}
      <div className="student-profile-hero"><div className="student-avatar">{studentName.charAt(0).toUpperCase()}</div><div><small>Student profile</small><h1>{studentName}</h1><p>{String(student.student_number ?? "No student number")}  -  <em className={`status ${String(student.status ?? "")}`}>{nice(String(student.status ?? "active"))}</em></p></div></div>
      {profile.guardians.length === 0 && (
        <div className="records-notice info" role="status">
          <span>
            Guardian information has not yet been provided for this student.
            {user.role === "admin" ? " Add the details when BNMC receives them." : ""}
          </span>
          {user.role === "admin" && (
            <button
              type="button"
              onClick={() => setGuardianModal(true)}
            >
              Add guardian details
            </button>
          )}
        </div>
      )}
      <div className="student-profile-summary">
        <section className="portal-card"><small>Current class</small><strong>{String(profile.enrolments[0]?.class_name ?? "Not enrolled")}</strong></section>
        {user.role === "teacher" ? (
          <>
            <section className="portal-card"><small>Attendance records</small><strong>{profile.attendance.length}</strong></section>
            <section className="portal-card"><small>Progress assessments</small><strong>{profile.progress.length}</strong></section>
          </>
        ) : (
          <>
            <section className="portal-card"><small>Outstanding fees</small><strong>{money(outstanding)}</strong></section>
            <section className="portal-card"><small>Direct Debit</small><strong>{nice(directDebitStatus)}</strong></section>
          </>
        )}
      </div>
      <div className="student-profile-actions">
        {canManage && <><button type="button" onClick={() => goTo("enrolments")}><GraduationCap />Manage enrolment</button><button type="button" onClick={() => window.location.assign("/portal/attendance")}><ClipboardCheck />Attendance</button><button type="button" onClick={() => goTo("progress")}><BookOpen />Progress & assessments</button>{activeAgreement && <button type="button" className="primary" onClick={() => setInvoiceModal(true)}><ReceiptText />Generate invoice</button>}</>}
        {user.role === "teacher" && <><button type="button" onClick={() => window.location.assign("/portal/attendance")}><ClipboardCheck />Attendance</button><button type="button" onClick={() => goTo("progress")}><BookOpen />Record progress</button></>}
        {(user.role === "admin" || user.role === "parent") && <button type="button" onClick={() => goTo("billing")}><WalletCards />Fees & payment method</button>}
      </div>
      <div className="student-profile-grid">
        <section className="portal-card student-profile-section"><h3>Guardian</h3>{profile.guardians.length === 0 ? <p>No guardian linked.</p> : profile.guardians.map((guardian, index) => <div className="profile-detail-row" key={String(guardian.id ?? index)}><UserRound /><span><b>{String(guardian.full_name ?? "Guardian")}</b><small>{String(guardian.relationship ?? "")}{guardian.email ? `  -  ${guardian.email}` : ""}{guardian.phone ? `  -  ${guardian.phone}` : ""}</small></span></div>)}</section>
        <section className="portal-card student-profile-section"><h3>Classes</h3>{profile.enrolments.length === 0 ? <p>No current enrolment.</p> : profile.enrolments.map((enrolment, index) => <div className="profile-detail-row" key={String(enrolment.id ?? index)}><School /><span><b>{String(enrolment.class_name ?? "Class")}</b><small>{String(enrolment.subject ?? "")}{enrolment.level ? `  -  ${enrolment.level}` : ""}{enrolment.room ? `  -  ${enrolment.room}` : ""}</small></span></div>)}</section>
        <section className="portal-card student-profile-section"><h3>Recent attendance</h3>{profile.attendance.length === 0 ? <p>No attendance records yet.</p> : profile.attendance.slice(0,5).map((attendance,index) => <div className="profile-list-row" key={String(attendance.id ?? index)}><span><b>{dateValue(attendance.session_date)}</b><small>{String(attendance.class_name ?? "")}</small></span><em className={`status ${String(attendance.status ?? "")}`}>{nice(String(attendance.status ?? "-"))}</em></div>)}</section>
        <section className="portal-card student-profile-section"><h3>Progress & assessments</h3>{profile.progress.length === 0 ? <p>No progress assessments recorded yet.</p> : profile.progress.slice(0,5).map((progress,index) => <div className="profile-list-row" key={String(progress.id ?? index)}><span><b>{String(progress.strand ?? progress.current_unit ?? "Progress")}</b><small>{String(progress.current_unit ?? "")}</small></span><em className={`status ${String(progress.achievement ?? "")}`}>{nice(String(progress.achievement ?? "-"))}</em></div>)}</section>
        {user.role !== "teacher" && <section className="portal-card student-profile-section profile-fees-card"><h3>Fees & payments</h3><div className="profile-payment-summary"><span><small>Monthly fee</small><b>{activeAgreement ? money(activeAgreement.monthly_amount_pence) : "Not configured"}</b></span><span><small>Payment method</small><b>{activeAgreement ? nice(String(activeAgreement.collection_method ?? "online")) : "-"}</b></span><span><small>Direct Debit</small><b>{nice(directDebitStatus)}</b></span></div><button type="button" className="profile-section-action" onClick={() => goTo("billing")}>Manage fees & payment method</button></section>}
        <StudentAdmissionPaymentCard studentId={String(student.id ?? "")} role={user.role} />
      </div>
      <section className="portal-card student-timeline-card">
        <div className="student-timeline-head">
          <div>
            <small>Student journey</small>
            <h3>Activity timeline</h3>
          </div>
          <span>{timeline.length} event{timeline.length === 1 ? "" : "s"}</span>
        </div>

        {timelineLoading ? (
          <p className="student-timeline-empty">Loading recent activity...</p>
        ) : timeline.length === 0 ? (
          <p className="student-timeline-empty">No activity has been recorded yet.</p>
        ) : (
          <div className="student-timeline-list">
            {timeline.map((event, index) => (
              <article className="student-timeline-item" key={String(event.id ?? `${event.event_type ?? "event"}-${index}`)}>
                <i aria-hidden="true" />
                <div>
                  <span className="student-timeline-meta">
                    {dateValue(event.event_at)}
                    {event.status ? ` · ${nice(String(event.status))}` : ""}
                  </span>
                  <strong>{String(event.title ?? "Student activity")}</strong>
                  {Boolean(event.description) && <p>{String(event.description)}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {user.role !== "teacher" && <section className="student-profile-invoices"><div className="records-head"><div><h1>Invoices</h1><p>Payment history and outstanding charges for {studentName}.</p></div></div>{profile.invoices.length === 0 ? <div className="empty"><ReceiptText /><b>No invoices yet</b></div> : <InvoiceTable
      rows={profile.invoices.map((invoice) => ({
        ...invoice,
        student_id: invoice.student_id ?? student.id,
        student_name: invoice.student_name ?? studentName,
        student_number: invoice.student_number ?? student.student_number,
      }))}
      parent={user.role === "parent"}
      canRecordCash={user.role === "admin"}
      refresh={() => void loadProfile()}
    />}</section>}
      {editProfile && <StudentProfileForm student={student} admin={user.role === "admin"} close={() => setEditProfile(false)} saved={() => { setEditProfile(false); setProfileNotice("Student profile updated successfully."); loadProfile(); }} />}
      {guardianModal && user.role === "admin" && (
        <StudentGuardianForm
          student={student}
          close={() => setGuardianModal(false)}
          saved={() => {
            setGuardianModal(false);
            setProfileNotice("Guardian linked successfully.");
            void loadProfile();
            void loadTimeline();
          }}
        />
      )}
      {invoiceModal && activeAgreement && <InvoiceForm agreements={[activeAgreement]} close={() => setInvoiceModal(false)} saved={() => { setInvoiceModal(false); loadProfile(); }} />}
    </section>
  );
}

function StudentGuardianForm({
  student,
  close,
  saved,
}: {
  student: Row;
  close: () => void;
  saved: () => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [guardians, setGuardians] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGuardians() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/v1/guardians", {
          cache: "no-store",
        });

        const result = (await response.json().catch(() => ({}))) as {
          data?: Row[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load existing guardians.");
        }

        if (active) {
          setGuardians(
            (result.data ?? []).sort((a, b) =>
              String(a.full_name ?? "").localeCompare(
                String(b.full_name ?? ""),
              ),
            ),
          );
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load existing guardians.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadGuardians();

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      studentId: student.id,
      isPrimary: formData.has("isPrimary"),
    };

    if (mode === "existing") {
      payload.guardianId = formData.get("guardianId");
    } else {
      payload.fullName = formData.get("fullName");
      payload.relationship = formData.get("relationship");
      payload.email = formData.get("email");
      payload.phone = formData.get("phone");
      payload.address = formData.get("address");
      payload.postcode = formData.get("postcode");
      payload.emergencyContactNumber =
        formData.get("emergencyContactNumber");
    }

    try {
      const response = await fetch("/api/v1/guardians", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to link guardian.");
        return;
      }

      saved();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  const studentName =
    String(
      student.name ??
        `${student.first_name ?? ""} ${student.last_name ?? ""}`,
    ).trim() || "this student";

  return (
    <div className="modal manual-registration-modal">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>Student profile</small>
            <h2>Add guardian details</h2>
          </div>

          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        <p className="manual-registration-intro">
          Link a guardian to <strong>{studentName}</strong>. Choose an existing
          guardian when a sibling is already registered, or create a new
          guardian record.
        </p>

        <fieldset>
          <legend>Guardian option</legend>

          <div
            className="guardian-choice"
            role="group"
            aria-label="Guardian option"
          >
            <button
              type="button"
              className={mode === "new" ? "active" : ""}
              onClick={() => setMode("new")}
              disabled={busy}
            >
              Add new guardian
            </button>

            <button
              type="button"
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
              disabled={busy || loading || guardians.length === 0}
            >
              Select existing guardian
            </button>
          </div>

          {mode === "existing" ? (
            <label>
              Existing guardian
              <select
                name="guardianId"
                required
                defaultValue=""
                disabled={loading}
              >
                <option value="" disabled>
                  {loading
                    ? "Loading guardians..."
                    : guardians.length
                      ? "Select guardian"
                      : "No existing guardians available"}
                </option>

                {guardians.map((guardian) => (
                  <option
                    key={String(guardian.id ?? "")}
                    value={String(guardian.id ?? "")}
                  >
                    {String(guardian.full_name ?? "Guardian")}
                    {" - "}
                    {String(guardian.email ?? guardian.phone ?? "No contact details")}
                    {Number(guardian.children ?? 0) > 0
                      ? ` - ${Number(guardian.children)} linked child${
                          Number(guardian.children) === 1 ? "" : "ren"
                        }`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="form-grid">
              <label>
                Full name
                <input name="fullName" required />
              </label>

              <label>
                Relationship
                <select name="relationship" required defaultValue="">
                  <option value="" disabled>
                    Select relationship
                  </option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                Email address
                <input name="email" type="email" required />
              </label>

              <label>
                Phone number
                <input name="phone" type="tel" required />
              </label>

              <label className="wide-field">
                Home address
                <input name="address" />
              </label>

              <label>
                Postcode
                <input name="postcode" />
              </label>

              <label>
                Emergency contact number
                <input
                  name="emergencyContactNumber"
                  type="tel"
                />
              </label>
            </div>
          )}

          <label className="guardian-primary-checkbox">
            <input
              type="checkbox"
              name="isPrimary"
              value="true"
              defaultChecked
            />

            <span>
              <strong>Set as primary guardian</strong>
              <small>
                The primary guardian is used as the main family contact for
                this student.
              </small>
            </span>
          </label>
        </fieldset>

        {error && <output>{error}</output>}

        <footer>
          <button
            type="button"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy ||
              (mode === "existing" && loading)
            }
          >
            {busy ? "Saving..." : "Link guardian"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function StudentProfileForm({
  student,
  admin,
  close,
  saved,
}: {
  student: Row;
  admin: boolean;
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      id: student.id,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      dateOfBirth: formData.get("dateOfBirth"),
      gender: formData.get("gender"),
      ethnicGroup: formData.get("ethnicGroup"),
      medicalNotes: formData.get("medicalNotes"),
      allergyNotes: formData.get("allergyNotes"),
      additionalNeeds: formData.get("additionalNeeds"),
      photoConsent: formData.has("photoConsent"),
      emergencyConsent: formData.has("emergencyConsent"),
    };

    if (admin) {
      payload.studentNumber = formData.get("studentNumber");
    }

    try {
      const response = await fetch(
        "/api/v1/student-profile",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response
        .json()
        .catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(
          result.error ?? "Unable to update the student profile.",
        );
        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the student profile service.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <form onSubmit={submit} className="student-edit-form">
        <header>
          <div>
            <small>Student information</small>
            <h2>Edit student profile</h2>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        <div className="form-grid">
          {admin && (
            <label>
              Student number
              <input
                name="studentNumber"
                defaultValue={String(student.student_number ?? "")}
                required
              />
            </label>
          )}
          <label>
            First name
            <input
              name="firstName"
              defaultValue={String(student.first_name ?? "")}
              required
            />
          </label>
          <label>
            Last name
            <input
              name="lastName"
              defaultValue={String(student.last_name ?? "")}
              required
            />
          </label>
          <label>
            Date of birth
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={String(student.date_of_birth ?? "").slice(0, 10)}
              required
            />
          </label>
          <label>
            Gender
            <select
              name="gender"
              defaultValue={String(student.gender ?? "")}
              required
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </label>
          <label>
            Ethnic group
            <select
              name="ethnicGroup"
              defaultValue={String(student.ethnic_group ?? "")}
            >
              <option value="">Not provided</option>
              <option value="Hausa">Hausa</option>
              <option value="Yoruba">Yoruba</option>
              <option value="Igbo">Igbo</option>
              <option value="Edo">Edo</option>
              <option value="Kogi">Kogi</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </label>
          <label className="profile-wide-field">
            Medical notes
            <textarea
              name="medicalNotes"
              rows={3}
              defaultValue={String(student.medical_notes ?? "")}
            />
          </label>
          <label className="profile-wide-field">
            Allergies
            <textarea
              name="allergyNotes"
              rows={3}
              defaultValue={String(student.allergy_notes ?? "")}
            />
          </label>
          <label className="profile-wide-field">
            Additional needs
            <textarea
              name="additionalNeeds"
              rows={3}
              defaultValue={String(student.additional_needs ?? "")}
            />
          </label>
          <label className="profile-checkbox-field">
            <input
              name="photoConsent"
              type="checkbox"
              defaultChecked={Boolean(Number(student.photo_consent ?? 0))}
            />
            Photo consent provided
          </label>
          <label className="profile-checkbox-field">
            <input
              name="emergencyConsent"
              type="checkbox"
              defaultChecked={Boolean(Number(student.emergency_consent ?? 0))}
            />
            Emergency treatment consent provided
          </label>
        </div>

        {!admin && (
          <p className="profile-form-note">
            Class placement, fees, attendance, progress, student number and status are managed by the Madrasah.
          </p>
        )}

        {error && <output>{error}</output>}

        <footer>
          <button
            type="button"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy}
          >
            {busy ? "Saving..." : "Save student profile"}
          </button>
        </footer>
      </form>
    </div>
  );
}



type FailedEmailRow = {
  id: string;
  source:
    | "system"
    | "communication";
  recipient: string;
  type: string;
  subject: string;
  failureReason: string;
  attempts: number;
  failedAt: string;
};

function FailedEmails({
  back,
}: {
  back:
    () => void;
}) {
  const [rows, setRows] =
    useState<FailedEmailRow[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busyId, setBusyId] =
    useState("");
  const [resendAllBusy, setResendAllBusy] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");

  const loadFailures =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/v1/failed-emails",
              {
                cache:
                  "no-store",
              },
            );

          if (
            response.status ===
            401
          ) {
            window.location.assign(
              "/login",
            );
            return;
          }

          const result =
            (await response
              .json()
              .catch(
                () => ({}),
              )) as {
              data?: FailedEmailRow[];
              error?: string;
            };

          if (
            !response.ok
          ) {
            setError(
              result.error ??
                "Unable to load failed emails.",
            );
            return;
          }

          setRows(
            result.data ??
              [],
          );
        }
        catch {
          setError(
            "Unable to load failed emails.",
          );
        }
        finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      loadFailures();
    },
    [
      loadFailures,
    ],
  );

  async function resend(
    row: FailedEmailRow,
    quiet = false,
  ) {
    setBusyId(
      row.id,
    );

    if (!quiet) {
      setError("");
      setMessage("");
    }

    try {
      const response =
        await fetch(
          "/api/v1/failed-emails",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                id:
                  row.id,
                source:
                  row.source,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
          message?: string;
        };

      if (
        !response.ok
      ) {
        if (!quiet) {
          setError(
            result.error ??
              "Email could not be resent.",
          );
        }
        return false;
      }

      setRows(
        (current) =>
          current.filter(
            (item) =>
              !(
                item.id ===
                  row.id &&
                item.source ===
                  row.source
              ),
          ),
      );

      if (!quiet) {
        setMessage(
          result.message ??
            "Email resent successfully.",
        );
      }

      return true;
    }
    catch {
      if (!quiet) {
        setError(
          "Unable to connect to the server.",
        );
      }
      return false;
    }
    finally {
      setBusyId(
        "",
      );
    }
  }

  async function resendAll() {
    if (
      rows.length ===
      0
    ) {
      return;
    }

    setResendAllBusy(
      true,
    );
    setError("");
    setMessage("");

    let success = 0;
    let failed = 0;

    for (
      const row of [
        ...rows,
      ]
    ) {
      const ok =
        await resend(
          row,
          true,
        );

      if (ok) {
        success += 1;
      } else {
        failed += 1;
      }
    }

    setResendAllBusy(
      false,
    );

    if (
      success > 0
    ) {
      setMessage(
        `${success} failed email${success === 1 ? "" : "s"} resent successfully.`,
      );
    }

    if (
      failed > 0
    ) {
      setError(
        `${failed} email${failed === 1 ? "" : "s"} still could not be delivered.`,
      );
    }

    await loadFailures();
  }

  return (
    <section className="records failed-emails-screen">
      <div className="records-head">
        <div>
          <button
            type="button"
            className="failed-email-back"
            onClick={
              back
            }
          >
            ← Dashboard
          </button>

          <h1>
            Failed emails
          </h1>

          <p>
            Retry emails that were not delivered. Successful resends disappear from this list automatically.
          </p>
        </div>

        <span>
          <button
            type="button"
            onClick={
              loadFailures
            }
            disabled={
              loading
            }
          >
            <RefreshCw />
            Refresh
          </button>

          <button
            type="button"
            className="primary"
            onClick={
              resendAll
            }
            disabled={
              loading ||
              resendAllBusy ||
              rows.length ===
                0
            }
          >
            {resendAllBusy
              ? "Resending..."
              : `Resend all (${rows.length})`}
          </button>
        </span>
      </div>

      {message && (
        <div className="portal-success">
          {message}
        </div>
      )}

      {error && (
        <div className="portal-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="portal-card failed-email-empty">
          Checking email delivery...
        </div>
      ) : rows.length ===
          0 ? (
        <div className="portal-card failed-email-empty clear">
          <CheckCircle2 />
          <b>
            No failed emails
          </b>
          <span>
            All tracked email deliveries are currently clear.
          </span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Failure</th>
                <th>Attempts</th>
                <th>Last attempt</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row) => (
                  <tr
                    key={`${row.source}-${row.id}`}
                  >
                    <td>
                      <b>
                        {row.recipient}
                      </b>
                    </td>

                    <td>
                      {row.type}
                    </td>

                    <td>
                      {row.subject}
                    </td>

                    <td>
                      <span
                        className="failed-email-reason"
                        title={
                          row.failureReason
                        }
                      >
                        {row.failureReason}
                      </span>
                    </td>

                    <td>
                      {row.attempts}
                    </td>

                    <td>
                      {dateValue(
                        row.failedAt,
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="row-action"
                        disabled={
                          busyId ===
                            row.id ||
                          resendAllBusy
                        }
                        onClick={() =>
                          resend(
                            row,
                          )
                        }
                      >
                        {busyId ===
                        row.id
                          ? "Resending..."
                          : "Resend"}
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminAttention({
  navigate,
  openBilling,
}: {
  navigate:
    (target: string) => void;
  openBilling:
    (
      section?:
        BillingSection,
    ) => void;
}) {
  const [
    overview,
    setOverview,
  ] =
    useState<Row | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const loadOverview =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/v1/admin-attention",
              {
                cache:
                  "no-store",
              },
            );

          if (
            response.status ===
            401
          ) {
            window.location.assign(
              "/login",
            );
            return;
          }

          const result =
            (await response
              .json()
              .catch(
                () => ({}),
              )) as {
              data?: Row;
              error?: string;
            };

          if (
            !response.ok
          ) {
            setOverview(null);
            setError(
              result.error ??
                "Unable to load admin attention items.",
            );
            return;
          }

          setOverview(
            result.data ??
              {},
          );
        }
        catch {
          setOverview(null);
          setError(
            "Unable to load admin attention items.",
          );
        }
        finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      loadOverview();
    },
    [
      loadOverview,
    ],
  );

  const recentActivity =
    Array.isArray(
      overview?.recentActivity,
    )
      ? (
          overview
            ?.recentActivity as Row[]
        )
      : [];

  const items = [
    {
      label:
        "Applications awaiting review",
      helper:
        "Review new and in-progress admissions",
      value:
        Number(
          overview
            ?.applicationsAwaitingReview ??
            0,
        ),
      icon:
        UserCheck,
      level:
        "urgent",
      action:
        () =>
          navigate(
            "applications",
          ),
    },

    {
      label:
        "Students missing guardian details",
      helper:
        "Complete parent contact and portal access",
      value:
        Number(
          overview
            ?.studentsMissingGuardians ??
            0,
        ),
      icon:
        Users,
      level:
        "urgent",
      action:
        () =>
          window.location.assign(
            "/portal/bulk-students?mode=guardian_updates",
          ),
    },

    {
      label:
        "Students without an active class",
      helper:
        "Assign or restore an enrolment",
      value:
        Number(
          overview
            ?.studentsWithoutClass ??
            0,
        ),
      icon:
        GraduationCap,
      level:
        "soon",
      action:
        () =>
          navigate(
            "enrolments",
          ),
    },

    {
      label:
        "Classes without a teacher",
      helper:
        "Assign a teacher before the next session",
      value:
        Number(
          overview
            ?.classesWithoutTeacher ??
            0,
        ),
      icon:
        School,
      level:
        "soon",
      action:
        () =>
          navigate(
            "classes",
          ),
    },

    {
      label:
        "Overdue invoices",
      helper:
        loading
          ? "Checking outstanding fees"
          : `${money(
              overview
                ?.overdueBalancePence ??
                0,
            )} currently overdue`,
      value:
        Number(
          overview
            ?.overdueInvoices ??
            0,
        ),
      icon:
        CreditCard,
      level:
        "soon",
      action:
        () =>
          openBilling(
            "invoices",
          ),
    },

    {
      label:
        "Failed emails",
      helper:
        "Retry parent, admission and communication emails",
      value:
        Number(
          overview
            ?.failedEmails ??
            0,
        ),
      icon:
        Mail,
      level:
        "urgent",
      action:
        () =>
          navigate(
            "failed_emails",
          ),
    },

    {
      label:
        "Compliance due within 30 days",
      helper:
        "Review expiring DBS/compliance records",
      value:
        Number(
          overview
            ?.complianceDueSoon ??
            0,
        ),
      icon:
        ShieldCheck,
      level:
        "soon",
      action:
        () =>
          navigate(
            "compliance",
          ),
    },
  ];

  const totalAttention =
    items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.value,
      0,
    );

  return (
    <section className="admin-attention admin-attention-v2">
      <div className="admin-attention-head">
        <div>
          <small>
            Needs attention
          </small>

          <h2>
            Admin action centre
          </h2>

          <p>
            {loading
              ? "Checking the Madrasah..."
              : totalAttention > 0
                ? `${totalAttention} item${totalAttention === 1 ? "" : "s"} currently need attention.`
                : "Nothing urgent is waiting for you."}
          </p>
        </div>

        <button
          type="button"
          onClick={
            loadOverview
          }
          disabled={
            loading
          }
        >
          <RefreshCw />

          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-attention-error">
          {error}
        </div>
      )}

      <div className="admin-attention-grid admin-attention-grid-v2">
        {items.map(
          (item) => {
            const Icon =
              item.icon;

            const state =
              item.value > 0
                ? item.level
                : "clear";

            return (
              <button
                type="button"
                key={
                  item.label
                }
                className={
                  `admin-attention-card ${state}`
                }
                onClick={
                  item.action
                }
              >
                <i>
                  <Icon />
                </i>

                <span>
                  <strong>
                    {loading
                      ? "..."
                      : item.value}
                  </strong>

                  <b>
                    {
                      item.label
                    }
                  </b>

                  <small>
                    {
                      item.helper
                    }
                  </small>
                </span>

                {!loading &&
                  item.value ===
                    0 && (
                    <em>
                      <CheckCircle2 />
                      Clear
                    </em>
                  )}
              </button>
            );
          },
        )}
      </div>

      <div className="admin-dashboard-lower">
        <section className="admin-recent-activity">
          <div className="admin-subsection-head">
            <div>
              <small>
                Latest changes
              </small>

              <h3>
                Recent activity
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "activity_log",
                )
              }
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="admin-activity-empty">
              Loading recent activity...
            </div>
          ) : recentActivity.length ===
              0 ? (
            <div className="admin-activity-empty">
              No recent activity yet.
            </div>
          ) : (
            <div className="admin-activity-list">
              {recentActivity.map(
                (
                  activity,
                  index,
                ) => (
                  <div
                    key={`${String(
                      activity.id ??
                        index,
                    )}`}
                    className="admin-activity-row"
                  >
                    <i>
                      <FileText />
                    </i>

                    <span>
                      <b>
                        {String(
                          activity.label ??
                            "Activity recorded",
                        )}
                      </b>

                      <small>
                        {[
                          activity.actor,
                          activity.when,
                        ]
                          .filter(
                            Boolean,
                          )
                          .map(
                            String,
                          )
                          .join(
                            " · ",
                          )}
                      </small>
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <section className="admin-quick-actions">
          <div className="admin-subsection-head">
            <div>
              <small>
                Common tasks
              </small>

              <h3>
                Quick actions
              </h3>
            </div>
          </div>

          <div className="admin-quick-action-list">
            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  "/portal/manual-registration",
                )
              }
            >
              <Plus />
              <span>
                <b>
                  Register student
                </b>
                <small>
                  Add a new student and guardian
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "announcements",
                )
              }
            >
              <MessageSquare />
              <span>
                <b>
                  Send message
                </b>
                <small>
                  Contact parents or a class
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                openBilling(
                  "invoices",
                )
              }
            >
              <CreditCard />
              <span>
                <b>
                  Record / review payment
                </b>
                <small>
                  Open fees and invoices
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "staff",
                )
              }
            >
              <UserCheck />
              <span>
                <b>
                  Manage staff
                </b>
                <small>
                  Roles, status and access
                </small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function DashboardTrends({ rows }: { rows: Row[] }) {
  const applicationMax = Math.max(1, ...rows.map((row) => Number(row.applications ?? 0)));
  const paymentMax = Math.max(1, ...rows.map((row) => Number(row.payments_pence ?? 0)));

  function monthLabel(value: unknown) {
    const raw = String(value ?? "");
    const match = /^(\d{4})-(\d{2})$/.exec(raw);
    if (!match) return raw;
    return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
      new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)),
    );
  }

  return (
    <div className="dashboard-trends">
      <div className="dashboard-trends-head">
        <div>
          <small>Last six months</small>
          <h3>Operational trends</h3>
        </div>
        <span>Applications · payments · attendance</span>
      </div>

      <div className="trend-groups">
        <section>
          <h4>Applications</h4>
          <div className="trend-bars">
            {rows.map((row) => {
              const value = Number(row.applications ?? 0);
              return (
                <div key={`applications-${String(row.month)}`}>
                  <b>{value}</b>
                  <i style={{ height: `${Math.max(5, (value / applicationMax) * 100)}%` }} />
                  <small>{monthLabel(row.month)}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h4>Payments received</h4>
          <div className="trend-bars">
            {rows.map((row) => {
              const value = Number(row.payments_pence ?? 0);
              return (
                <div key={`payments-${String(row.month)}`}>
                  <b>{money(value)}</b>
                  <i style={{ height: `${Math.max(5, (value / paymentMax) * 100)}%` }} />
                  <small>{monthLabel(row.month)}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h4>Attendance rate</h4>
          <div className="trend-bars">
            {rows.map((row) => {
              const value = Math.max(0, Math.min(100, Number(row.attendance_rate ?? 0)));
              return (
                <div key={`attendance-${String(row.month)}`}>
                  <b>{value.toFixed(value % 1 === 0 ? 0 : 1)}%</b>
                  <i style={{ height: `${Math.max(5, value)}%` }} />
                  <small>{monthLabel(row.month)}</small>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}


function PremiumWelcome({
  user,
  parent = false,
}: {
  user: User;
  parent?: boolean;
}) {
  const [
    today,
    setToday,
  ] =
    useState<Date | null>(
      null,
    );

  useEffect(
    () => {
      setToday(
        new Date(),
      );
    },
    [],
  );

  const firstName =
    user.displayName
      .trim()
      .split(
        /\s+/,
      )[0] ||
    "there";

  let gregorianDate =
    "";

  let hijriDate =
    "";

  if (
    today
  ) {
    gregorianDate =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          weekday:
            "long",
          day:
            "numeric",
          month:
            "long",
          year:
            "numeric",
        },
      ).format(
        today,
      );

    try {
      const rawHijri =
        new Intl.DateTimeFormat(
          "en-GB-u-ca-islamic",
          {
            day:
              "numeric",
            month:
              "long",
            year:
              "numeric",
          },
        ).format(
          today,
        );

      const hijriMonthNames:
        Record<
          string,
          string
        > = {
          Muharram:
            "Muharram",
          Safar:
            "Safar",
          "Rabiʻ I":
            "Rabi' al-Awwal",
          "Rabiʻ II":
            "Rabi' al-Thani",
          "Jumada I":
            "Jumada al-Awwal",
          "Jumada II":
            "Jumada al-Thani",
          Rajab:
            "Rajab",
          Shaʻban:
            "Sha'ban",
          Ramadan:
            "Ramadan",
          Shawwal:
            "Shawwal",
          "Dhuʻl-Qiʻdah":
            "Dhu al-Qi'dah",
          "Dhuʻl-Hijjah":
            "Dhu al-Hijjah",
        };

      hijriDate =
        Object.entries(
          hijriMonthNames,
        )
          .sort(
            (
              [left],
              [right],
            ) =>
              right.length -
              left.length,
          )
          .reduce(
            (
              value,
              [
                source,
                readable,
              ],
            ) =>
              value.replace(
                source,
                readable,
              ),
            rawHijri,
          );
    }
    catch {
      hijriDate =
        "";
    }
  }

  return (
    <div className="welcome premium-welcome">
      <div className="premium-welcome-copy">
        <small className="premium-welcome-kicker">
          Assalamu alaikum,{" "}
          {firstName}
        </small>

        <h1>
          {parent
            ? "Welcome to BNMC Madrasah"
            : "What needs attention today?"}
        </h1>

        <p>
          {parent
            ? "Your children, learning information, fees and messages are kept together here."
            : "The common Madrasah tasks are available directly from this page."}
        </p>

        <div className="premium-date-row">
          <span>
            <b>
              Today
            </b>

            <small>
              {gregorianDate ||
                "Loading date..."}
            </small>
          </span>

          <span>
            <b>
              Hijri
            </b>

            <small>
              {hijriDate ||
                "Islamic calendar"}
            </small>
          </span>
        </div>
      </div>

      <div className="premium-welcome-mark">
        <div className="premium-welcome-glow" />

        <Image
          src="/community-logo.png"
          alt="BNMC Madrasah"
          width={88}
          height={88}
        />

        <small>
          BNMC Madrasah
        </small>
      </div>
    </div>
  );
}

function Dashboard({
  summary,
  user,
  navigate,
  openBilling,
}: {
  summary: Row;
  user: User;
  navigate:
    (target: string) => void;
  openBilling:
    (
      section?:
        BillingSection,
    ) => void;
}) {
  const cards = [
    {
      label:
        "Active students",
      value:
        summary.activeStudents ??
        0,
      icon: Users,
    },

    {
      label:
        "Open applications",
      value:
        summary.openApplications ??
        0,
      icon: FileText,
    },

    {
      label:
        "Active classes",
      value:
        summary.activeClasses ??
        0,
      icon: School,
    },

    {
      label:
        "Present today",
      value:
        summary.presentToday ??
        0,
      icon:
        CheckCircle2,
    },

    {
      label:
        "Outstanding fees",
      value:
        money(
          summary.outstandingPence,
        ),
      icon:
        CreditCard,
    },

    {
      label:
        "Compliance due",
      value:
        summary.complianceDue ??
        0,
      icon:
        ShieldCheck,
    },
  ];

  if (
    user.role ===
    "parent"
  ) {
    return (
      <>
        <PremiumWelcome
          user={user}
          parent
        />

        <div className="home-task-grid parent-home-actions">
          <button
            type="button"
            onClick={() =>
              navigate(
                "my_children",
              )
            }
          >
            <i>
              <Users />
            </i>

            <span>
              <b>
                My children
              </b>

              <small>
                Classes, attendance, progress and profile
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              openBilling(
                "invoices",
              )
            }
          >
            <i>
              <CreditCard />
            </i>

            <span>
              <b>
                Fees & payments
              </b>

              <small>
                View invoices or make a one-time payment
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "announcements",
              )
            }
          >
            <i>
              <MessageSquare />
            </i>

            <span>
              <b>
                Messages
              </b>

              <small>
                Read updates from the Madrasah
              </small>
            </span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PremiumWelcome
        user={user}
      />

      {user.role ===
        "admin" && (
        <div className="home-task-grid">
          <button
            type="button"
            onClick={() =>
              navigate(
                "applications",
              )
            }
          >
            <i>
              <UserCheck />
            </i>

            <span>
              <b>
                Review applications
              </b>

              <small>
                {String(
                  summary.openApplications ??
                    0,
                )}{" "}
                currently open
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign(
                "/portal/attendance",
              )
            }
          >
            <i>
              <ClipboardCheck />
            </i>

            <span>
              <b>
                Take attendance
              </b>

              <small>
                Open today&apos;s registers
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              openBilling(
                "invoices",
              )
            }
          >
            <i>
              <CreditCard />
            </i>

            <span>
              <b>
                Fees & payments
              </b>

              <small>
                {money(
                  summary.outstandingPence,
                )}{" "}
                outstanding
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                "announcements",
              )
            }
          >
            <i>
              <MessageSquare />
            </i>

            <span>
              <b>
                Send an update
              </b>

              <small>
                Communicate with parents
              </small>
            </span>
          </button>
        </div>
      )}

      <div className="metric-grid">
        {cards.map(
          (card) => {
            const Icon =
              card.icon;

            return (
              <section
                key={
                  card.label
                }
              >
                <i>
                  <Icon />
                </i>

                <span>
                  <b>
                    {String(
                      card.value,
                    )}
                  </b>

                  <small>
                    {
                      card.label
                    }
                  </small>
                </span>
              </section>
            );
          },
        )}
      </div>

      {user.role === "admin" && (
        <AdminAttention
          navigate={navigate}
          openBilling={openBilling}
        />
      )}

      <div className="dashboard-grid">
        <section className="portal-card">
          <h3>
            Daily workflow
          </h3>

          <p>
            <ClipboardCheck />

            Complete class registers as children arrive.
          </p>

          <p>
            <CreditCard />

            Review overdue fees only when attention is needed.
          </p>

          <p>
            <MessageSquare />

            Send parent updates from Communication.
          </p>
        </section>

        <section className="portal-card">
          <h3>
            Student-centred working
          </h3>

          <p>
            <Users />

            Click a student name anywhere to open their complete profile.
          </p>

          <p>
            <GraduationCap />

            Class, attendance and learning information are grouped together.
          </p>

          <p>
            <ShieldCheck />

            Less frequent administration is kept under Settings.
          </p>
        </section>
      </div>
    </>
  );
}


type FeeReconciliationRow = {
  studentId: string;
  studentNumber: string;
  studentName: string;
  monthlyExpectedPence: number;
  monthlyPaidPence: number;
  monthlyOutstandingPence: number;
  booksExpectedPence: number;
  booksPaidPence: number;
  booksOutstandingPence: number;
  booksChargedThisMonth: boolean;
  currentExpectedPence: number;
  currentPaidPence: number;
  currentOutstandingPence: number;
  arrearsPence: number;
  totalOutstandingPence: number;
  status: string;
  lastPaymentDate: string | null;
  lastPaymentMethod: string | null;
  lastPaymentReference: string | null;
};

function pounds(
  pence: unknown,
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",
      currency:
        "GBP",
    },
  ).format(
    Number(
      pence ??
        0,
    ) /
      100,
  );
}

function FeeReconciliation({
  user,
}: {
  user: User;
}) {
  const today =
    new Date();

  const [
    tab,
    setTab,
  ] =
    useState<
      "reconcile" |
      "setup"
    >(
      "reconcile",
    );

  const [
    classes,
    setClasses,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    rules,
    setRules,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    classId,
    setClassId,
  ] =
    useState(
      "",
    );

  const [
    year,
    setYear,
  ] =
    useState(
      today.getFullYear(),
    );

  const [
    month,
    setMonth,
  ] =
    useState(
      today.getMonth() +
        1,
    );

  const [
    reconciliation,
    setReconciliation,
  ] =
    useState<{
      class?: {
        id: string;
        name: string;
      };
      monthLabel?: string;
      academicYear?: string;
      summary?: {
        students: number;
        expectedPence: number;
        receivedPence: number;
        outstandingPence: number;
        arrearsPence: number;
        totalOutstandingPence: number;
        paid: number;
        partPaid: number;
        unpaid: number;
      };
      rows?: FeeReconciliationRow[];
    }>({});

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    preparing,
    setPreparing,
  ] =
    useState(
      false,
    );

  const [
    savingRules,
    setSavingRules,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    notice,
    setNotice,
  ] =
    useState(
      "",
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      "all",
    );

  const [
    paymentTarget,
    setPaymentTarget,
  ] =
    useState<FeeReconciliationRow | null>(
      null,
    );

  const [
    paymentHistoryTarget,
    setPaymentHistoryTarget,
  ] =
    useState<FeeReconciliationRow | null>(
      null,
    );

  const [
    paymentHistory,
    setPaymentHistory,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    paymentHistoryLoading,
    setPaymentHistoryLoading,
  ] =
    useState(
      false,
    );

  const [
    monthlyDrafts,
    setMonthlyDrafts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    booksDraft,
    setBooksDraft,
  ] =
    useState({
      amount:
        "10.00",
      chargeMonth:
        "9",
      active:
        true,
    });

  const loadRules =
    useCallback(
      async () => {
        const response =
          await fetch(
            "/api/v1/fee-rules",
            {
              cache:
                "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(
              () => ({}),
            )) as {
            classes?: Row[];
            rules?: Row[];
            error?: string;
          };

        if (
          !response.ok
        ) {
          throw new Error(
            result.error ??
              "Unable to load fee setup.",
          );
        }

        const loadedClasses =
          result.classes ??
          [];

        const loadedRules =
          result.rules ??
          [];

        setClasses(
          loadedClasses,
        );

        setRules(
          loadedRules,
        );

        if (
          !classId &&
          loadedClasses.length
        ) {
          setClassId(
            String(
              loadedClasses[0]
                .id ??
                "",
            ),
          );
        }

        const drafts:
          Record<
            string,
            string
          > =
            {};

        for (
          const classRow of
            loadedClasses
        ) {
          const id =
            String(
              classRow.id ??
                "",
            );

          const rule =
            loadedRules.find(
              (
                row,
              ) =>
                String(
                  row.class_id ??
                    "",
                ) ===
                  id &&
                String(
                  row.fee_code ??
                    "",
                ) ===
                  "madrasah",
            );

          drafts[
            id
          ] =
            (
              Number(
                rule
                  ?.amount_pence ??
                  0,
              ) /
              100
            ).toFixed(
              2,
            );
        }

        setMonthlyDrafts(
          drafts,
        );

        const books =
          loadedRules.find(
            (
              row,
            ) =>
              !row.class_id &&
              String(
                row.fee_code ??
                  "",
              ) ===
                "books",
          );

        if (
          books
        ) {
          setBooksDraft({
            amount:
              (
                Number(
                  books.amount_pence ??
                    1000,
                ) /
                100
              ).toFixed(
                2,
              ),
            chargeMonth:
              String(
                books.charge_month ??
                  9,
              ),
            active:
              Number(
                books.active ??
                  1,
              ) ===
              1,
          });
        }
      },
      [
        classId,
      ],
    );

  const loadReconciliation =
    useCallback(
      async (
        selectedClassId =
          classId,
      ) => {
        if (
          !selectedClassId
        ) {
          setReconciliation(
            {},
          );
          return;
        }

        setLoading(
          true,
        );
        setError(
          "",
        );

        try {
          const params =
            new URLSearchParams({
              classId:
                selectedClassId,
              year:
                String(
                  year,
                ),
              month:
                String(
                  month,
                ),
            });

          const response =
            await fetch(
              `/api/v1/fee-reconciliation?${params.toString()}`,
              {
                cache:
                  "no-store",
              },
            );

          const result =
            (await response
              .json()
              .catch(
                () => ({}),
              )) as any;

          if (
            !response.ok
          ) {
            setError(
              result.error ??
                "Unable to load reconciliation.",
            );
            return;
          }

          setReconciliation(
            result,
          );
        }
        catch {
          setError(
            "Unable to connect to the fee reconciliation service.",
          );
        }
        finally {
          setLoading(
            false,
          );
        }
      },
      [
        classId,
        year,
        month,
      ],
    );

  useEffect(
    () => {
      setLoading(
        true,
      );

      loadRules()
        .catch(
          (
            problem,
          ) =>
            setError(
              problem instanceof
                Error
                ? problem.message
                : "Unable to load fee setup.",
            ),
        )
        .finally(
          () =>
            setLoading(
              false,
            ),
        );
    },
    [
      loadRules,
    ],
  );

  useEffect(
    () => {
      if (
        classId &&
        tab ===
          "reconcile"
      ) {
        void loadReconciliation();
      }
    },
    [
      classId,
      year,
      month,
      tab,
      loadReconciliation,
    ],
  );

  async function prepareMonth() {
    if (
      !classId
    ) {
      return;
    }

    setPreparing(
      true,
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      const response =
        await fetch(
          "/api/v1/fee-reconciliation",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "prepare",
                classId,
                year,
                month,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
          created?: number;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to prepare this month.",
        );
        return;
      }

      setNotice(
        result.created
          ? `${result.created} fee charge${result.created === 1 ? "" : "s"} prepared. Existing historical charges were left unchanged.`
          : "This month is already prepared. Nothing was duplicated.",
      );

      await loadReconciliation();
    }
    catch {
      setError(
        "Unable to prepare the selected month.",
      );
    }
    finally {
      setPreparing(
        false,
      );
    }
  }

  async function saveFeeSetup() {
    setSavingRules(
      true,
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      const monthlyRules =
        classes.map(
          (
            classRow,
          ) => {
            const id =
              String(
                classRow.id ??
                  "",
              );

            const poundsValue =
              Number(
                monthlyDrafts[
                  id
                ] ??
                  0,
              );

            return {
              classId:
                id,
              amountPence:
                Math.round(
                  poundsValue *
                    100,
                ),
              active:
                true,
            };
          },
        );

      const response =
        await fetch(
          "/api/v1/fee-rules",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "save_all",
                monthlyRules,
                books: {
                  amountPence:
                    Math.round(
                      Number(
                        booksDraft.amount ||
                          0,
                      ) *
                        100,
                    ),
                  chargeMonth:
                    Number(
                      booksDraft.chargeMonth,
                    ),
                  active:
                    booksDraft.active,
                },
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to save fee setup.",
        );
        return;
      }

      setNotice(
        "Fee setup saved. Reconciliation has been refreshed with the latest fee setup.",
      );

      await loadRules();
      await loadReconciliation();
      setTab(
        "reconcile",
      );
    }
    catch {
      setError(
        "Unable to save fee setup.",
      );
    }
    finally {
      setSavingRules(
        false,
      );
    }
  }

  async function recordPayment(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !paymentTarget
    ) {
      return;
    }

    const form =
      new FormData(
        event.currentTarget,
      );

    const amount =
      Number(
        form.get(
          "amount",
        ) ??
          0,
      );

    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      const response =
        await fetch(
          "/api/v1/fee-reconciliation",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "record_payment",
                studentId:
                  paymentTarget.studentId,
                amountPence:
                  Math.round(
                    amount *
                      100,
                  ),
                method:
                  String(
                    form.get(
                      "method",
                    ) ??
                      "",
                  ),
                paymentDate:
                  String(
                    form.get(
                      "paymentDate",
                    ) ??
                      "",
                  ),
                reference:
                  String(
                    form.get(
                      "reference",
                    ) ??
                      "",
                  ),
                note:
                  String(
                    form.get(
                      "note",
                    ) ??
                      "",
                  ),
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
          receiptNumber?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to record payment.",
        );
        return;
      }

      setPaymentTarget(
        null,
      );

      setNotice(
        `Payment recorded${result.receiptNumber ? ` · Receipt ${result.receiptNumber}` : ""}. It was allocated to the student's oldest outstanding fees first.`,
      );

      await loadReconciliation();
    }
    catch {
      setError(
        "Unable to record payment.",
      );
    }
  }

  async function openHistory(
    row:
      FeeReconciliationRow,
  ) {
    setPaymentHistoryTarget(
      row,
    );
    setPaymentHistory(
      [],
    );
    setPaymentHistoryLoading(
      true,
    );

    try {
      const params =
        new URLSearchParams({
          historyStudentId:
            row.studentId,
        });

      const response =
        await fetch(
          `/api/v1/fee-reconciliation?${params.toString()}`,
          {
            cache:
              "no-store",
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          payments?: Row[];
        };

      if (
        response.ok
      ) {
        setPaymentHistory(
          result.payments ??
            [],
        );
      }
    }
    finally {
      setPaymentHistoryLoading(
        false,
      );
    }
  }

  const rows =
    reconciliation.rows ??
    [];

  const filteredRows =
    rows.filter(
      (
        row,
      ) => {
        const q =
          search
            .trim()
            .toLowerCase();

        const searchMatch =
          !q ||
          row.studentName
            .toLowerCase()
            .includes(
              q,
            ) ||
          row.studentNumber
            .toLowerCase()
            .includes(
              q,
            );

        const statusMatch =
          statusFilter ===
            "all" ||
          row.status ===
            statusFilter;

        return (
          searchMatch &&
          statusMatch
        );
      },
    );

  function exportCsv() {
    const headers = [
      "Student number",
      "Student name",
      "Monthly fee",
      "Monthly paid",
      "Books expected",
      "Books paid",
      "Current month expected",
      "Current month paid",
      "Current month outstanding",
      "Arrears",
      "Total outstanding",
      "Status",
      "Last payment date",
      "Last payment method",
      "Last payment reference",
    ];

    const csvRows =
      filteredRows.map(
        (
          row,
        ) => [
          row.studentNumber,
          row.studentName,
          (
            row.monthlyExpectedPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.monthlyPaidPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.booksExpectedPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.booksPaidPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.currentExpectedPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.currentPaidPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.currentOutstandingPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.arrearsPence /
            100
          ).toFixed(
            2,
          ),
          (
            row.totalOutstandingPence /
            100
          ).toFixed(
            2,
          ),
          row.status,
          row.lastPaymentDate ??
            "",
          row.lastPaymentMethod ??
            "",
          row.lastPaymentReference ??
            "",
        ],
      );

    const escapeCell =
      (
        value:
          unknown,
      ) =>
        `"${String(
          value ??
            "",
        ).replaceAll(
          '"',
          '""',
        )}"`;

    const csv =
      [
        headers,
        ...csvRows,
      ]
        .map(
          (
            row,
          ) =>
            row
              .map(
                escapeCell,
              )
              .join(
                ",",
              ),
        )
        .join(
          "\n",
        );

    const blob =
      new Blob(
        [
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const anchor =
      document.createElement(
        "a",
      );

    anchor.href =
      url;

    anchor.download =
      `BNMC-fee-reconciliation-${year}-${String(month).padStart(2, "0")}.csv`;

    anchor.click();

    URL.revokeObjectURL(
      url,
    );
  }

  const summary =
    reconciliation.summary;

  const monthOptions =
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

  return (
    <section className="fee-reconciliation-workspace">
      <div className="records-head fee-reconciliation-head">
        <div>
          <small>
            Finance
          </small>

          <h1>
            Fee Reconciliation
          </h1>

          <p>
            Reconcile monthly Madrasah fees, books and direct bank transfers against each student.
          </p>
        </div>

        <div className="fee-reconciliation-head-actions">
          {tab === "reconcile" && (
            <button
              type="button"
              className="fee-reconciliation-refresh"
              onClick={() =>
                loadReconciliation()
              }
              disabled={
                loading ||
                !classId
              }
            >
              <RefreshCw />
              Refresh
            </button>
          )}

          <div className="fee-reconciliation-tabs">
          <button
            type="button"
            className={
              tab ===
              "reconcile"
                ? "active"
                : ""
            }
            onClick={() =>
              setTab(
                "reconcile",
              )
            }
          >
            Reconciliation
          </button>

          <button
            type="button"
            className={
              tab ===
              "setup"
                ? "active"
                : ""
            }
            onClick={() =>
              setTab(
                "setup",
              )
            }
          >
            Fee setup
          </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="portal-error">
          {error}
        </div>
      )}

      {notice && (
        <div className="portal-success">
          {notice}
        </div>
      )}

      {tab ===
      "setup" ? (
        <div className="fee-setup-grid">
          <section className="portal-card fee-setup-card">
            <header>
              <div>
                <small>
                  Monthly recurring fees
                </small>

                <h2>
                  Madrasah fee by class
                </h2>

                <p>
                  These amounts are used for future months. Historical invoices already prepared are not rewritten.
                </p>
              </div>
            </header>

            <div className="fee-setup-table">
              <div className="fee-setup-row heading">
                <span>
                  Class
                </span>

                <span>
                  Students
                </span>

                <span>
                  Monthly fee
                </span>
              </div>

              {classes.map(
                (
                  classRow,
                ) => {
                  const id =
                    String(
                      classRow.id ??
                        "",
                    );

                  return (
                    <div
                      className="fee-setup-row"
                      key={
                        id
                      }
                    >
                      <strong>
                        {String(
                          classRow.name ??
                            "",
                        )}
                      </strong>

                      <span>
                        {String(
                          classRow.enrolled ??
                            0,
                        )}
                      </span>

                      <label className="money-input">
                        <span>
                          £
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            monthlyDrafts[
                              id
                            ] ??
                            "0.00"
                          }
                          onChange={(event) =>
                            setMonthlyDrafts(
                              (
                                current,
                              ) => ({
                                ...current,
                                [id]:
                                  event.target.value,
                              }),
                            )
                          }
                        />
                      </label>
                    </div>
                  );
                },
              )}
            </div>
          </section>

          <section className="portal-card fee-setup-card books-fee-card">
            <header>
              <div>
                <small>
                  Annual charge
                </small>

                <h2>
                  Books fee
                </h2>

                <p>
                  The default is £10.00, but the amount and charge month are editable.
                </p>
              </div>
            </header>

            <div className="homepage-settings-fields">
              <label>
                Books fee

                <div className="money-input">
                  <span>
                    £
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      booksDraft.amount
                    }
                    onChange={(event) =>
                      setBooksDraft(
                        (
                          current,
                        ) => ({
                          ...current,
                          amount:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </label>

              <label>
                Charge in

                <select
                  value={
                    booksDraft.chargeMonth
                  }
                  onChange={(event) =>
                    setBooksDraft(
                      (
                        current,
                      ) => ({
                        ...current,
                        chargeMonth:
                          event.target.value,
                      }),
                    )
                  }
                >
                  {monthOptions.map(
                    (
                      label,
                      index,
                    ) => (
                      <option
                        key={
                          label
                        }
                        value={
                          index +
                          1
                        }
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="guardian-primary-checkbox wide">
                <input
                  type="checkbox"
                  checked={
                    booksDraft.active
                  }
                  onChange={(event) =>
                    setBooksDraft(
                      (
                        current,
                      ) => ({
                        ...current,
                        active:
                          event.target.checked,
                      }),
                    )
                  }
                />

                <span>
                  <strong>
                    Books fee active
                  </strong>

                  <small>
                    When active, each student receives one books charge per academic year in the selected month.
                  </small>
                </span>
              </label>
            </div>
          </section>

          <footer className="fee-setup-save">
            <button
              type="button"
              className="primary"
              disabled={
                savingRules
              }
              onClick={
                saveFeeSetup
              }
            >
              {savingRules
                ? "Saving..."
                : "Save fee setup"}
            </button>
          </footer>
        </div>
      ) : (
        <>
          <section className="portal-card fee-period-toolbar">
            <label>
              Academic month

              <select
                value={
                  month
                }
                onChange={(event) =>
                  setMonth(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              >
                {monthOptions.map(
                  (
                    label,
                    index,
                  ) => (
                    <option
                      key={
                        label
                      }
                      value={
                        index +
                        1
                      }
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Year

              <input
                type="number"
                min="2020"
                max="2100"
                value={
                  year
                }
                onChange={(event) =>
                  setYear(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label className="fee-class-selector">
              Class

              <select
                value={
                  classId
                }
                onChange={(event) =>
                  setClassId(
                    event.target.value,
                  )
                }
              >
                {classes.map(
                  (
                    classRow,
                  ) => (
                    <option
                      key={String(
                        classRow.id ??
                          "",
                      )}
                      value={String(
                        classRow.id ??
                          "",
                      )}
                    >
                      {String(
                        classRow.name ??
                          "",
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="button"
              className="primary"
              disabled={
                preparing ||
                !classId
              }
              onClick={
                prepareMonth
              }
            >
              {preparing
                ? "Preparing..."
                : "Prepare / refresh month"}
            </button>
          </section>

          {summary && (
            <section className="fee-summary-grid">
              <article>
                <small>
                  Students
                </small>

                <strong>
                  {summary.students}
                </strong>

                <span>
                  {reconciliation.class
                    ?.name ??
                    ""}
                </span>
              </article>

              <article>
                <small>
                  Expected this month
                </small>

                <strong>
                  {pounds(
                    summary.expectedPence,
                  )}
                </strong>

                <span>
                  {reconciliation.monthLabel}
                </span>
              </article>

              <article>
                <small>
                  Received
                </small>

                <strong>
                  {pounds(
                    summary.receivedPence,
                  )}
                </strong>

                <span>
                  {summary.paid} paid in full
                </span>
              </article>

              <article className="outstanding">
                <small>
                  Current outstanding
                </small>

                <strong>
                  {pounds(
                    summary.outstandingPence,
                  )}
                </strong>

                <span>
                  {summary.partPaid} part-paid · {summary.unpaid} unpaid
                </span>
              </article>

              <article className="arrears">
                <small>
                  Previous arrears
                </small>

                <strong>
                  {pounds(
                    summary.arrearsPence,
                  )}
                </strong>

                <span>
                  Before {reconciliation.monthLabel}
                </span>
              </article>
            </section>
          )}

          <section className="portal-card fee-ledger-card">
            <header className="fee-ledger-tools">
              <div>
                <h2>
                  {reconciliation.class
                    ?.name ??
                    "Class"}{" "}
                  ·{" "}
                  {reconciliation.monthLabel ??
                    ""}
                </h2>

                <p>
                  Excel-style reconciliation. Bank transfers, cash and other manual payments are allocated to the oldest outstanding charge first.
                </p>
              </div>

              <div>
                <input
                  type="search"
                  value={
                    search
                  }
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search student..."
                />

                <select
                  value={
                    statusFilter
                  }
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All statuses
                  </option>

                  <option value="paid">
                    Paid
                  </option>

                  <option value="part_paid">
                    Part paid
                  </option>

                  <option value="unpaid">
                    Unpaid
                  </option>
                </select>

                <button
                  type="button"
                  onClick={
                    exportCsv
                  }
                >
                  Export CSV
                </button>
              </div>
            </header>

            {loading ? (
              <div className="fee-ledger-empty">
                Loading reconciliation...
              </div>
            ) : !filteredRows.length ? (
              <div className="fee-ledger-empty">
                No student fee rows are available yet. If this is a new month, click <b>Prepare / refresh month</b>.
              </div>
            ) : (
              <div className="fee-ledger-scroll">
                <table className="fee-ledger-table">
                  <thead>
                    <tr>
                      <th>
                        Student
                      </th>

                      <th>
                        Monthly fee
                      </th>

                      <th>
                        Monthly paid
                      </th>

                      <th>
                        Books
                      </th>

                      <th>
                        This month due
                      </th>

                      <th>
                        Arrears
                      </th>

                      <th>
                        Total outstanding
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Last payment
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map(
                      (
                        row,
                      ) => (
                        <tr
                          key={
                            row.studentId
                          }
                        >
                          <td>
                            <strong>
                              {row.studentName}
                            </strong>

                            <small>
                              {row.studentNumber}
                            </small>
                          </td>

                          <td>
                            {pounds(
                              row.monthlyExpectedPence,
                            )}
                          </td>

                          <td>
                            {pounds(
                              row.monthlyPaidPence,
                            )}
                          </td>

                          <td>
                            <span className={`fee-book-status ${
                              row.booksOutstandingPence ===
                              0 &&
                              row.booksExpectedPence >
                                0
                                ? "paid"
                                : row.booksPaidPence >
                                    0
                                  ? "part"
                                  : "due"
                            }`}>
                              {row.booksExpectedPence >
                              0
                                ? `${pounds(row.booksPaidPence)} / ${pounds(row.booksExpectedPence)}`
                                : "Not charged"}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {pounds(
                                row.currentOutstandingPence,
                              )}
                            </strong>
                          </td>

                          <td>
                            {pounds(
                              row.arrearsPence,
                            )}
                          </td>

                          <td>
                            <strong className={
                              row.totalOutstandingPence >
                              0
                                ? "fee-money-due"
                                : "fee-money-clear"
                            }>
                              {pounds(
                                row.totalOutstandingPence,
                              )}
                            </strong>
                          </td>

                          <td>
                            <span className={`fee-status ${row.status}`}>
                              {row.status ===
                              "part_paid"
                                ? "Part paid"
                                : row.status ===
                                    "paid"
                                  ? "Paid"
                                  : "Unpaid"}
                            </span>
                          </td>

                          <td>
                            {row.lastPaymentDate ? (
                              <button
                                type="button"
                                className="fee-history-link"
                                onClick={() =>
                                  openHistory(
                                    row,
                                  )
                                }
                              >
                                {new Date(
                                  row.lastPaymentDate,
                                ).toLocaleDateString(
                                  "en-GB",
                                )}

                                <small>
                                  {String(
                                    row.lastPaymentMethod ??
                                      "",
                                  ).replaceAll(
                                    "_",
                                    " ",
                                  )}
                                </small>
                              </button>
                            ) : (
                              <span className="fee-muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="fee-row-actions">
                              <button
                                type="button"
                                className="row-action"
                                onClick={() =>
                                  setPaymentTarget(
                                    row,
                                  )
                                }
                                disabled={
                                  row.totalOutstandingPence <=
                                  0
                                }
                              >
                                Record payment
                              </button>

                              <button
                                type="button"
                                className="row-action"
                                onClick={() =>
                                  openHistory(
                                    row,
                                  )
                                }
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {paymentTarget && (
        <div className="modal">
          <form
            className="status-dialog fee-payment-dialog"
            onSubmit={
              recordPayment
            }
          >
            <header>
              <div>
                <small>
                  Manual reconciliation
                </small>

                <h2>
                  Record payment
                </h2>

                <p>
                  {paymentTarget.studentName} · {paymentTarget.studentNumber}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() =>
                  setPaymentTarget(
                    null,
                  )
                }
              >
                <X />
              </button>
            </header>

            <div className="status-dialog-body fee-payment-fields">
              <div className="fee-payment-balance">
                <span>
                  Total outstanding
                </span>

                <strong>
                  {pounds(
                    paymentTarget.totalOutstandingPence,
                  )}
                </strong>

                <small>
                  Current month {pounds(paymentTarget.currentOutstandingPence)} · Arrears {pounds(paymentTarget.arrearsPence)}
                </small>
              </div>

              <label>
                Amount received

                <div className="money-input">
                  <span>
                    £
                  </span>

                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={(
                      paymentTarget.totalOutstandingPence /
                      100
                    ).toFixed(
                      2,
                    )}
                    defaultValue={(
                      (
                        paymentTarget.currentOutstandingPence >
                        0
                          ? paymentTarget.currentOutstandingPence
                          : paymentTarget.totalOutstandingPence
                      ) /
                      100
                    ).toFixed(
                      2,
                    )}
                    required
                  />
                </div>
              </label>

              <label>
                Payment method

                <select
                  name="method"
                  defaultValue="bank_transfer"
                  required
                >
                  <option value="bank_transfer">
                    Bank transfer
                  </option>

                  <option value="cash">
                    Cash
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </label>

              <label>
                Payment date

                <input
                  name="paymentDate"
                  type="date"
                  defaultValue={new Date()
                    .toISOString()
                    .slice(
                      0,
                      10,
                    )}
                  required
                />
              </label>

              <label>
                Bank / payment reference

                <input
                  name="reference"
                  placeholder="e.g. AHMED SEP FEE"
                />
              </label>

              <label className="wide">
                Notes

                <textarea
                  name="note"
                  rows={3}
                  placeholder="Optional reconciliation note"
                />
              </label>

              <div className="fee-allocation-note wide">
                The payment will be allocated automatically to this student&apos;s oldest outstanding fee first, including any previous-month arrears.
              </div>
            </div>

            <footer>
              <button
                type="button"
                onClick={() =>
                  setPaymentTarget(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary"
              >
                Record payment
              </button>
            </footer>
          </form>
        </div>
      )}

      {paymentHistoryTarget && (
        <div className="modal">
          <div className="status-dialog fee-history-dialog">
            <header>
              <div>
                <small>
                  Payment history
                </small>

                <h2>
                  {paymentHistoryTarget.studentName}
                </h2>

                <p>
                  {paymentHistoryTarget.studentNumber}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() =>
                  setPaymentHistoryTarget(
                    null,
                  )
                }
              >
                <X />
              </button>
            </header>

            <div className="status-dialog-body">
              {paymentHistoryLoading ? (
                <div className="fee-ledger-empty">
                  Loading payment history...
                </div>
              ) : !paymentHistory.length ? (
                <div className="fee-ledger-empty">
                  No recorded payments yet.
                </div>
              ) : (
                <div className="fee-history-list">
                  {paymentHistory.map(
                    (
                      payment,
                    ) => (
                      <article
                        key={String(
                          payment.id ??
                            "",
                        )}
                      >
                        <div>
                          <strong>
                            {pounds(
                              payment.amountPence,
                            )}
                          </strong>

                          <small>
                            {new Date(
                              String(
                                payment.paidAt ??
                                  "",
                              ),
                            ).toLocaleDateString(
                              "en-GB",
                            )}
                          </small>
                        </div>

                        <div>
                          <b>
                            {String(
                              payment.provider ??
                                "",
                            ).replaceAll(
                              "_",
                              " ",
                            )}
                          </b>

                          <span>
                            {String(
                              payment.reference ??
                                "No reference",
                            )}
                          </span>
                        </div>

                        <ul>
                          {Array.isArray(
                            payment.allocations,
                          ) &&
                            (
                              payment.allocations as Row[]
                            ).map(
                              (
                                allocation,
                                index,
                              ) => (
                                <li
                                  key={
                                    index
                                  }
                                >
                                  {String(
                                    allocation.description ??
                                      "Fee",
                                  )}
                                  <b>
                                    {pounds(
                                      allocation.amountPence,
                                    )}
                                  </b>
                                </li>
                              ),
                            )}
                        </ul>

                        {Boolean(payment.note) && (
                          <p>
                            {String(
                              payment.note,
                            )}
                          </p>
                        )}
                      </article>
                    ),
                  )}
                </div>
              )}
            </div>

            <footer>
              <button
                type="button"
                className="primary"
                onClick={() =>
                  setPaymentHistoryTarget(
                    null,
                  )
                }
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

function Billing({
  user,
  paymentReturn,
  directDebitReturn,
  startSection,
  openStudent,
}: {
  user: User;
  paymentReturn:
    PaymentReturn;
  directDebitReturn:
    DirectDebitReturn;
  startSection:
    BillingSection | null;
  openStudent:
    (studentId: unknown) => void;
}) {
  const initialSection:
    BillingSection =
    directDebitReturn
      ? "direct_debit"
      : paymentReturn
        ? "invoices"
        : startSection ??
          "invoices";

  const [
    section,
    setSection,
  ] =
    useState<BillingSection>(
      initialSection,
    );

  const [
    rows,
    setRows,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    modal,
    setModal,
  ] =
    useState<
      | "plan"
      | "agreement"
      | "invoice"
      | null
    >(null);

  const [
    plans,
    setPlans,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    agreements,
    setAgreements,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    students,
    setStudents,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    invoiceStudents,
    setInvoiceStudents,
  ] =
    useState<Row[]>(
      [],
    );

  const loadSection =
    useCallback(
      async (
        target:
          BillingSection =
          section,
      ) => {
        setLoading(
          true,
        );

        setError("");

        try {
          const apiSection =
            target ===
            "direct_debit"
              ? "agreements"
              : target;

          const response =
            await fetch(
              `/api/v1/billing?section=${apiSection}`,
              {
                cache:
                  "no-store",
              },
            );

          if (
            response.status ===
            401
          ) {
            window.location.assign(
              "/login",
            );

            return;
          }

          const result =
            (await response.json()) as {
              data?: Row[];
              error?: string;
            };

          if (
            !response.ok
          ) {
            setError(
              result.error ??
                "Unable to load billing data",
            );

            setRows(
              [],
            );

            return;
          }

          setRows(
            result.data ??
              [],
          );

          /*
           * The invoice API only returns students who already have invoice
           * rows. For the admin/finance Fees & Payments workspace we also
           * load every active student so students who have not yet been
           * invoiced are still visible and can be identified.
           */
          if (
            target ===
              "invoices" &&
            user.role !==
              "parent"
          ) {
            try {
              const studentResponse =
                await fetch(
                  "/api/v1/students",
                  {
                    cache:
                      "no-store",
                  },
                );

              const studentResult =
                (await studentResponse
                  .json()
                  .catch(
                    () => ({}),
                  )) as {
                  data?: Row[];
                };

              if (
                studentResponse.ok
              ) {
                setInvoiceStudents(
                  (
                    studentResult.data ??
                    []
                  ).filter(
                    (student) =>
                      String(
                        student.status ??
                          "active",
                      ).toLowerCase() ===
                      "active",
                  ),
                );
              }
            }
            catch {
              /*
               * Invoice rows remain usable even if the supplementary
               * active-student list fails to load.
               */
            }
          }
        } catch {
          setError(
            "Unable to connect to the billing service.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        section,
        user.role,
      ],
    );

  useEffect(
    () => {
      loadSection(
        section,
      );
    },
    [
      section,
      loadSection,
    ],
  );

  useEffect(
    () => {
      if (
        !startSection
      ) {
        return;
      }

      setSection(
        startSection,
      );
    },
    [
      startSection,
    ],
  );

  /*
   * After Stripe returns the user to
   * the portal, force Billing to the
   * invoice screen.
   *
   * The first refresh happens
   * immediately. Two additional
   * refreshes allow for the small
   * possibility that the browser
   * redirects before the Stripe
   * webhook has finished updating D1.
   */
  useEffect(
    () => {
      if (
        !paymentReturn
      ) {
        return;
      }

      setSection(
        "invoices",
      );

      loadSection(
        "invoices",
      );

      if (
        paymentReturn !==
        "success"
      ) {
        return;
      }

      const retryOne =
        window.setTimeout(
          () => {
            loadSection(
              "invoices",
            );
          },
          1500,
        );

      const retryTwo =
        window.setTimeout(
          () => {
            loadSection(
              "invoices",
            );
          },
          3000,
        );

      return () => {
        window.clearTimeout(
          retryOne,
        );

        window.clearTimeout(
          retryTwo,
        );
      };
    },
    [
      paymentReturn,
      loadSection,
    ],
  );

  /*
   * A production GoCardless hosted flow can return
   * to /portal?direct_debit=success|cancelled.
   * Keep the user in the Direct Debit workspace.
   * Actual mandate state is confirmed by the sync
   * route or webhook, never by the query string.
   */
  useEffect(
    () => {
      if (
        !directDebitReturn
      ) {
        return;
      }

      setSection(
        "direct_debit",
      );

      loadSection(
        "direct_debit",
      );
    },
    [
      directDebitReturn,
      loadSection,
    ],
  );

  async function openModal(
    type:
      | "plan"
      | "agreement"
      | "invoice",
  ) {
    setError("");

    try {
      if (
        type ===
        "agreement"
      ) {
        const [
          planResponse,
          studentResponse,
        ] =
          await Promise.all(
            [
              fetch(
                "/api/v1/billing?section=plans",
              ),

              fetch(
                "/api/v1/students",
              ),
            ],
          );

        const planResult =
          (await planResponse.json()) as {
            data?: Row[];
            error?: string;
          };

        const studentResult =
          (await studentResponse.json()) as {
            data?: Row[];
            error?: string;
          };

        if (
          !planResponse.ok
        ) {
          throw new Error(
            planResult.error ??
              "Unable to load fee plans",
          );
        }

        if (
          !studentResponse.ok
        ) {
          throw new Error(
            studentResult.error ??
              "Unable to load students",
          );
        }

        setPlans(
          (
            planResult.data ??
            []
          ).filter(
            (plan) =>
              Number(
                plan.active,
              ) === 1 &&
              String(
                plan.frequency,
              ) ===
                "monthly",
          ),
        );

        setStudents(
          (
            studentResult.data ??
            []
          ).filter(
            (student) =>
              String(
                student.status,
              ) ===
              "active",
          ),
        );
      }

      if (
        type ===
        "invoice"
      ) {
        const response =
          await fetch(
            "/api/v1/billing?section=agreements",
          );

        const result =
          (await response.json()) as {
            data?: Row[];
            error?: string;
          };

        if (
          !response.ok
        ) {
          throw new Error(
            result.error ??
              "Unable to load agreements",
          );
        }

        setAgreements(
          (
            result.data ??
            []
          ).filter(
            (agreement) =>
              String(
                agreement.status,
              ) ===
              "active",
          ),
        );
      }

      setModal(
        type,
      );
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to prepare the billing form",
      );
    }
  }

  const canManage =
    user.role === "admin" ||
    user.role === "finance" ||
    Boolean(
      user.permissions?.includes(
        "billing.manage",
      ),
    );

  const totalOutstanding =
    useMemo(
      () =>
        section ===
        "invoices"
          ? rows.reduce(
              (
                total,
                row,
              ) =>
                total +
                Number(
                  row.balance_pence ??
                    0,
                ),
              0,
            )
          : 0,
      [
        rows,
        section,
      ],
    );

  return (
    <section className="records billing-workspace">
      <div className="records-head">
        <div>
          <h1>
            Fees & Payments
          </h1>

          <p>
            {user.role ===
            "parent"
              ? "View invoices, make a one-time payment, or manage automatic Direct Debit."
              : "See what is owed, manage student fees and keep payment setup in one place."}
          </p>
        </div>

        <span>
          <button
            onClick={() =>
              loadSection(
                section,
              )
            }
          >
            <RefreshCw />

            Refresh
          </button>

          {canManage &&
            section ===
              "plans" && (
              <button
                className="primary"
                onClick={() =>
                  openModal(
                    "plan",
                  )
                }
              >
                <Plus />

                Add fee plan
              </button>
            )}

          {canManage &&
            section ===
              "agreements" && (
              <button
                className="primary"
                onClick={() =>
                  openModal(
                    "agreement",
                  )
                }
              >
                <Plus />

                Set student fee
              </button>
            )}

          {canManage &&
            section ===
              "invoices" && (
              <button
                className="primary"
                onClick={() =>
                  openModal(
                    "invoice",
                  )
                }
              >
                <Plus />

                Generate monthly invoices
              </button>
            )}
        </span>
      </div>

      <div className="billing-tabs">
        <button
          className={
            section ===
            "invoices"
              ? "active"
              : ""
          }
          onClick={() =>
            setSection(
              "invoices",
            )
          }
        >
          <ReceiptText />

          Invoices
        </button>

        <button
          className={
            section ===
            "direct_debit"
              ? "active"
              : ""
          }
          onClick={() =>
            setSection(
              "direct_debit",
            )
          }
        >
          <Landmark />

          {user.role ===
          "parent"
            ? "Payment method"
            : "Direct Debit"}
        </button>

      </div>

      {section ===
        "invoices" && (
        <div className="billing-summary">
          <section className="portal-card">
            <small>
              Outstanding balance
            </small>

            <strong>
              {money(
                totalOutstanding,
              )}
            </strong>
          </section>

          <section className="portal-card">
            <small>
              Payment options
            </small>

            <PaymentMethodMarks />
          </section>

          <section className="portal-card">
            <small>
              Standard monthly fee
            </small>

            <strong>
              £30 per student
            </strong>
          </section>
        </div>
      )}

      {error && (
        <div className="portal-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty">
          <RefreshCw />

          Loading billing records...
        </div>
      ) : rows.length ===
        0 ? (
        <div className="empty">
          <ReceiptText />

          <b>
            No billing records yet
          </b>

          <p>
            {section ===
            "plans"
              ? "Create your first fee plan."
              : section ===
                  "agreements"
                ? "Assign a fee plan to an active student."
                : section ===
                    "direct_debit"
                  ? "No active student fee agreements are available for Direct Debit."
                  : "No invoices have been generated yet."}
          </p>
        </div>
      ) : section ===
        "plans" ? (
        <FeePlanTable
          rows={
            rows
          }
        />
      ) : section ===
        "agreements" ? (
        <AgreementTable
          rows={
            rows
          }
          openStudent={
            openStudent
          }
        />
      ) : section ===
        "direct_debit" ? (
        <DirectDebitTable
          rows={
            rows
          }
          directDebitReturn={
            directDebitReturn
          }
          parent={
            user.role ===
            "parent"
          }
          openStudent={
            openStudent
          }
          viewInvoices={() =>
            setSection(
              "invoices",
            )
          }
        />
      ) : (
        <InvoiceTable
          rows={
            rows
          }
          students={
            invoiceStudents
          }
          parent={
            user.role ===
            "parent"
          }
          canRecordCash={
            user.role ===
            "admin"
          }
          refresh={() =>
            loadSection(
              "invoices",
            )
          }
          openStudent={
            openStudent
          }
        />
      )}

      {modal ===
        "plan" && (
        <FeePlanForm
          close={() =>
            setModal(
              null,
            )
          }
          saved={() => {
            setModal(
              null,
            );

            setSection(
              "plans",
            );

            loadSection(
              "plans",
            );
          }}
        />
      )}

      {modal ===
        "agreement" && (
        <AgreementForm
          students={
            students
          }
          plans={
            plans
          }
          close={() =>
            setModal(
              null,
            )
          }
          saved={() => {
            setModal(
              null,
            );

            setSection(
              "agreements",
            );

            loadSection(
              "agreements",
            );
          }}
        />
      )}

      {modal ===
        "invoice" && (
        <MonthlyInvoiceForm
          close={() =>
            setModal(
              null,
            )
          }
          saved={() => {
            setSection(
              "invoices",
            );

            loadSection(
              "invoices",
            );
          }}
        />
      )}
    </section>
  );
}


function PaymentMethodMarks() {
  return (
    <div
      className="payment-method-marks"
      aria-label="Card, Apple Pay and Google Pay"
    >
      <span className="payment-method-card">
        <CreditCard />

        <span>
          Card
        </span>
      </span>

      <span
        className="payment-brand-mark"
        title="Apple Pay"
      >
        <Image
          src="/apple-pay-mark.svg"
          alt="Apple Pay"
          width={60}
          height={24}
          unoptimized
        />
      </span>

      <span
        className="payment-brand-mark"
        title="Google Pay"
      >
        <Image
          src="/google-pay-mark.svg"
          alt="Google Pay"
          width={60}
          height={24}
          unoptimized
        />
      </span>
    </div>
  );
}

function DirectDebitTable({
  rows,
  directDebitReturn,
  openStudent,
  parent,
  viewInvoices,
}: {
  rows: Row[];
  directDebitReturn:
    DirectDebitReturn;
  openStudent?:
    (studentId: unknown) => void;
  parent: boolean;
  viewInvoices:
    () => void;
}) {
  const [
    statuses,
    setStatuses,
  ] =
    useState<
      Record<
        string,
        DirectDebitStatus
      >
    >({});

  const [
    busyAgreement,
    setBusyAgreement,
  ] =
    useState<string | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<{
      type:
        | "success"
        | "info"
        | "error";
      text: string;
    } | null>(
      directDebitReturn ===
        "success"
        ? {
            type:
              "success",

            text:
              "Direct Debit authorisation was completed. The mandate status is being confirmed automatically.",
          }
        : directDebitReturn ===
            "cancelled"
          ? {
              type:
                "info",

              text:
                "Direct Debit setup was cancelled. No bank mandate has been activated.",
            }
          : null,
    );

  const lastReturn =
    useRef<
      DirectDebitReturn
    >(directDebitReturn);

  const pendingSetups =
    useRef<
      Set<string>
    >(
      new Set(),
    );

  const pollTimers =
    useRef<
      Record<
        string,
        number
      >
    >({});

  const initialSynced =
    useRef<
      Set<string>
    >(
      new Set(),
    );

  const displayRows =
    useMemo(
      () => {
        const unique =
          new Map<
            string,
            Row
          >();

        for (
          const row
          of rows
        ) {
          if (
            String(
              row.status ??
                "",
            ) !==
            "active"
          ) {
            continue;
          }

          const key =
            String(
              row.student_id ??
                row.id ??
                "",
            );

          if (!key) {
            continue;
          }

          const current =
            unique.get(key);

          if (
            !current ||
            String(
              row.starts_on ??
                "",
            ) >
              String(
                current.starts_on ??
                  "",
              )
          ) {
            unique.set(
              key,
              row,
            );
          }
        }

        return Array.from(
          unique.values(),
        );
      },
      [rows],
    );

  const syncInFlight =
    useRef<
      Set<string>
    >(
      new Set(),
    );

  /*
   * Informational/success notices should not remain
   * on screen indefinitely. Errors remain until the
   * user dismisses them.
   */
  useEffect(
    () => {
      if (
        !message ||
        message.type ===
          "error"
      ) {
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            setMessage(
              null,
            );
          },
          6500,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      message,
    ],
  );

  useEffect(
    () => {
      if (
        lastReturn.current ===
        directDebitReturn
      ) {
        return;
      }

      lastReturn.current =
        directDebitReturn;

      if (
        directDebitReturn ===
        "success"
      ) {
        setMessage({
          type:
            "success",

          text:
            "Direct Debit authorisation was completed. The mandate status is being confirmed automatically.",
        });
      } else if (
        directDebitReturn ===
        "cancelled"
      ) {
        setMessage({
          type:
            "info",

          text:
            "Direct Debit setup was cancelled. No bank mandate has been activated.",
        });
      }
    },
    [
      directDebitReturn,
    ],
  );

  useEffect(
    () => {
      return () => {
        Object.values(
          pollTimers.current,
        ).forEach(
          (timer) => {
            window.clearTimeout(
              timer,
            );
          },
        );
      };
    },
    [],
  );

  function normaliseStatus(
    value: unknown,
  ) {
    return String(
      value ??
        "",
    )
      .trim()
      .toLowerCase()
      .replace(
        /[.\s-]+/g,
        "_",
      );
  }

  function rowForAgreement(
    agreementId: string,
  ) {
    return displayRows.find(
      (row) =>
        String(
          row.id ??
            "",
        ) ===
        agreementId,
    );
  }

  async function syncDirectDebit(
    row: Row,
    options?: {
      announce?: boolean;
      showBusy?: boolean;
      force?: boolean;
    },
  ): Promise<
    DirectDebitStatus | null
  > {
    const agreementId =
      String(
        row.id ??
          "",
      );

    if (
      !agreementId
    ) {
      return null;
    }

    if (
      syncInFlight.current.has(
        agreementId,
      )
    ) {
      return (
        statuses[agreementId] ??
        null
      );
    }

    syncInFlight.current.add(
      agreementId,
    );

    const announce =
      options?.announce ??
      true;

    const showBusy =
      options?.showBusy ??
      true;

    if (
      showBusy
    ) {
      setBusyAgreement(
        agreementId,
      );
    }

    if (
      announce
    ) {
      setMessage({
        type: "info",
        text:
          "Checking Direct Debit status with GoCardless...",
      });
    }

    try {
      const response =
        await fetch(
          "/api/payments/gocardless/sync",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                agreementId,
                force:
                  options?.force ??
                  false,
              }),
          },
        );

      const result =
        (await response.json()) as
          DirectDebitStatus;

      if (
        !response.ok
      ) {
        if (
          response.status ===
          404
        ) {
          setStatuses(
            (
              current,
            ) => ({
              ...current,

              [agreementId]: {
                mandateStatus:
                  "not_setup",
              },
            }),
          );

          if (
            announce
          ) {
            setMessage({
              type:
                "info",

              text:
                "No Direct Debit setup has been started for this agreement yet.",
            });
          }

          return null;
        }

        if (
          announce
        ) {
          setMessage({
            type:
              "error",

            text:
              friendlyPaymentError(
                result.error,
                "direct_debit",
              ),
          });
        }

        return null;
      }

      const mandateStatus =
        normaliseStatus(
          result.mandateStatus ??
            result.billingRequestStatus ??
            "pending",
        );

      const billingStatus =
        normaliseStatus(
          result.billingRequestStatus,
        );

      const normalisedResult: DirectDebitStatus =
        {
          ...result,

          mandateStatus:
            mandateStatus ||
            "pending",

          billingRequestStatus:
            billingStatus ||
            result.billingRequestStatus,
        };

      setStatuses(
        (
          current,
        ) => ({
          ...current,

          [agreementId]:
            normalisedResult,
        }),
      );

      if (
        result.rateLimited
      ) {
        if (announce) {
          setMessage({
            type: "info",
            text:
              "Direct Debit status is temporarily using the last saved update. It will refresh automatically shortly.",
          });
        }

        return normalisedResult;
      }

      const terminalFailure =
        [
          "failed",
          "cancelled",
          "expired",
          "blocked",
          "consumed",
          "inactive",
        ].includes(
          mandateStatus,
        );

      const mandateCreated =
        Boolean(
          result.mandateId,
        ) ||
        billingStatus ===
          "fulfilled";

      if (
        terminalFailure ||
        mandateCreated
      ) {
        pendingSetups.current.delete(
          agreementId,
        );

        const timer =
          pollTimers.current[
            agreementId
          ];

        if (
          timer
        ) {
          window.clearTimeout(
            timer,
          );

          delete pollTimers
            .current[
              agreementId
            ];
        }
      }

      if (
        announce
      ) {
        if (
          mandateStatus ===
          "active"
        ) {
          setMessage({
            type:
              "success",

            text:
              "Direct Debit is active and ready for recurring collections.",
          });
        } else if (
          [
            "pending_submission",
            "submitted",
          ].includes(
            mandateStatus,
          ) ||
          (
            mandateCreated &&
            !terminalFailure
          )
        ) {
          setMessage({
            type:
              "success",

            text:
              `Direct Debit setup is complete. The mandate has been created and is being processed by the bank${
                mandateStatus
                  ? ` (${nice(
                      mandateStatus,
                    )})`
                  : ""
              }.`,
          });
        } else if (
          terminalFailure
        ) {
          setMessage({
            type:
              "error",

            text:
              `Direct Debit mandate status: ${nice(
                mandateStatus,
              )}. A new mandate may need to be set up.`,
          });
        } else {
          setMessage({
            type:
              "info",

            text:
              `Direct Debit status: ${nice(
                mandateStatus ||
                  billingStatus ||
                  "pending",
              )}. GoCardless may still be processing the mandate.`,
          });
        }
      }

      return normalisedResult;
    } catch {
      if (
        announce
      ) {
        setMessage({
          type:
            "error",

          text:
            "Unable to connect to GoCardless status sync.",
        });
      }

      return null;
    } finally {
      syncInFlight.current.delete(
        agreementId,
      );

      if (
        showBusy
      ) {
        setBusyAgreement(
          null,
        );
      }
    }
  }

  /*
   * Load the real GoCardless status automatically
   * when this workspace opens. Parents should never
   * need to press a technical "Check status" button
   * just to discover whether Direct Debit is active.
   */
  useEffect(
    () => {
      displayRows.forEach(
        (row) => {
          const agreementId =
            String(
              row.id ??
                "",
            );

          if (
            !agreementId ||
            initialSynced.current.has(
              agreementId,
            )
          ) {
            return;
          }

          initialSynced.current.add(
            agreementId,
          );

          syncDirectDebit(
            row,
            {
              announce:
                false,
              showBusy:
                false,
            },
          );
        },
      );
    },
    [
      displayRows,
    ],
  );

  function startAutomaticSync(
    row: Row,
  ) {
    const agreementId =
      String(
        row.id ??
          "",
      );

    if (
      !agreementId
    ) {
      return;
    }

    pendingSetups.current.add(
      agreementId,
    );

    const existingTimer =
      pollTimers.current[
        agreementId
      ];

    if (
      existingTimer
    ) {
      window.clearTimeout(
        existingTimer,
      );
    }

    let attempts = 0;

    const check =
      async () => {
        attempts += 1;

        const currentRow =
          rowForAgreement(
            agreementId,
          ) ??
          row;

        const result =
          await syncDirectDebit(
            currentRow,
            {
              announce:
                false,
              showBusy:
                false,
            },
          );

        if (
          result
        ) {
          const mandateStatus =
            normaliseStatus(
              result.mandateStatus ??
                result.billingRequestStatus,
            );

          const billingStatus =
            normaliseStatus(
              result.billingRequestStatus,
            );

          const terminalFailure =
            [
              "failed",
              "cancelled",
              "expired",
              "blocked",
              "consumed",
              "inactive",
            ].includes(
              mandateStatus,
            );

          const mandateCreated =
            Boolean(
              result.mandateId,
            ) ||
            billingStatus ===
              "fulfilled";

          if (
            mandateStatus ===
              "active"
          ) {
            pendingSetups.current.delete(
              agreementId,
            );

            setMessage({
              type:
                "success",

              text:
                "Direct Debit is active and ready for recurring collections.",
            });

            return;
          }

          if (
            mandateCreated &&
            !terminalFailure
          ) {
            pendingSetups.current.delete(
              agreementId,
            );

            setMessage({
              type:
                "success",

              text:
                `Direct Debit setup completed successfully. The bank mandate is now ${nice(
                  mandateStatus ||
                    "pending_submission",
                )}.`,
            });

            return;
          }

          if (
            terminalFailure
          ) {
            pendingSetups.current.delete(
              agreementId,
            );

            setMessage({
              type:
                "error",

              text:
                `GoCardless returned mandate status ${nice(
                  mandateStatus,
                )}. Please review the mandate before collecting payments.`,
            });

            return;
          }
        }

        /*
         * Poll for up to roughly one minute. This is
         * only for the local hosted-page workflow.
         * Production webhooks remain authoritative.
         */
        if (
          attempts < 6 &&
          pendingSetups.current.has(
            agreementId,
          )
        ) {
          pollTimers.current[
            agreementId
          ] =
            window.setTimeout(
              check,
              10000,
            );
        }
      };

    pollTimers.current[
      agreementId
    ] =
      window.setTimeout(
        check,
        5000,
      );
  }

  /*
   * In local development the GoCardless page opens
   * in another tab because localhost HTTP cannot
   * provide the same HTTPS redirect experience as
   * production. When the user comes back to this
   * tab, immediately sync any setup still in flight.
   */
  useEffect(
    () => {
      const onFocus =
        () => {
          for (
            const agreementId
            of pendingSetups
              .current
          ) {
            const row =
              rowForAgreement(
                agreementId,
              );

            if (
              row
            ) {
              syncDirectDebit(
                row,
                {
                  announce:
                    true,
                  showBusy:
                    false,
                },
              );
            }
          }
        };

      window.addEventListener(
        "focus",
        onFocus,
      );

      return () => {
        window.removeEventListener(
          "focus",
          onFocus,
        );
      };
    },
    [
      rows,
    ],
  );

  /*
   * When an HTTPS GoCardless redirect returns to
   * /portal?direct_debit=success, automatically
   * refresh the status instead of requiring the
   * user to press Check status.
   */
  useEffect(
    () => {
      if (
        directDebitReturn !==
          "success" ||
        displayRows.length ===
          0
      ) {
        return;
      }

      displayRows.forEach(
        (row) => {
          syncDirectDebit(
            row,
            {
              announce:
                false,
              showBusy:
                false,
            },
          );
        },
      );
    },
    [
      directDebitReturn,
      displayRows,
    ],
  );

  async function setupDirectDebit(
    row: Row,
  ) {
    const agreementId =
      String(
        row.id ??
          "",
      );

    if (
      !agreementId
    ) {
      return;
    }

    setBusyAgreement(
      agreementId,
    );

    setMessage({
      type: "info",
      text:
        "Preparing the secure GoCardless Direct Debit setup...",
    });

    try {
      const response =
        await fetch(
          "/api/payments/gocardless/mandate",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                agreementId,
              }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          url?: string;
          billingRequestId?: string;
          localDevelopment?: boolean;
          error?: string;
        };

      if (
        !response.ok
      ) {
        setMessage({
          type:
            "error",

          text:
            friendlyPaymentError(
              result.error,
              "direct_debit",
            ),
        });

        return;
      }

      if (
        !result.url
      ) {
        setMessage({
          type:
            "error",

          text:
            "Direct Debit setup is temporarily unavailable. Please try again later. If the problem continues, contact the Madrasah administrator.",
        });

        return;
      }

      setStatuses(
        (
          current,
        ) => ({
          ...current,

          [agreementId]: {
            ...current[
              agreementId
            ],

            billingRequestId:
              result.billingRequestId,

            billingRequestStatus:
              "pending",

            mandateStatus:
              "pending",
          },
        }),
      );

      if (
        result.localDevelopment
      ) {
        const popup =
          window.open(
            result.url,
            "_blank",
          );

        if (
          popup
        ) {
          popup.opener =
            null;

          setMessage({
            type:
              "success",

            text:
              "The secure GoCardless page opened in a new tab. You can complete the mandate there; this page will check the result automatically.",
          });

          startAutomaticSync(
            row,
          );
        } else {
          window.location.assign(
            result.url,
          );
        }
      } else {
        window.location.assign(
          result.url,
        );
      }
    } catch {
      setMessage({
        type:
          "error",

        text:
          "Direct Debit setup is temporarily unavailable. Please check your connection and try again. If the problem continues, contact the Madrasah administrator.",
      });
    } finally {
      setBusyAgreement(
        null,
      );
    }
  }

  if (
    parent
  ) {
    return (
      <>
        <div className="payment-choice-heading">
          <div>
            <small>
              Choose what works for you
            </small>

            <h3>
              Payment method
            </h3>

            <p>
              Direct Debit can collect future fees automatically. Card, Apple Pay or Google Pay remain available whenever you want to make a one-time payment.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`billing-inline-message ${message.type}`}
            role="status"
            aria-live="polite"
          >
            <span>
              {message.text}
            </span>

            <button
              type="button"
              aria-label="Dismiss Direct Debit message"
              onClick={() =>
                setMessage(
                  null,
                )
              }
            >
              x
            </button>
          </div>
        )}

        <div className="parent-payment-grid">
          <section className="portal-card parent-payment-card">
            <div className="parent-payment-card-head">
              <i>
                <Landmark />
              </i>

              <div>
                <small>
                  Automatic monthly payment
                </small>

                <h3>
                  Direct Debit
                </h3>

                <p>
                  Set it up once and future Madrasah fees can be collected automatically.
                </p>
              </div>
            </div>

            <div className="parent-direct-debit-list">
              {displayRows.map(
                (
                  row,
                  index,
                ) => {
                  const agreementId =
                    String(
                      row.id ??
                        index,
                    );

                  const synced =
                    statuses[
                      agreementId
                    ];

                  const collection =
                    String(
                      synced
                        ?.collectionMethod ??
                      row.collection_method ??
                        "online",
                    );

                  const mandateStatus =
                    normaliseStatus(
                      synced
                        ?.mandateStatus ??
                        (
                          collection ===
                          "direct_debit"
                            ? "pending"
                            : "not_setup"
                        ),
                    );

                  const canSetup =
                    String(
                      row.status ??
                        "",
                    ) ===
                      "active" &&
                    [
                      "not_setup",
                      "cancelled",
                      "failed",
                      "expired",
                      "blocked",
                      "consumed",
                      "inactive",
                    ].includes(
                      mandateStatus,
                    );

                  const isBusy =
                    busyAgreement ===
                    agreementId;

                  const bankSummary =
                    synced?.bankName
                      ? `${synced.bankName}${
                          synced.last4
                            ? `  -  **** ${synced.last4}`
                            : ""
                        }`
                      : synced?.last4
                        ? `**** ${synced.last4}`
                        : "";

                  const studentName =
                    String(
                      row.student_name ??
                        "Student",
                    );

                  const isActive =
                    mandateStatus ===
                    "active";

                  const isProcessing =
                    [
                      "checking",
                      "pending",
                      "pending_submission",
                      "submitted",
                    ].includes(
                      mandateStatus,
                    );

                  return (
                    <div
                      className="parent-direct-debit-item"
                      key={
                        agreementId
                      }
                    >
                      <div>
                        {row.student_id &&
                        openStudent ? (
                          <button
                            type="button"
                            className="student-link"
                            onClick={() =>
                              openStudent(
                                row.student_id,
                              )
                            }
                          >
                            {studentName}
                          </button>
                        ) : (
                          <b>
                            {studentName}
                          </b>
                        )}

                        <small>
                          {money(
                            row.monthly_amount_pence,
                          )}{" "}
                          monthly
                        </small>
                      </div>

                      <div className="payment-method-status">
                        <em
                          className={`status ${mandateStatus}`}
                        >
                          {mandateStatus ===
                          "not_setup"
                            ? "Not set up"
                            : nice(
                                mandateStatus,
                              )}
                        </em>

                        {bankSummary && (
                          <small>
                            {bankSummary}
                          </small>
                        )}
                      </div>

                      {canSetup ? (
                        <button
                          type="button"
                          className="primary payment-choice-button"
                          disabled={
                            isBusy
                          }
                          onClick={() =>
                            setupDirectDebit(
                              row,
                            )
                          }
                        >
                          {isBusy
                            ? "Opening secure setup..."
                            : mandateStatus ===
                                "not_setup"
                              ? "Set up Direct Debit"
                              : "Set up new Direct Debit"}
                        </button>
                      ) : isActive ? (
                        <div className="payment-method-confirmation">
                          <CheckCircle2 />

                          <span>
                            Direct Debit is active. No action is needed.
                          </span>
                        </div>
                      ) : isProcessing ? (
                        <div className="payment-method-processing">
                          <RefreshCw />

                          <span>
                            Setup is being confirmed automatically.
                          </span>
                        </div>
                      ) : (
                        <p className="payment-method-help">
                          The current mandate is {nice(
                            mandateStatus ||
                              "unknown",
                          )}. If it does not update shortly, contact the Madrasah administrator.
                        </p>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </section>

          <section className="portal-card parent-payment-card">
            <div className="parent-payment-card-head">
              <i>
                <CreditCard />
              </i>

              <div>
                <small>
                  One-time payment
                </small>

                <h3>
                  Pay by card
                </h3>

                <p>
                  You can make a one-time payment at any time, even when Direct Debit is active.
                </p>
              </div>
            </div>

            <PaymentMethodMarks />

            <div className="one-time-payment-note">
              <CheckCircle2 />

              <span>
                Paying an invoice by card does not cancel your Direct Debit.
              </span>
            </div>

            <button
              type="button"
              className="primary payment-choice-button"
              onClick={
                viewInvoices
              }
            >
              <ReceiptText />

              View invoices & pay
            </button>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="direct-debit-intro portal-card">
        <div>
          <small>
            Automatic fee collection
          </small>

          <h3>
            Direct Debit
          </h3>

          <p>
            See each student&apos;s mandate status here. The portal checks GoCardless automatically; Check status remains available as an administrator fallback.
          </p>
        </div>

        <Landmark />
      </div>

      {message && (
        <div
          className={`billing-inline-message ${message.type}`}
          role="status"
          aria-live="polite"
        >
          <span>
            {message.text}
          </span>

          <button
            type="button"
            aria-label="Dismiss Direct Debit message"
            onClick={() =>
              setMessage(
                null,
              )
            }
          >
            x
          </button>
        </div>
      )}

      <div className="table-wrap direct-debit-table">
        <table>
          <thead>
            <tr>
              <th>
                Student
              </th>

              <th>
                Monthly fee
              </th>

              <th>
                Preferred collection
              </th>

              <th>
                Direct Debit status
              </th>

              <th>
                Bank
              </th>

              <th>
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {displayRows.map(
              (
                row,
                index,
              ) => {
                const agreementId =
                  String(
                    row.id ??
                      index,
                  );

                const synced =
                  statuses[
                    agreementId
                  ];

                const collection =
                  String(
                    synced
                      ?.collectionMethod ??
                    row.collection_method ??
                      "online",
                  );

                const mandateStatus =
                  normaliseStatus(
                    synced
                      ?.mandateStatus ??
                      (
                        collection ===
                        "direct_debit"
                          ? "pending"
                          : "not_setup"
                      ),
                  );

                const canSetup =
                  String(
                    row.status ??
                      "",
                  ) ===
                    "active" &&
                  [
                    "not_setup",
                    "cancelled",
                    "failed",
                    "expired",
                    "blocked",
                    "consumed",
                    "inactive",
                  ].includes(
                    mandateStatus,
                  );

                const isBusy =
                  busyAgreement ===
                  agreementId;

                const bankSummary =
                  synced?.bankName
                    ? `${synced.bankName}${
                        synced.last4
                          ? `  -  **** ${synced.last4}`
                          : ""
                      }`
                    : synced?.last4
                      ? `**** ${synced.last4}`
                      : "-";

                return (
                  <tr
                    key={
                      agreementId
                    }
                  >
                    <td>
                      {row.student_id &&
                      openStudent ? (
                        <button
                          type="button"
                          className="student-link"
                          onClick={() =>
                            openStudent(
                              row.student_id,
                            )
                          }
                        >
                          {String(
                            row.student_name ??
                              "-",
                          )}
                        </button>
                      ) : (
                        <b>
                          {String(
                            row.student_name ??
                              "-",
                          )}
                        </b>
                      )}

                      <small
                        style={{
                          display:
                            "block",
                        }}
                      >
                        {String(
                          row.student_number ??
                            "",
                        )}
                      </small>
                    </td>

                    <td>
                      {money(
                        row.monthly_amount_pence,
                      )}
                    </td>

                    <td>
                      {nice(
                        collection,
                      )}
                    </td>

                    <td>
                      <em
                        className={`status ${mandateStatus}`}
                      >
                        {mandateStatus ===
                        "not_setup"
                          ? "Not set up"
                          : nice(
                              mandateStatus,
                            )}
                      </em>
                    </td>

                    <td>
                      {bankSummary}
                    </td>

                    <td>
                      <div className="direct-debit-actions">
                        {canSetup && (
                          <button
                            type="button"
                            className="row-action"
                            disabled={
                              isBusy
                            }
                            onClick={() =>
                              setupDirectDebit(
                                row,
                              )
                            }
                          >
                            {isBusy
                              ? "Opening..."
                              : mandateStatus ===
                                  "not_setup"
                                ? "Set up Direct Debit"
                                : "Set up new Direct Debit"}
                          </button>
                        )}

                        <button
                          type="button"
                          className="row-action secondary-action"
                          disabled={
                            isBusy
                          }
                          onClick={() =>
                            syncDirectDebit(
                              row,
                              {
                                force: true,
                              },
                            )
                          }
                        >
                          {isBusy
                            ? "Checking..."
                            : "Check status"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FeePlanTable({
  rows,
}: {
  rows: Row[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              Plan
            </th>

            <th>
              Frequency
            </th>

            <th>
              Amount
            </th>

            <th>
              Currency
            </th>

            <th>
              Agreements
            </th>

            <th>
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              index,
            ) => (
              <tr
                key={String(
                  row.id ??
                    index,
                )}
              >
                <td>
                  {String(
                    row.name ??
                      "-",
                  )}
                </td>

                <td>
                  {nice(
                    String(
                      row.frequency ??
                        "-",
                    ),
                  )}
                </td>

                <td>
                  {money(
                    row.amount_pence,
                  )}
                </td>

                <td>
                  {String(
                    row.currency ??
                      "GBP",
                  )}
                </td>

                <td>
                  {String(
                    row.active_agreements ??
                      0,
                  )}
                </td>

                <td>
                  <em
                    className={`status ${
                      Number(
                        row.active,
                      ) === 1
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    {Number(
                      row.active,
                    ) === 1
                      ? "Active"
                      : "Inactive"}
                  </em>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function AgreementTable({
  rows,
  openStudent,
}: {
  rows: Row[];
  openStudent?:
    (studentId: unknown) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              Student
            </th>

            <th>
              Plan
            </th>

            <th>
              Monthly fee
            </th>

            <th>
              Discount
            </th>

            <th>
              Billing day
            </th>

            <th>
              Collection
            </th>

            <th>
              Start
            </th>

            <th>
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              index,
            ) => (
              <tr
                key={String(
                  row.id ??
                    index,
                )}
              >
                <td>
                  {row.student_id &&
                  openStudent ? (
                    <button
                      type="button"
                      className="student-link"
                      onClick={() =>
                        openStudent(
                          row.student_id,
                        )
                      }
                    >
                      {String(
                        row.student_name ??
                          "-",
                      )}
                    </button>
                  ) : (
                    <b>
                      {String(
                        row.student_name ??
                          "-",
                      )}
                    </b>
                  )}

                  <small
                    style={{
                      display:
                        "block",
                    }}
                  >
                    {String(
                      row.student_number ??
                        "",
                    )}
                  </small>
                </td>

                <td>
                  {String(
                    row.fee_plan_name ??
                      "-",
                  )}
                </td>

                <td>
                  {money(
                    row.monthly_amount_pence,
                  )}
                </td>

                <td>
                  {money(
                    row.discount_pence,
                  )}
                </td>

                <td>
                  {String(
                    row.billing_day ??
                      "-",
                  )}
                </td>

                <td>
                  {nice(
                    String(
                      row.collection_method ??
                        "-",
                    ),
                  )}
                </td>

                <td>
                  {dateValue(
                    row.starts_on,
                  )}
                </td>

                <td>
                  <em
                    className={`status ${String(
                      row.status ??
                        "",
                    )}`}
                  >
                    {nice(
                      String(
                        row.status ??
                          "-",
                      ),
                    )}
                  </em>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTable({
  rows,
  students = [],
  parent,
  canRecordCash,
  refresh,
  openStudent,
}: {
  rows: Row[];
  students?: Row[];
  parent: boolean;
  canRecordCash: boolean;
  refresh: () => void;
  openStudent?:
    (studentId: unknown) => void;
}) {
  const [
    paymentMessage,
    setPaymentMessage,
  ] =
    useState("");

  const [
    cashRow,
    setCashRow,
  ] =
    useState<Row | null>(
      null,
    );

  const [
    cashBusy,
    setCashBusy,
  ] =
    useState(false);

  const [
    cashError,
    setCashError,
  ] =
    useState("");

  const [
    invoiceSearch,
    setInvoiceSearch,
  ] =
    useState("");

  const [
    invoiceStatusFilter,
    setInvoiceStatusFilter,
  ] =
    useState("all");

  const [
    invoiceTypeFilter,
    setInvoiceTypeFilter,
  ] =
    useState("all");

  async function payNow(
    row: Row,
  ) {
    setPaymentMessage(
      "Opening secure payment checkout...",
    );

    try {
      const response =
        await fetch(
          "/api/payments/stripe/checkout",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                invoiceId:
                  row.id,
              }),
          },
        );

      const result =
        (await response.json()) as {
          url?: string;
          sessionId?: string;
          error?: string;
        };

      if (
        !response.ok
      ) {
        setPaymentMessage(
          friendlyPaymentError(
            result.error,
            "card",
          ),
        );

        return;
      }

      if (
        !result.url
      ) {
        setPaymentMessage(
          "Card payment is temporarily unavailable. Please try again later. If the problem continues, contact the Madrasah administrator.",
        );

        return;
      }

      window.location.assign(
        result.url,
      );
    }
    catch {
      setPaymentMessage(
        "Card payment is temporarily unavailable. Please check your connection and try again. If the problem continues, contact the Madrasah administrator.",
      );
    }
  }

  async function recordCashPayment(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !cashRow
    ) {
      return;
    }

    setCashBusy(
      true,
    );

    setCashError(
      "",
    );

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const response =
        await fetch(
          "/api/v1/billing/manual-payment",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                invoiceId:
                  cashRow.id,

                paymentDate:
                  formData.get(
                    "paymentDate",
                  ),

                note:
                  formData.get(
                    "note",
                  ),
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
          receiptNumber?: string;
        };

      if (
        !response.ok
      ) {
        setCashError(
          result.error ??
            "Unable to record cash payment.",
        );

        return;
      }

      setCashRow(
        null,
      );

      setPaymentMessage(
        result.receiptNumber
          ? `Cash payment recorded successfully. Receipt ${result.receiptNumber}.`
          : "Cash payment recorded successfully.",
      );

      refresh();
    }
    catch {
      setCashError(
        "Unable to connect to the server.",
      );
    }
    finally {
      setCashBusy(
        false,
      );
    }
  }

  const groupedRows =
    useMemo(
      () => {
        type InvoiceGroup = {
          key: string;
          studentId: unknown;
          studentName: unknown;
          studentNumber: unknown;
          billingYear: unknown;
          billingMonth: unknown;
          dueDate: unknown;
          monthly: Row | null;
          books: Row | null;
          others: Row[];
        };

        const groups =
          new Map<
            string,
            InvoiceGroup
          >();

        const current =
          new Date();

        const currentYear =
          current.getFullYear();

        const currentMonth =
          current.getMonth() +
          1;

        /*
         * Seed the table with every active student. If an invoice for the
         * current month exists, the invoice loop below merges into this row.
         * Otherwise the student remains visible as "Not invoiced".
         */
        for (
          const student of
            students
        ) {
          const studentId =
            String(
              student.id ??
                "",
            ).trim();

          if (
            !studentId
          ) {
            continue;
          }

          const key =
            [
              studentId,
              String(
                currentYear,
              ),
              String(
                currentMonth,
              ),
            ].join(
              "|",
            );

          groups.set(
            key,
            {
              key,
              studentId,
              studentName:
                student.name ??
                `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
              studentNumber:
                student.student_number,
              billingYear:
                currentYear,
              billingMonth:
                currentMonth,
              dueDate:
                null,
              monthly:
                null,
              books:
                null,
              others: [],
            },
          );
        }

        for (
          const row of
            rows
        ) {
          const feeType =
            String(
              row.fee_type ??
                "madrasah",
            );

          const isCoreFee =
            feeType ===
              "madrasah" ||
            feeType ===
              "books";

          if (
            !isCoreFee
          ) {
            const otherKey =
              `other-${String(row.id ?? crypto.randomUUID())}`;

            groups.set(
              otherKey,
              {
                key:
                  otherKey,
                studentId:
                  row.student_id,
                studentName:
                  row.student_name,
                studentNumber:
                  row.student_number,
                billingYear:
                  row.billing_year,
                billingMonth:
                  row.billing_month,
                dueDate:
                  row.due_date,
                monthly:
                  null,
                books:
                  null,
                others: [
                  row,
                ],
              },
            );

            continue;
          }

          const key =
            [
              String(
                row.student_id ??
                  row.student_number ??
                  "student",
              ),
              String(
                row.billing_year ??
                  "",
              ),
              String(
                row.billing_month ??
                  "",
              ),
            ].join(
              "|",
            );

          const current =
            groups.get(
              key,
            ) ?? {
              key,
              studentId:
                row.student_id,
              studentName:
                row.student_name,
              studentNumber:
                row.student_number,
              billingYear:
                row.billing_year,
              billingMonth:
                row.billing_month,
              dueDate:
                row.due_date,
              monthly:
                null,
              books:
                null,
              others: [],
            };

          if (
            feeType ===
            "books"
          ) {
            current.books =
              row;
          }
          else {
            current.monthly =
              row;
          }

          if (
            String(
              row.due_date ??
                "",
            ) <
            String(
              current.dueDate ??
                "9999-12-31",
            )
          ) {
            current.dueDate =
              row.due_date;
          }

          groups.set(
            key,
            current,
          );
        }

        return Array.from(
          groups.values(),
        );
      },
      [
        rows,
        students,
      ],
    );

  function invoiceBalance(
    row:
      Row |
      null,
  ) {
    return row
      ? Number(
          row.balance_pence ??
            0,
        )
      : 0;
  }

  function invoicePaid(
    row:
      Row |
      null,
  ) {
    return row
      ? Number(
          row.amount_paid_pence ??
            0,
        )
      : 0;
  }

  function invoiceDue(
    row:
      Row |
      null,
  ) {
    return row
      ? Number(
          row.amount_due_pence ??
            0,
        )
      : 0;
  }

  function invoicePayable(
    row:
      Row |
      null,
  ) {
    if (
      !row
    ) {
      return false;
    }

    const status =
      String(
        row.status ??
          "",
      );

    return (
      invoiceBalance(
        row,
      ) > 0 &&
      ![
        "paid",
        "cancelled",
        "waived",
      ].includes(
        status,
      )
    );
  }

  const filteredGroupedRows =
    useMemo(
      () => {
        const query =
          invoiceSearch
            .trim()
            .toLowerCase();

        return groupedRows.filter(
          (group) => {
            const totalPaid =
              invoicePaid(
                group.monthly,
              ) +
              invoicePaid(
                group.books,
              ) +
              group.others.reduce(
                (
                  total,
                  row,
                ) =>
                  total +
                  invoicePaid(
                    row,
                  ),
                0,
              );

            const totalBalance =
              invoiceBalance(
                group.monthly,
              ) +
              invoiceBalance(
                group.books,
              ) +
              group.others.reduce(
                (
                  total,
                  row,
                ) =>
                  total +
                  invoiceBalance(
                    row,
                  ),
                0,
              );

            const hasInvoice =
              Boolean(
                group.monthly ||
                group.books ||
                group.others.length,
              );

            const status =
              !hasInvoice
                ? "not_invoiced"
                : totalBalance <=
                    0
                  ? "paid"
                  : totalPaid >
                      0
                    ? "part_paid"
                    : "pending";

            const matchesSearch =
              !query ||
              String(
                group.studentName ??
                  "",
              )
                .toLowerCase()
                .includes(
                  query,
                ) ||
              String(
                group.studentNumber ??
                  "",
              )
                .toLowerCase()
                .includes(
                  query,
                );

            const matchesStatus =
              invoiceStatusFilter ===
                "all" ||
              status ===
                invoiceStatusFilter;

            let matchesType =
              true;

            if (
              invoiceTypeFilter ===
              "monthly"
            ) {
              matchesType =
                Boolean(
                  group.monthly,
                );
            }
            else if (
              invoiceTypeFilter ===
              "books"
            ) {
              matchesType =
                Boolean(
                  group.books,
                );
            }
            else if (
              invoiceTypeFilter ===
              "outstanding"
            ) {
              matchesType =
                totalBalance >
                0;
            }

            return (
              matchesSearch &&
              matchesStatus &&
              matchesType
            );
          },
        );
      },
      [
        groupedRows,
        invoiceSearch,
        invoiceStatusFilter,
        invoiceTypeFilter,
      ],
    );

  function generatePaymentStatusReport() {
    const rowsForReport =
      groupedRows.map(
        (group) => {
          const monthlyDue =
            invoiceDue(
              group.monthly,
            );

          const monthlyPaid =
            invoicePaid(
              group.monthly,
            );

          const monthlyBalance =
            invoiceBalance(
              group.monthly,
            );

          const booksDue =
            invoiceDue(
              group.books,
            );

          const booksPaid =
            invoicePaid(
              group.books,
            );

          const booksBalance =
            invoiceBalance(
              group.books,
            );

          const otherDue =
            group.others.reduce(
              (
                total,
                row,
              ) =>
                total +
                invoiceDue(
                  row,
                ),
              0,
            );

          const otherPaid =
            group.others.reduce(
              (
                total,
                row,
              ) =>
                total +
                invoicePaid(
                  row,
                ),
              0,
            );

          const otherBalance =
            group.others.reduce(
              (
                total,
                row,
              ) =>
                total +
                invoiceBalance(
                  row,
                ),
              0,
            );

          const totalDue =
            monthlyDue +
            booksDue +
            otherDue;

          const totalPaid =
            monthlyPaid +
            booksPaid +
            otherPaid;

          const totalBalance =
            monthlyBalance +
            booksBalance +
            otherBalance;

          const hasInvoice =
            Boolean(
              group.monthly ||
              group.books ||
              group.others.length,
            );

          const status =
            !hasInvoice
              ? "Not invoiced"
              : totalBalance <=
                  0
                ? "Paid"
                : totalPaid >
                    0
                  ? "Part paid"
                  : "Pending / unpaid";

          const monthLabel =
            group.billingYear &&
            group.billingMonth
              ? new Date(
                  Number(
                    group.billingYear,
                  ),
                  Number(
                    group.billingMonth,
                  ) -
                    1,
                  1,
                ).toLocaleDateString(
                  "en-GB",
                  {
                    month:
                      "long",
                    year:
                      "numeric",
                  },
                )
              : "";

          return {
            studentNumber:
              String(
                group.studentNumber ??
                  "",
              ),
            studentName:
              String(
                group.studentName ??
                  "",
              ),
            month:
              monthLabel,
            monthlyDue,
            monthlyPaid,
            monthlyBalance,
            booksDue,
            booksPaid,
            booksBalance,
            totalDue,
            totalPaid,
            totalBalance,
            status,
          };
        },
      );

    const totals =
      rowsForReport.reduce(
        (
          summary,
          row,
        ) => {
          summary.monthlyDue +=
            row.monthlyDue;
          summary.monthlyPaid +=
            row.monthlyPaid;
          summary.monthlyBalance +=
            row.monthlyBalance;
          summary.booksDue +=
            row.booksDue;
          summary.booksPaid +=
            row.booksPaid;
          summary.booksBalance +=
            row.booksBalance;
          summary.totalDue +=
            row.totalDue;
          summary.totalPaid +=
            row.totalPaid;
          summary.totalBalance +=
            row.totalBalance;

          if (
            row.status ===
            "Paid"
          ) {
            summary.paid +=
              1;
          }
          else if (
            row.status ===
            "Part paid"
          ) {
            summary.partPaid +=
              1;
          }
          else if (
            row.status ===
            "Not invoiced"
          ) {
            summary.notInvoiced +=
              1;
          }
          else {
            summary.unpaid +=
              1;
          }

          return summary;
        },
        {
          monthlyDue:
            0,
          monthlyPaid:
            0,
          monthlyBalance:
            0,
          booksDue:
            0,
          booksPaid:
            0,
          booksBalance:
            0,
          totalDue:
            0,
          totalPaid:
            0,
          totalBalance:
            0,
          paid:
            0,
          partPaid:
            0,
          unpaid:
            0,
          notInvoiced:
            0,
        },
      );

    const moneyValue =
      (
        value:
          number,
      ) =>
        (
          value /
          100
        ).toFixed(
          2,
        );

    const generatedAt =
      new Date();

    const csvRows:
      unknown[][] =
      [
        [
          "BNMC MADRASAH PAYMENT STATUS REPORT",
        ],
        [
          "Generated",
          generatedAt.toLocaleString(
            "en-GB",
          ),
        ],
        [
          "Total students",
          rowsForReport.length,
        ],
        [
          "Paid",
          totals.paid,
          "Part paid",
          totals.partPaid,
          "Pending / unpaid",
          totals.unpaid,
          "Not invoiced",
          totals.notInvoiced,
        ],
        [
          "Total expected",
          moneyValue(
            totals.totalDue,
          ),
          "Total received",
          moneyValue(
            totals.totalPaid,
          ),
          "Total outstanding",
          moneyValue(
            totals.totalBalance,
          ),
        ],
        [],
        [
          "Student number",
          "Student name",
          "Month",
          "Monthly fee expected (£)",
          "Monthly fee paid (£)",
          "Monthly fee balance (£)",
          "Books fee expected (£)",
          "Books fee paid (£)",
          "Books fee balance (£)",
          "Total expected (£)",
          "Total paid (£)",
          "Total balance (£)",
          "Payment status",
        ],
        ...rowsForReport.map(
          (
            row,
          ) => [
            row.studentNumber,
            row.studentName,
            row.month,
            moneyValue(
              row.monthlyDue,
            ),
            moneyValue(
              row.monthlyPaid,
            ),
            moneyValue(
              row.monthlyBalance,
            ),
            moneyValue(
              row.booksDue,
            ),
            moneyValue(
              row.booksPaid,
            ),
            moneyValue(
              row.booksBalance,
            ),
            moneyValue(
              row.totalDue,
            ),
            moneyValue(
              row.totalPaid,
            ),
            moneyValue(
              row.totalBalance,
            ),
            row.status,
          ],
        ),
      ];

    const escapeCsv =
      (
        value:
          unknown,
      ) =>
        `"${String(
          value ??
            "",
        ).replaceAll(
          '"',
          '""',
        )}"`;

    const csv =
      csvRows
        .map(
          (
            row,
          ) =>
            row
              .map(
                escapeCsv,
              )
              .join(
                ",",
              ),
        )
        .join(
          "\r\n",
        );

    const blob =
      new Blob(
        [
          "\uFEFF",
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const link =
      document.createElement(
        "a",
      );

    const stamp =
      generatedAt
        .toISOString()
        .slice(
          0,
          10,
        );

    link.href =
      url;

    link.download =
      `BNMC-payment-status-report-${stamp}.csv`;

    document.body.appendChild(
      link,
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url,
    );
  }

  return (
    <>
      {paymentMessage && (
        <div className="portal-success">
          {paymentMessage}
        </div>
      )}

      <div className="invoice-filter-bar">
        <div className="invoice-search-wrap">
          <Search />

          <input
            type="search"
            value={
              invoiceSearch
            }
            onChange={(event) =>
              setInvoiceSearch(
                event.target.value,
              )
            }
            placeholder="Search by student name or number..."
          />
        </div>

        <select
          value={
            invoiceStatusFilter
          }
          onChange={(event) =>
            setInvoiceStatusFilter(
              event.target.value,
            )
          }
        >
          <option value="all">
            All statuses
          </option>

          <option value="pending">
            Pending / unpaid
          </option>

          <option value="part_paid">
            Part paid
          </option>

          <option value="paid">
            Paid
          </option>

          <option value="not_invoiced">
            Not invoiced
          </option>
        </select>

        <select
          value={
            invoiceTypeFilter
          }
          onChange={(event) =>
            setInvoiceTypeFilter(
              event.target.value,
            )
          }
        >
          <option value="all">
            All fees
          </option>

          <option value="monthly">
            Monthly fee
          </option>

          <option value="books">
            Books fee
          </option>

          <option value="outstanding">
            Outstanding only
          </option>
        </select>

        {(invoiceSearch ||
          invoiceStatusFilter !==
            "all" ||
          invoiceTypeFilter !==
            "all") && (
          <button
            type="button"
            onClick={() => {
              setInvoiceSearch(
                "",
              );
              setInvoiceStatusFilter(
                "all",
              );
              setInvoiceTypeFilter(
                "all",
              );
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="invoice-filter-summary-row">
        <div className="invoice-filter-summary">
          Showing{" "}
          <strong>
            {
              filteredGroupedRows.length
            }
          </strong>{" "}
          of{" "}
          <strong>
            {
              groupedRows.length
            }
          </strong>{" "}
          student fee records
        </div>

        <button
          type="button"
          className="payment-status-report-button"
          onClick={
            generatePaymentStatusReport
          }
          disabled={
            groupedRows.length ===
            0
          }
        >
          <Download />
          Generate payment report
        </button>
      </div>

      <div className="table-wrap combined-fee-table-wrap">
        <table className="combined-fee-table">
          <thead>
            <tr>
              <th>
                Student
              </th>

              <th>
                Month
              </th>

              <th>
                Monthly fee
              </th>

              <th>
                Books fee
              </th>

              <th>
                Total
              </th>

              <th>
                Paid
              </th>

              <th>
                Balance
              </th>

              <th>
                Status
              </th>

              <th>
                Payment
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredGroupedRows.map(
              (
                group,
              ) => {
                const monthlyDue =
                  invoiceDue(
                    group.monthly,
                  );

                const booksDue =
                  invoiceDue(
                    group.books,
                  );

                const otherDue =
                  group.others.reduce(
                    (
                      total,
                      row,
                    ) =>
                      total +
                      invoiceDue(
                        row,
                      ),
                    0,
                  );

                const totalDue =
                  monthlyDue +
                  booksDue +
                  otherDue;

                const totalPaid =
                  invoicePaid(
                    group.monthly,
                  ) +
                  invoicePaid(
                    group.books,
                  ) +
                  group.others.reduce(
                    (
                      total,
                      row,
                    ) =>
                      total +
                      invoicePaid(
                        row,
                      ),
                    0,
                  );

                const totalBalance =
                  invoiceBalance(
                    group.monthly,
                  ) +
                  invoiceBalance(
                    group.books,
                  ) +
                  group.others.reduce(
                    (
                      total,
                      row,
                    ) =>
                      total +
                      invoiceBalance(
                        row,
                      ),
                    0,
                  );

                const hasInvoice =
                  Boolean(
                    group.monthly ||
                    group.books ||
                    group.others.length,
                  );

                const combinedStatus =
                  !hasInvoice
                    ? "not_invoiced"
                    : totalBalance <=
                        0
                      ? "paid"
                      : totalPaid >
                          0
                        ? "part_paid"
                        : "pending";

                const paymentRows =
                  [
                    group.monthly,
                    group.books,
                    ...group.others,
                  ].filter(
                    (
                      row,
                    ): row is Row =>
                      Boolean(
                        row,
                      ),
                  );

                return (
                  <tr
                    key={
                      group.key
                    }
                  >
                    <td>
                      {group.studentId &&
                      openStudent ? (
                        <button
                          type="button"
                          className="student-link"
                          onClick={() =>
                            openStudent(
                              group.studentId,
                            )
                          }
                        >
                          {String(
                            group.studentName ??
                              "-",
                          )}
                        </button>
                      ) : (
                        <b>
                          {String(
                            group.studentName ??
                              "-",
                          )}
                        </b>
                      )}

                      <small
                        style={{
                          display:
                            "block",
                        }}
                      >
                        {String(
                          group.studentNumber ??
                            "",
                        )}
                      </small>
                    </td>

                    <td>
                      {group.billingYear &&
                      group.billingMonth ? (
                        new Date(
                          Number(
                            group.billingYear,
                          ),
                          Number(
                            group.billingMonth,
                          ) -
                            1,
                          1,
                        ).toLocaleDateString(
                          "en-GB",
                          {
                            month:
                              "short",
                            year:
                              "numeric",
                          },
                        )
                      ) : (
                        dateValue(
                          group.dueDate,
                        )
                      )}
                    </td>

                    <td>
                      {group.monthly ? (
                        <span className="combined-fee-cell">
                          <b>
                            {money(
                              monthlyDue,
                            )}
                          </b>

                          <small>
                            Paid {money(invoicePaid(group.monthly))}
                          </small>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      {group.books ? (
                        <span className="combined-fee-cell">
                          <b>
                            {money(
                              booksDue,
                            )}
                          </b>

                          <small>
                            Paid {money(invoicePaid(group.books))}
                          </small>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      <b>
                        {money(
                          totalDue,
                        )}
                      </b>
                    </td>

                    <td>
                      {money(
                        totalPaid,
                      )}
                    </td>

                    <td>
                      <b>
                        {money(
                          totalBalance,
                        )}
                      </b>
                    </td>

                    <td>
                      <em
                        className={`status ${combinedStatus}`}
                      >
                        {combinedStatus ===
                        "part_paid"
                          ? "Part paid"
                          : combinedStatus ===
                              "not_invoiced"
                            ? "Not invoiced"
                            : nice(
                                combinedStatus,
                              )}
                      </em>
                    </td>

                    <td>
                      <div className="combined-invoice-actions">
                        {paymentRows.map(
                          (
                            row,
                          ) => {
                            if (
                              !invoicePayable(
                                row,
                              )
                            ) {
                              return null;
                            }

                            const feeLabel =
                              String(
                                row.fee_type ??
                                  "madrasah",
                              ) ===
                              "books"
                                ? "Books"
                                : "Monthly";

                            return (
                              <div
                                key={String(
                                  row.id,
                                )}
                                className="combined-invoice-action-group"
                              >
                                <small>
                                  {feeLabel}
                                </small>

                                <button
                                  className="row-action"
                                  onClick={() =>
                                    payNow(
                                      row,
                                    )
                                  }
                                >
                                  {parent
                                    ? "Pay"
                                    : "Payment link"}
                                </button>

                                {canRecordCash && (
                                  <button
                                    type="button"
                                    className="row-action cash-action"
                                    onClick={() => {
                                      setCashError(
                                        "",
                                      );

                                      setCashRow(
                                        row,
                                      );
                                    }}
                                  >
                                    Cash paid
                                  </button>
                                )}
                              </div>
                            );
                          },
                        )}

                        {totalBalance <=
                          0 && (
                          <span>
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      {cashRow && (
        <div className="modal">
          <form
            className="cash-payment-form"
            onSubmit={
              recordCashPayment
            }
          >
            <header>
              <div>
                <small>
                  Manual payment
                </small>

                <h2>
                  Record cash payment
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCashRow(
                    null,
                  )
                }
                disabled={
                  cashBusy
                }
              >
                <X />
              </button>
            </header>

            <div className="cash-payment-summary">
              <span>
                <small>
                  Student
                </small>

                <b>
                  {String(
                    cashRow.student_name ??
                      "-",
                  )}
                </b>
              </span>

              <span>
                <small>
                  Invoice
                </small>

                <b>
                  {String(
                    cashRow.description ??
                      "-",
                  )}
                </b>
              </span>

              <span>
                <small>
                  Cash amount
                </small>

                <strong>
                  {money(
                    cashRow.balance_pence,
                  )}
                </strong>
              </span>
            </div>

            <p className="cash-payment-note">
              This records the full outstanding balance as a cash payment and marks the invoice paid. A payment transaction, allocation, receipt and audit record will be created.
            </p>

            <div className="form-grid">
              <label>
                Payment date

                <input
                  name="paymentDate"
                  type="date"
                  defaultValue={
                    new Date()
                      .toISOString()
                      .slice(
                        0,
                        10,
                      )
                  }
                  required
                />
              </label>

              <label>
                Note (optional)

                <input
                  name="note"
                  placeholder="e.g. Cash received at Madrasah"
                  maxLength={
                    200
                  }
                />
              </label>
            </div>

            {cashError && (
              <output>
                {
                  cashError
                }
              </output>
            )}

            <footer>
              <button
                type="button"
                onClick={() =>
                  setCashRow(
                    null,
                  )
                }
                disabled={
                  cashBusy
                }
              >
                Cancel
              </button>

              <button
                className="primary"
                disabled={
                  cashBusy
                }
              >
                {cashBusy
                  ? "Recording..."
                  : `Confirm ${money(cashRow.balance_pence)} cash payment`}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function FeePlanForm({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [
    error,
    setError,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(
      true,
    );

    setError("");

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const payload =
        Object.fromEntries(
          formData.entries(),
        );

      const response =
        await fetch(
          "/api/v1/billing",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  action:
                    "create-plan",

                  ...payload,
                },
              ),
          },
        );

      const result =
        (await response.json()) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to create fee plan",
        );

        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="modal">
      <form
        onSubmit={
          submit
        }
      >
        <header>
          <div>
            <small>
              Billing setup
            </small>

            <h2>
              New fee plan
            </h2>
          </div>

          <button
            type="button"
            onClick={
              close
            }
          >
            <X />
          </button>
        </header>

        <div className="form-grid">
          <label>
            Plan name

            <input
              name="name"
              required
              placeholder="Standard Monthly Fee"
            />
          </label>

          <label>
            Frequency

            <select
              name="frequency"
              required
              defaultValue="monthly"
            >
              <option value="monthly">
                Monthly
              </option>

              <option value="termly">
                Termly
              </option>

              <option value="annual">
                Annual
              </option>

              <option value="one_off">
                One-off
              </option>
            </select>
          </label>

          <label>
            Amount in pence

            <input
              name="amountPence"
              type="number"
              min="1"
              required
              placeholder="4000"
            />
          </label>

          <label>
            Currency

            <select
              name="currency"
              required
              defaultValue="GBP"
            >
              <option value="GBP">
                GBP (&pound;)
              </option>
            </select>
          </label>
        </div>

        {error && (
          <output>
            {error}
          </output>
        )}

        <footer>
          <button
            type="button"
            onClick={
              close
            }
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy
            }
          >
            {busy
              ? "Creating..."
              : "Create plan"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function AgreementForm({
  students,
  plans,
  close,
  saved,
}: {
  students: Row[];
  plans: Row[];
  close: () => void;
  saved: () => void;
}) {
  const [
    error,
    setError,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(
      true,
    );

    setError("");

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const payload =
        Object.fromEntries(
          formData.entries(),
        );

      const response =
        await fetch(
          "/api/v1/billing",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  action:
                    "create-agreement",

                  ...payload,
                },
              ),
          },
        );

      const result =
        (await response.json()) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to create agreement",
        );

        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="modal">
      <form
        onSubmit={
          submit
        }
      >
        <header>
          <div>
            <small>
              Student billing
            </small>

            <h2>
              New fee agreement
            </h2>
          </div>

          <button
            type="button"
            onClick={
              close
            }
          >
            <X />
          </button>
        </header>

        <div className="form-grid">
          <label>
            Student

            <select
              name="studentId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Select active student
              </option>

              {students.map(
                (student) => (
                  <option
                    key={String(
                      student.id,
                    )}
                    value={String(
                      student.id,
                    )}
                  >
                    {String(
                      student.name ??
                        `${student.first_name ?? ""} ${student.last_name ?? ""}`,
                    )}

                    {"  -  "}

                    {String(
                      student.student_number ??
                        "",
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Fee plan

            <select
              name="feePlanId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Select fee plan
              </option>

              {plans.map(
                (plan) => (
                  <option
                    key={String(
                      plan.id,
                    )}
                    value={String(
                      plan.id,
                    )}
                  >
                    {String(
                      plan.name,
                    )}

                    {"  -  "}

                    {money(
                      plan.amount_pence,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Monthly amount in pence

            <input
              name="monthlyAmountPence"
              type="number"
              min="1"
              placeholder="Leave blank to use plan amount"
            />
          </label>

          <label>
            Discount in pence

            <input
              name="discountPence"
              type="number"
              min="0"
              defaultValue="0"
            />
          </label>

          <label>
            Billing day

            <input
              name="billingDay"
              type="number"
              min="1"
              max="28"
              defaultValue="1"
              required
            />
          </label>

          <label>
            Start date

            <input
              name="startsOn"
              type="date"
              required
            />
          </label>

          <label>
            End date

            <input
              name="endsOn"
              type="date"
            />
          </label>

          <label>
            Collection method

            <select
              name="collectionMethod"
              defaultValue="online"
              required
            >
              <option value="online">
                Online payment
              </option>

              <option value="direct_debit">
                Direct Debit
              </option>
            </select>
          </label>
        </div>

        {error && (
          <output>
            {error}
          </output>
        )}

        <footer>
          <button
            type="button"
            onClick={
              close
            }
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy
            }
          >
            {busy
              ? "Creating..."
              : "Create agreement"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function MonthlyInvoiceForm({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] =
    useState("");
  const [busy, setBusy] =
    useState(false);
  const [result, setResult] =
    useState<{
      created: number;
      skipped: number;
      agreementsCreated: number;
    } | null>(null);

  const today = new Date();

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const response =
        await fetch(
          "/api/v1/billing",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              action:
                "generate-monthly-invoices",
              ...Object.fromEntries(
                formData.entries(),
              ),
            }),
          },
        );

      const data =
        (await response.json()) as {
          created?: number;
          skipped?: number;
          agreementsCreated?: number;
          error?: string;
        };

      if (!response.ok) {
        setError(
          data.error ??
            "Unable to generate monthly invoices",
        );
        return;
      }

      setResult({
        created: Number(
          data.created ?? 0,
        ),
        skipped: Number(
          data.skipped ?? 0,
        ),
        agreementsCreated: Number(
          data.agreementsCreated ?? 0,
        ),
      });
      saved();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>
              One-click billing
            </small>
            <h2>
              Generate monthly invoices
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
          >
            <X />
          </button>
        </header>

        <p>
          Every active enrolled student will be charged £30. Missing fee agreements are created automatically and existing invoices are skipped.
        </p>

        <div className="form-grid">
          <label>
            Billing month
            <select
              name="billingMonth"
              defaultValue={String(
                today.getMonth() + 1,
              )}
              required
            >
              {[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ].map((month, index) => (
                <option
                  key={month}
                  value={String(index + 1)}
                >
                  {month}
                </option>
              ))}
            </select>
          </label>

          <label>
            Billing year
            <input
              name="billingYear"
              type="number"
              min="2020"
              max="2100"
              defaultValue={
                today.getFullYear()
              }
              required
            />
          </label>
        </div>

        {error && <output>{error}</output>}

        {result && (
          <output>
            Created {result.created} invoice(s). Skipped {result.skipped} existing or ineligible record(s).
            {result.agreementsCreated > 0
              ? ` ${result.agreementsCreated} missing fee agreement(s) were added automatically.`
              : ""}
          </output>
        )}

        <footer>
          <button
            type="button"
            onClick={close}
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              className="primary"
              disabled={busy}
            >
              {busy
                ? "Generating..."
                : "Generate all invoices"}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

function InvoiceForm({
  agreements,
  close,
  saved,
}: {
  agreements: Row[];
  close: () => void;
  saved: () => void;
}) {
  const [
    error,
    setError,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const today =
    new Date();

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(
      true,
    );

    setError("");

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const payload =
        Object.fromEntries(
          formData.entries(),
        );

      const response =
        await fetch(
          "/api/v1/billing",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  action:
                    "generate-invoice",

                  ...payload,
                },
              ),
          },
        );

      const result =
        (await response.json()) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to generate invoice",
        );

        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="modal">
      <form
        onSubmit={
          submit
        }
      >
        <header>
          <div>
            <small>
              Monthly billing
            </small>

            <h2>
              Generate invoice
            </h2>
          </div>

          <button
            type="button"
            onClick={
              close
            }
          >
            <X />
          </button>
        </header>

        <div className="form-grid">
          <label>
            Student agreement

            <select
              name="agreementId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Select active agreement
              </option>

              {agreements.map(
                (agreement) => (
                  <option
                    key={String(
                      agreement.id,
                    )}
                    value={String(
                      agreement.id,
                    )}
                  >
                    {String(
                      agreement.student_name ??
                        "Student",
                    )}

                    {"  -  "}

                    {String(
                      agreement.fee_plan_name ??
                        "Fee plan",
                    )}

                    {"  -  "}

                    {money(
                      agreement.monthly_amount_pence,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Billing month

            <select
              name="billingMonth"
              defaultValue={String(
                today.getMonth() +
                  1,
              )}
              required
            >
              {[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ].map(
                (
                  month,
                  index,
                ) => (
                  <option
                    key={
                      month
                    }
                    value={String(
                      index +
                        1,
                    )}
                  >
                    {month}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Billing year

            <input
              name="billingYear"
              type="number"
              min="2020"
              max="2100"
              defaultValue={
                today.getFullYear()
              }
              required
            />
          </label>
        </div>

        {error && (
          <output>
            {error}
          </output>
        )}

        <footer>
          <button
            type="button"
            onClick={
              close
            }
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy
            }
          >
            {busy
              ? "Generating..."
              : "Generate invoice"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ManualStudentRegistrationForm({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [classes, setClasses] = useState<AdmissionClass[]>([]);
  const [guardians, setGuardians] = useState<Row[]>([]);
  const [guardianMode, setGuardianMode] = useState<"new" | "existing">("new");
  const [gender, setGender] = useState("");
  const [ethnicGroup, setEthnicGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    studentName: string;
    studentNumber: string;
    className: string;
    parentAccess?: {
      status?: "sent" | "existing" | "failed";
      message?: string;
    };
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        const [classResponse, guardianResponse] = await Promise.all([
          fetch("/api/v1/classes", { cache: "no-store" }),
          fetch("/api/v1/guardians", { cache: "no-store" }),
        ]);
        const classResult = (await classResponse.json()) as {
          data?: Row[];
          error?: string;
        };
        const guardianResult = (await guardianResponse.json()) as {
          data?: Row[];
          error?: string;
        };

        if (!classResponse.ok) {
          throw new Error(classResult.error ?? "Unable to load classes");
        }
        if (!guardianResponse.ok) {
          throw new Error(guardianResult.error ?? "Unable to load guardians");
        }
        if (!active) return;

        setClasses(
          (classResult.data ?? [])
            .map((item) => ({
              id: String(item.id ?? ""),
              name: String(item.name ?? "Class"),
              enrolled: Number(item.enrolled ?? 0),
              capacity: Number(item.capacity ?? 0),
              status: String(item.status ?? ""),
            }))
            .filter((item) => item.id && item.status === "active"),
        );
        setGuardians(guardianResult.data ?? []);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to prepare the registration form",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const suitableClasses = classes.filter(
    (item) =>
      !gender || item.name.toLowerCase().includes(`(${gender.toLowerCase()})`),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    payload.guardianMode = guardianMode;
    payload.photoConsent = formData.has("photoConsent");
    payload.emergencyConsent = formData.has("emergencyConsent");

    try {
      const response = await fetch("/api/v1/manual-registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        studentName?: string;
        studentNumber?: string;
        className?: string;
        parentAccess?: {
          status?: "sent" | "existing" | "failed";
          message?: string;
        };
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to register the student");
        return;
      }

      setResult({
        studentName: String(data.studentName ?? "Student"),
        studentNumber: String(data.studentNumber ?? ""),
        className: String(data.className ?? ""),
        parentAccess: data.parentAccess,
      });
      saved();
    } catch {
      setError("Unable to connect to the registration service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal manual-registration-modal">
      <form onSubmit={submit}>
        <header>
          <div>
            <small>Exceptional admission</small>
            <h2>Register student manually</h2>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label="Close">
            <X />
          </button>
        </header>

        {result ? (
          <div className="manual-registration-success">
            <CheckCircle2 />
            <h3>{result.studentName} is registered</h3>
            <p>
              Student number <strong>{result.studentNumber}</strong>, enrolled in{" "}
              <strong>{result.className}</strong>, with the £30 monthly fee activated.
            </p>
            {result.parentAccess?.message && (
              <output className={result.parentAccess.status === "failed" ? "warning" : ""}>
                {result.parentAccess.message}
              </output>
            )}
          </div>
        ) : (
          <>
            <p className="manual-registration-intro">
              Use this only for a paper, walk-in or exceptional application. Completing it
              creates the student, guardian link, parent access, class enrolment and £30
              monthly fee in one step.
            </p>

            <fieldset>
              <legend>Student details</legend>
              <div className="form-grid">
                <label>
                  First name
                  <input name="firstName" required />
                </label>
                <label>
                  Last name
                  <input name="lastName" required />
                </label>
                <label>
                  Date of birth
                  <input name="dateOfBirth" type="date" required />
                </label>
                <label>
                  Gender
                  <select
                    name="gender"
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </label>
                <label>
                  Ethnic group
                  <select
                    name="ethnicGroup"
                    value={ethnicGroup}
                    onChange={(event) => setEthnicGroup(event.target.value)}
                    required
                  >
                    <option value="">Select ethnic group</option>
                    {[
                      "Hausa",
                      "Yoruba",
                      "Igbo",
                      "Edo",
                      "Kogi",
                      "Other",
                      "Prefer not to say",
                    ].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                {ethnicGroup === "Other" && (
                  <label>
                    Other ethnicity
                    <input name="otherEthnicity" required />
                  </label>
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend>Admission and class</legend>
              <div className="form-grid">
                <label>
                  Class
                  <select name="classId" required disabled={!gender || loading}>
                    <option value="">
                      {gender ? "Select an available class" : "Select gender first"}
                    </option>
                    {suitableClasses.map((item) => {
                      const full = item.enrolled >= item.capacity;
                      return (
                        <option key={item.id} value={item.id} disabled={full}>
                          {item.name} - {item.enrolled}/{item.capacity}{full ? " (Full)" : " places"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  Start date
                  <input
                    name="startsOn"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
                <label>
                  Previous learning level
                  <input name="priorLevel" placeholder="Optional" />
                </label>
                <label>
                  Session
                  <input value="Saturday 09:30-11:30" readOnly />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Parent or guardian</legend>
              <div className="guardian-choice" role="group" aria-label="Guardian option">
                <button
                  type="button"
                  className={guardianMode === "new" ? "active" : ""}
                  onClick={() => setGuardianMode("new")}
                >
                  Add new guardian
                </button>
                <button
                  type="button"
                  className={guardianMode === "existing" ? "active" : ""}
                  onClick={() => setGuardianMode("existing")}
                >
                  Select existing guardian
                </button>
              </div>

              {guardianMode === "existing" ? (
                <label>
                  Existing guardian
                  <select name="guardianId" required defaultValue="">
                    <option value="">Select guardian</option>
                    {guardians.map((guardian) => (
                      <option key={String(guardian.id)} value={String(guardian.id)}>
                        {String(guardian.full_name ?? "Guardian")} - {String(guardian.email ?? "")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="form-grid">
                  <label>
                    Full name
                    <input name="guardianName" required />
                  </label>
                  <label>
                    Relationship
                    <select name="relationship" required defaultValue="">
                      <option value="">Select relationship</option>
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label>
                    Email address
                    <input name="guardianEmail" type="email" required />
                  </label>
                  <label>
                    Phone number
                    <input name="guardianPhone" type="tel" required />
                  </label>
                  <label className="wide-field">
                    Home address
                    <input name="guardianAddress" required />
                  </label>
                  <label>
                    Postcode
                    <input name="guardianPostcode" required />
                  </label>
                  <label>
                    Emergency contact number
                    <input name="emergencyContactNumber" type="tel" required />
                  </label>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>Health, support and consent</legend>
              <div className="form-grid">
                <label>
                  Medical notes
                  <textarea name="medicalNotes" rows={3} placeholder="Enter none if not applicable" />
                </label>
                <label>
                  Allergies
                  <textarea name="allergyNotes" rows={3} placeholder="Enter none if not applicable" />
                </label>
                <label className="wide-field">
                  Additional needs
                  <textarea name="additionalNeeds" rows={3} placeholder="Enter none if not applicable" />
                </label>
              </div>
              <div className="consent-list">
                <label>
                  <input name="emergencyConsent" type="checkbox" required />
                  Guardian authorises emergency medical care when they cannot be contacted.
                </label>
                <label>
                  <input name="photoConsent" type="checkbox" />
                  Guardian gives permission for photographs in Madrasah activities.
                </label>
              </div>
            </fieldset>

            <label className="manual-review-note">
              Administrator note
              <textarea name="reviewNotes" rows={3} placeholder="Optional reason for manual registration" />
            </label>
          </>
        )}

        {error && <output>{error}</output>}

        <footer>
          <button type="button" onClick={close} disabled={busy}>
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button className="primary" disabled={busy || loading}>
              {busy ? "Registering..." : "Register & enrol student"}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

function NotificationBell({
  user,
  openCommunication,
}: {
  user: User;
  openCommunication: (communicationId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const shellRef = useRef<HTMLDivElement | null>(null);

  const supported = ["admin", "teacher", "parent"].includes(user.role);

  const loadNotifications = useCallback(async () => {
    if (!supported) {
      setRows([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/communications", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const result = (await response.json().catch(() => ({}))) as {
        data?: Row[];
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to load notifications.");
        return;
      }

      setRows(result.data ?? []);
    } catch {
      setError("Unable to load notifications right now.");
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    void loadNotifications();

    if (!supported) return;

    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 60000);

    const refresh = () => {
      void loadNotifications();
    };

    window.addEventListener("bnmc-notifications-changed", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("bnmc-notifications-changed", refresh);
    };
  }, [loadNotifications, supported]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        shellRef.current &&
        event.target instanceof Node &&
        !shellRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const parentUnread =
    user.role === "parent"
      ? rows.filter(
          (row) =>
            Number(row.is_read ?? 0) !== 1 &&
            Number(row.legacy ?? 0) !== 1,
        ).length
      : 0;

  const failedDeliveries =
    user.role === "admin" || user.role === "teacher"
      ? rows.reduce(
          (total, row) =>
            total + Number(row.email_failed_count ?? 0),
          0,
        )
      : 0;

  const badgeCount =
    user.role === "parent" ? parentUnread : failedDeliveries;

  const visibleRows = rows
    .filter((row) => {
      if (user.role === "parent") return true;
      return String(row.status ?? "") !== "draft" || Number(row.email_failed_count ?? 0) > 0;
    })
    .slice(0, 8);

  async function markParentRead(row: Row) {
    if (
      user.role !== "parent" ||
      Number(row.is_read ?? 0) === 1 ||
      Number(row.legacy ?? 0) === 1
    ) {
      return;
    }

    try {
      const response = await fetch("/api/v1/communications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });

      if (response.ok) {
        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? { ...item, is_read: 1, read_at: new Date().toISOString() }
              : item,
          ),
        );
      }
    } catch {
      // Opening the communication must not be blocked by read-tracking.
    }
  }

  async function openNotification(row: Row) {
    await markParentRead(row);
    setOpen(false);
    openCommunication(String(row.id ?? ""));
  }

  async function markAllRead() {
    if (user.role !== "parent") return;

    const unreadRows = rows.filter(
      (row) =>
        Number(row.is_read ?? 0) !== 1 &&
        Number(row.legacy ?? 0) !== 1,
    );

    if (!unreadRows.length) return;

    await Promise.allSettled(
      unreadRows.map((row) =>
        fetch("/api/v1/communications", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: row.id }),
        }),
      ),
    );

    setRows((current) =>
      current.map((row) =>
        Number(row.legacy ?? 0) === 1
          ? row
          : { ...row, is_read: 1, read_at: row.read_at ?? new Date().toISOString() },
      ),
    );
  }

  return (
    <div className="portal-notification-shell" ref={shellRef}>
      <button
        type="button"
        className={`portal-notification-button ${open ? "active" : ""}`}
        aria-label={
          badgeCount > 0
            ? `Notifications, ${badgeCount} requiring attention`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void loadNotifications();
        }}
      >
        <Bell />
        {badgeCount > 0 && (
          <span className="portal-notification-badge" aria-hidden="true">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="portal-notification-panel" role="dialog" aria-label="Notifications">
          <div className="portal-notification-head">
            <div>
              <strong>Notifications</strong>
              <small>
                {user.role === "parent"
                  ? parentUnread > 0
                    ? `${parentUnread} unread message${parentUnread === 1 ? "" : "s"}`
                    : "You are up to date"
                  : failedDeliveries > 0
                    ? `${failedDeliveries} email delivery issue${failedDeliveries === 1 ? "" : "s"}`
                    : "Recent communication activity"}
              </small>
            </div>
            <button
              type="button"
              className="portal-notification-refresh"
              onClick={() => void loadNotifications()}
              aria-label="Refresh notifications"
              disabled={loading}
            >
              <RefreshCw className={loading ? "spinning" : ""} />
            </button>
          </div>

          {user.role === "parent" && parentUnread > 0 && (
            <div className="portal-notification-tools">
              <button type="button" onClick={() => void markAllRead()}>
                Mark all as read
              </button>
            </div>
          )}

          <div className="portal-notification-list">
            {loading && rows.length === 0 ? (
              <div className="portal-notification-empty">
                <RefreshCw className="spinning" />
                <span>Loading notifications...</span>
              </div>
            ) : error ? (
              <div className="portal-notification-empty error">
                <span>{error}</span>
                <button type="button" onClick={() => void loadNotifications()}>
                  Try again
                </button>
              </div>
            ) : !supported ? (
              <div className="portal-notification-empty">
                <Bell />
                <span>No notifications are configured for this role yet.</span>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="portal-notification-empty">
                <CheckCircle2 />
                <span>No notifications at the moment.</span>
              </div>
            ) : (
              visibleRows.map((row) => {
                const unread =
                  user.role === "parent" &&
                  Number(row.is_read ?? 0) !== 1 &&
                  Number(row.legacy ?? 0) !== 1;
                const failures = Number(row.email_failed_count ?? 0);
                const kind = String(row.kind ?? "announcement");
                const status = String(row.status ?? "");

                return (
                  <button
                    type="button"
                    className={`portal-notification-item ${unread ? "unread" : ""} ${failures > 0 ? "attention" : ""}`}
                    key={String(row.id)}
                    onClick={() => void openNotification(row)}
                  >
                    <span className="portal-notification-item-icon">
                      <MessageSquare />
                    </span>
                    <span className="portal-notification-item-copy">
                      <strong>{String(row.title ?? "Madrasah update")}</strong>
                      <span>
                        {user.role === "parent"
                          ? String(row.body ?? "").slice(0, 105)
                          : failures > 0
                            ? `${failures} email${failures === 1 ? "" : "s"} failed to send`
                            : `${kind === "message" ? "Message" : "Announcement"} · ${nice(status)}`}
                      </span>
                      <small>
                        {user.role === "parent"
                          ? `${String(row.author ?? "BNMC Madrasah")} · `
                          : `${String(row.audience ?? "Parents")} · `}
                        {dateValue(row.sent_at ?? row.created_at)}
                      </small>
                    </span>
                    {unread && <span className="portal-notification-unread-dot" aria-label="Unread" />}
                  </button>
                );
              })
            )}
          </div>

          {supported && (
            <div className="portal-notification-footer">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openCommunication();
                }}
              >
                Open Communication Centre
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommunicationCentre({
  user,
  focusId,
  onFocusHandled,
}: {
  user: User;
  focusId?: string | null;
  onFocusHandled: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<{
    classes: Row[];
    guardians: Row[];
    students: Row[];
  }>({
    classes: [],
    guardians: [],
    students: [],
  });
  const [tab, setTab] = useState<"message" | "announcement">("message");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] =
    useState<"new" | "draft" | "resend">("new");
  const [deleteTarget, setDeleteTarget] =
    useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<Row[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [parentOpen, setParentOpen] = useState<Row | null>(null);
  const focusHandledRef = useRef<string | null>(null);
  const [templateKey, setTemplateKey] = useState("");
  const [draft, setDraft] = useState({
    id: "",
    kind: "message" as "message" | "announcement",
    audienceType: user.role === "teacher" ? "class" : "all_parents",
    targetId: "",
    title: "",
    body: "",
    channel: "email_and_app" as "app" | "email" | "email_and_app",
  });

  const templates: Record<
    string,
    { title: string; body: string }
  > = {
    class_reminder: {
      title: "Class reminder",
      body: "Assalamu alaikum. This is a reminder about the upcoming Madrasah class. Please ensure your child arrives on time and is collected promptly at the end of the session.",
    },
    class_cancelled: {
      title: "Class cancellation",
      body: "Assalamu alaikum. Please note that the scheduled Madrasah class has been cancelled. We apologise for any inconvenience and will share any further update as soon as possible.",
    },
    fee_reminder: {
      title: "Monthly fee reminder",
      body: "Assalamu alaikum. This is a gentle reminder that the monthly Madrasah fee is due. Please log in to the parent portal to review any outstanding invoice and make payment.",
    },
    parent_meeting: {
      title: "Parent meeting",
      body: "Assalamu alaikum. We would like to invite you to a parent meeting regarding your child's Madrasah learning and progress. Further details are provided below.",
    },
    holiday: {
      title: "Madrasah holiday / closure",
      body: "Assalamu alaikum. Please note the following Madrasah holiday or closure information. Kindly review the details below and update your family arrangements accordingly.",
    },
    general: {
      title: "BNMC Madrasah update",
      body: "Assalamu alaikum. Please see the following update from BNMC Madrasah.",
    },
  };

  const loadCommunications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/communications", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const result = (await response.json().catch(() => ({}))) as {
        data?: Row[];
        options?: {
          classes?: Row[];
          guardians?: Row[];
          students?: Row[];
        };
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to load communications.");
        return;
      }

      setRows(result.data ?? []);
      setOptions({
        classes: result.options?.classes ?? [],
        guardians: result.options?.guardians ?? [],
        students: result.options?.students ?? [],
      });
    } catch {
      setError("Unable to connect to the communication service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunications();
  }, [loadCommunications]);

  function resetDraft(kind: "message" | "announcement") {
    setTemplateKey("");
    setDraft({
      id: "",
      kind,
      audienceType: user.role === "teacher" ? "class" : "all_parents",
      targetId: "",
      title: "",
      body: "",
      channel: kind === "message" ? "email_and_app" : "app",
    });
  }

  function openComposer(
    kind: "message" | "announcement",
    row?: Row,
    mode: "draft" | "resend" = "draft",
  ) {
    setNotice("");
    setError("");
    setTemplateKey("");

    if (row) {
      setComposeMode(
        mode === "resend"
          ? "resend"
          : "draft",
      );

      setDraft({
        id:
          mode === "resend"
            ? ""
            : String(
                row.id ??
                  "",
              ),
        kind:
          String(
            row.kind ??
              kind,
          ) ===
          "announcement"
            ? "announcement"
            : "message",
        audienceType:
          String(
            row.audience_type ??
              "all_parents",
          ),
        targetId:
          String(
            row.target_id ??
              "",
          ),
        title:
          String(
            row.title ??
              "",
          ),
        body:
          String(
            row.body ??
              "",
          ),
        channel:
          [
            "app",
            "email",
            "email_and_app",
          ].includes(
            String(
              row.channel ??
                "",
            ),
          )
            ? (
                String(
                  row.channel,
                ) as
                  | "app"
                  | "email"
                  | "email_and_app"
              )
            : kind ===
                "message"
              ? "email_and_app"
              : "app",
      });
    } else {
      setComposeMode(
        "new",
      );
      resetDraft(
        kind,
      );
    }

    setComposeOpen(
      true,
    );
  }

  async function deleteCommunication(
    row: Row,
  ) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response =
        await fetch(
          "/api/v1/communications",
          {
            method:
              "DELETE",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                id:
                  row.id,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
          message?: string;
        };

      if (!response.ok) {
        setError(
          result.error ??
            "Unable to delete communication.",
        );
        return;
      }

      setDeleteTarget(
        null,
      );
      setDetail(
        null,
      );

      setNotice(
        result.message ??
          "Communication deleted.",
      );

      await loadCommunications();

      window.dispatchEvent(
        new Event(
          "bnmc-notifications-changed",
        ),
      );
    } catch {
      setError(
        "Unable to connect to the communication service.",
      );
    } finally {
      setBusy(false);
    }
  }

  function targetOptions() {
    if (draft.audienceType === "class") {
      return options.classes.map((row) => ({
        value: String(row.id ?? ""),
        label: String(row.name ?? "Class"),
      }));
    }

    if (draft.audienceType === "guardian") {
      return options.guardians.map((row) => ({
        value: String(row.id ?? ""),
        label: `${String(row.name ?? "Parent")} · ${String(row.email ?? "")}`,
      }));
    }

    if (draft.audienceType === "student") {
      return options.students.map((row) => ({
        value: String(row.id ?? ""),
        label: `${String(row.name ?? "Student")} · ${String(row.student_number ?? "")}`,
      }));
    }

    return [];
  }

  function targetLabel() {
    if (draft.audienceType === "class") return "Class";
    if (draft.audienceType === "guardian") return "Parent / guardian";
    if (draft.audienceType === "student") return "Student";
    return "Recipient";
  }

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const template = templates[key];

    if (!template) return;

    setDraft((current) => ({
      ...current,
      title: template.title,
      body: template.body,
    }));
  }

  async function submitCommunication(action: "save_draft" | "send" | "publish") {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/v1/communications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...draft,
          action,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        recipientCount?: number;
        emailSentCount?: number;
        emailFailedCount?: number;
        appCount?: number;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to save communication.");
        return;
      }

      const extras: string[] = [];

      if (action !== "save_draft") {
        if (draft.channel === "email" || draft.channel === "email_and_app") {
          extras.push(`${result.emailSentCount ?? 0} email${result.emailSentCount === 1 ? "" : "s"} sent`);

          if (Number(result.emailFailedCount ?? 0) > 0) {
            extras.push(`${result.emailFailedCount} email${result.emailFailedCount === 1 ? "" : "s"} failed`);
          }
        }

        if (draft.channel === "app" || draft.channel === "email_and_app") {
          extras.push(`${result.appCount ?? 0} parent portal inbox${result.appCount === 1 ? "" : "es"}`);
        }
      }

      setNotice(
        [result.message ?? "Communication saved.", extras.length ? extras.join(" · ") : ""]
          .filter(Boolean)
          .join(" "),
      );
      setComposeOpen(false);
      setComposeMode("new");
      resetDraft("message");
      await loadCommunications();
      window.dispatchEvent(new Event("bnmc-notifications-changed"));
    } catch {
      setError("Unable to connect to the communication service.");
    } finally {
      setBusy(false);
    }
  }

  async function openDetails(row: Row) {
    setDetail(row);
    setDetailRecipients([]);
    setDetailLoading(true);

    try {
      const response = await fetch(
        `/api/v1/communications?id=${encodeURIComponent(String(row.id ?? ""))}`,
        { cache: "no-store" },
      );
      const result = (await response.json().catch(() => ({}))) as {
        recipients?: Row[];
      };

      if (response.ok) {
        setDetailRecipients(result.recipients ?? []);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function openParentMessage(row: Row) {
    setParentOpen(row);

    if (Number(row.is_read ?? 0) === 1 || Number(row.legacy ?? 0) === 1) {
      return;
    }

    try {
      await fetch("/api/v1/communications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });

      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, is_read: 1, read_at: new Date().toISOString() }
            : item,
        ),
      );
      window.dispatchEvent(new Event("bnmc-notifications-changed"));
    } catch {
      // Reading the message must remain possible even if read-tracking fails.
    }
  }

  useEffect(() => {
    if (!focusId) {
      focusHandledRef.current = null;
      return;
    }

    if (loading || focusHandledRef.current === focusId) return;

    const row = rows.find((item) => String(item.id ?? "") === focusId);
    if (!row) return;

    focusHandledRef.current = focusId;
    setTab(String(row.kind ?? "announcement") === "message" ? "message" : "announcement");

    if (user.role === "parent") {
      void openParentMessage(row);
    } else {
      void openDetails(row);
    }

    onFocusHandled();
  }, [focusId, loading, rows, user.role, onFocusHandled]);

  const filtered = rows.filter((row) => {
    const kind = String(row.kind ?? "announcement");
    return kind === tab;
  });

  if (user.role === "parent") {
    const unread = rows.filter(
      (row) => Number(row.is_read ?? 0) !== 1 && Number(row.legacy ?? 0) !== 1,
    ).length;

    return (
      <section className="communication-centre parent-communication-centre">
        <div className="records-head communication-heading">
          <div>
            <h1>Messages</h1>
            <p>
              Updates and announcements from BNMC Madrasah
              {unread > 0 ? ` · ${unread} unread` : ""}
            </p>
          </div>
          <span>
            <button type="button" onClick={loadCommunications}>
              <RefreshCw /> Refresh
            </button>
          </span>
        </div>

        <div className="communication-tabs" role="tablist" aria-label="Messages and announcements">
          <button
            type="button"
            className={tab === "message" ? "active" : ""}
            onClick={() => setTab("message")}
          >
            Messages
          </button>
          <button
            type="button"
            className={tab === "announcement" ? "active" : ""}
            onClick={() => setTab("announcement")}
          >
            Announcements
          </button>
        </div>

        {error && <div className="portal-error">{error}</div>}

        {loading ? (
          <div className="empty"><RefreshCw /> Loading messages...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <MessageSquare />
            <b>No {tab === "message" ? "messages" : "announcements"} yet</b>
            <p>New Madrasah updates will appear here.</p>
          </div>
        ) : (
          <div className="parent-message-list">
            {filtered.map((row) => {
              const unreadRow = Number(row.is_read ?? 0) !== 1 && Number(row.legacy ?? 0) !== 1;
              return (
                <button
                  type="button"
                  key={String(row.id)}
                  className={`parent-message-card ${unreadRow ? "unread" : ""}`}
                  onClick={() => openParentMessage(row)}
                >
                  <span className="parent-message-card-top">
                    <strong>{String(row.title ?? "Madrasah update")}</strong>
                    {unreadRow && <em>New</em>}
                  </span>
                  <span className="parent-message-preview">
                    {String(row.body ?? "").slice(0, 170)}
                    {String(row.body ?? "").length > 170 ? "…" : ""}
                  </span>
                  <small>
                    {String(row.author ?? "BNMC Madrasah")} · {dateValue(row.sent_at ?? row.created_at)}
                  </small>
                </button>
              );
            })}
          </div>
        )}

        {parentOpen && (
          <div className="modal">
            <div className="status-dialog communication-read-dialog">
              <header>
                <div>
                  <small>{String(parentOpen.kind ?? "announcement") === "message" ? "Message" : "Announcement"}</small>
                  <h2>{String(parentOpen.title ?? "Madrasah update")}</h2>
                </div>
                <button type="button" onClick={() => setParentOpen(null)} aria-label="Close">
                  <X />
                </button>
              </header>
              <div className="status-dialog-body communication-read-body">
                <p>{String(parentOpen.body ?? "")}</p>
                <small>
                  From {String(parentOpen.author ?? "BNMC Madrasah")} · {dateValue(parentOpen.sent_at ?? parentOpen.created_at)}
                </small>
              </div>
              <footer>
                <button type="button" className="primary" onClick={() => setParentOpen(null)}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="communication-centre">
      <div className="records-head communication-heading">
        <div>
          <h1>Communication Centre</h1>
          <p>Send parent messages and publish Madrasah announcements from one place.</p>
        </div>
        <span>
          <button type="button" onClick={loadCommunications}>
            <RefreshCw /> Refresh
          </button>
          <button type="button" className="primary" onClick={() => openComposer("message")}>
            <Plus /> Send message
          </button>
        </span>
      </div>

      <div className="communication-tabs" role="tablist" aria-label="Communication type">
        <button
          type="button"
          className={tab === "message" ? "active" : ""}
          onClick={() => setTab("message")}
        >
          Messages
        </button>
        <button
          type="button"
          className={tab === "announcement" ? "active" : ""}
          onClick={() => setTab("announcement")}
        >
          Announcements
        </button>
      </div>

      {notice && (
        <div className="records-notice success" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button>
        </div>
      )}

      {error && <div className="portal-error">{error}</div>}

      <div className="communication-panel-head">
        <div>
          <strong>{tab === "message" ? "Parent messages" : "Madrasah announcements"}</strong>
          <small>
            {tab === "message"
              ? "Direct updates by email, parent portal, or both."
              : "Notices parents can see in their portal, with optional email notification."}
          </small>
        </div>
        {tab === "announcement" && (
          <button type="button" className="primary communication-new-button" onClick={() => openComposer("announcement")}>
            <Plus /> New announcement
          </button>
        )}
      </div>

      <div className="table-wrap communication-table">
        {loading ? (
          <div className="empty"><RefreshCw /> Loading communications...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <MessageSquare />
            <b>No {tab === "message" ? "messages" : "announcements"} yet</b>
            <p>
              {tab === "message"
                ? "Use Send message to contact parents."
                : "Use New announcement to publish your first notice."}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{tab === "message" ? "Subject" : "Announcement"}</th>
                <th>Audience</th>
                <th>Delivery</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = String(row.status ?? "draft");
                const channel = String(row.channel ?? "app");
                return (
                  <tr key={String(row.id)}>
                    <td>
                      <strong className="communication-title">{String(row.title ?? "")}</strong>
                      <small className="communication-preview">{String(row.body ?? "").slice(0, 95)}{String(row.body ?? "").length > 95 ? "…" : ""}</small>
                    </td>
                    <td>{String(row.audience ?? "Parents")}</td>
                    <td>{channel === "email_and_app" ? "Email + portal" : channel === "email" ? "Email" : "Parent portal"}</td>
                    <td>
                      {Number(row.recipient_count ?? 0)}
                      {Number(row.email_failed_count ?? 0) > 0 && (
                        <small className="communication-failed">{Number(row.email_failed_count)} email failed</small>
                      )}
                    </td>
                    <td><em className={`status ${status}`}>{nice(status)}</em></td>
                    <td>{dateValue(row.sent_at ?? row.created_at)}</td>
                    <td>
                      <div className="communication-row-actions">
                        {status === "draft" ? (
                          <>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                openComposer(
                                  tab,
                                  row,
                                )
                              }
                            >
                              Continue
                            </button>

                            <button
                              type="button"
                              className="row-action communication-danger-action"
                              onClick={() =>
                                setDeleteTarget(
                                  row,
                                )
                              }
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                openDetails(
                                  row,
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                openComposer(
                                  tab,
                                  row,
                                  "resend",
                                )
                              }
                            >
                              Edit & resend
                            </button>

                            <button
                              type="button"
                              className="row-action communication-danger-action"
                              onClick={() =>
                                setDeleteTarget(
                                  row,
                                )
                              }
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {composeOpen && (
        <div className="modal communication-compose-modal">
          <form onSubmit={(event) => event.preventDefault()}>
            <header>
              <div>
                <small>{draft.kind === "message" ? "Parent communication" : "Madrasah notice"}</small>
                <h2>
                  {composeMode === "resend"
                    ? draft.kind === "message"
                      ? "Edit & resend message"
                      : "Edit & republish announcement"
                    : draft.id
                      ? "Continue draft"
                      : draft.kind === "message"
                        ? "Send message"
                        : "New announcement"}
                </h2>
              </div>
              <button type="button" onClick={() => !busy && setComposeOpen(false)} disabled={busy} aria-label="Close">
                <X />
              </button>
            </header>

            {composeMode === "resend" && (
              <div className="communication-resend-note">
                <b>
                  Sending a new copy
                </b>
                <span>
                  You can edit the content or audience before sending. The original communication remains in the history.
                </span>
              </div>
            )}

            <div className="communication-form-grid">
              {draft.kind === "message" && (
                <label className="communication-wide-field">
                  Start from a template <span>Optional</span>
                  <select value={templateKey} onChange={(event) => applyTemplate(event.target.value)} disabled={busy}>
                    <option value="">Write my own message</option>
                    <option value="class_reminder">Class reminder</option>
                    <option value="class_cancelled">Class cancellation</option>
                    <option value="fee_reminder">Monthly fee reminder</option>
                    <option value="parent_meeting">Parent meeting</option>
                    <option value="holiday">Holiday / closure</option>
                    <option value="general">General update</option>
                  </select>
                </label>
              )}

              <label>
                Send to
                <select
                  value={draft.audienceType}
                  onChange={(event) => setDraft((current) => ({ ...current, audienceType: event.target.value, targetId: "" }))}
                  disabled={busy}
                >
                  {user.role === "admin" && <option value="all_parents">All parents</option>}
                  <option value="class">Parents in a class</option>
                  <option value="student">Parent of a student</option>
                  <option value="guardian">Selected parent / guardian</option>
                </select>
              </label>

              <label>
                Delivery method
                <select
                  value={draft.channel}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    channel: event.target.value as "app" | "email" | "email_and_app",
                  }))}
                  disabled={busy}
                >
                  <option value="email_and_app">Email + parent portal</option>
                  <option value="app">Parent portal only</option>
                  <option value="email">Email only</option>
                </select>
              </label>

              {draft.audienceType !== "all_parents" && (
                <label className="communication-wide-field">
                  {targetLabel()}
                  <select
                    value={draft.targetId}
                    onChange={(event) => setDraft((current) => ({ ...current, targetId: event.target.value }))}
                    disabled={busy}
                    required
                  >
                    <option value="">Select {targetLabel().toLowerCase()}</option>
                    {targetOptions().map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="communication-wide-field">
                {draft.kind === "message" ? "Subject" : "Announcement title"}
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder={draft.kind === "message" ? "e.g. Saturday class reminder" : "e.g. Eid break"}
                  disabled={busy}
                  required
                />
              </label>

              <label className="communication-wide-field">
                Message
                <textarea
                  value={draft.body}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Write the information parents need to receive..."
                  disabled={busy}
                  required
                />
                <small className="communication-help">
                  Email recipients are hidden from one another. Parents with portal access will also see this in Messages when Parent portal delivery is selected.
                </small>
              </label>
            </div>

            {error && <output>{error}</output>}

            <footer className="communication-compose-footer">
              <button type="button" onClick={() => setComposeOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" onClick={() => submitCommunication("save_draft")} disabled={busy}>Save draft</button>
              <button
                type="button"
                className="primary"
                onClick={() => submitCommunication(draft.kind === "message" ? "send" : "publish")}
                disabled={busy}
              >
                {busy
                  ? "Working..."
                  : composeMode === "resend"
                    ? draft.kind === "message"
                      ? "Resend now"
                      : "Republish"
                    : draft.kind === "message"
                      ? "Send now"
                      : "Publish"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {detail && (
        <div className="modal">
          <div className="status-dialog communication-detail-dialog">
            <header>
              <div>
                <small>{String(detail.kind ?? "announcement") === "message" ? "Sent message" : "Published announcement"}</small>
                <h2>{String(detail.title ?? "Communication details")}</h2>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close"><X /></button>
            </header>
            <div className="status-dialog-body communication-detail-body">
              <div className="communication-detail-summary">
                <span><small>Audience</small><strong>{String(detail.audience ?? "Parents")}</strong></span>
                <span><small>Recipients</small><strong>{Number(detail.recipient_count ?? 0)}</strong></span>
                <span><small>Email sent</small><strong>{Number(detail.email_sent_count ?? 0)}</strong></span>
                <span><small>Email failed</small><strong>{Number(detail.email_failed_count ?? 0)}</strong></span>
              </div>
              <div className="communication-full-message">{String(detail.body ?? "")}</div>
              <div className="communication-recipient-list">
                <h3>Recipients</h3>
                {detailLoading ? (
                  <p>Loading recipients...</p>
                ) : detailRecipients.length === 0 ? (
                  <p>No recipient-level delivery records are available for this communication.</p>
                ) : (
                  detailRecipients.map((recipient) => (
                    <div key={String(recipient.id)}>
                      <span>
                        <strong>{String(recipient.guardian_name ?? recipient.email ?? "Parent")}</strong>
                        <small>{String(recipient.email ?? "")}</small>
                      </span>
                      <span className="communication-delivery-states">
                        {String(recipient.email_status ?? "not_requested") !== "not_requested" && (
                          <em className={`status ${String(recipient.email_status ?? "")}`}>
                            Email {nice(String(recipient.email_status ?? ""))}
                          </em>
                        )}
                        {String(recipient.app_status ?? "") === "available" && (
                          <em className={`status ${recipient.read_at ? "secure" : "pending"}`}>
                            {recipient.read_at ? "Read in portal" : "Portal unread"}
                          </em>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <footer className="communication-detail-footer">
              <button
                type="button"
                className="communication-danger-button"
                onClick={() =>
                  setDeleteTarget(
                    detail,
                  )
                }
              >
                Delete
              </button>

              <span>
                <button
                  type="button"
                  onClick={() => {
                    const row =
                      detail;

                    setDetail(
                      null,
                    );

                    openComposer(
                      String(
                        row.kind ??
                          "announcement",
                      ) ===
                      "message"
                        ? "message"
                        : "announcement",
                      row,
                      "resend",
                    );
                  }}
                >
                  Edit & resend
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    setDetail(
                      null,
                    )
                  }
                >
                  Close
                </button>
              </span>
            </footer>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="modal">
          <div className="status-dialog communication-delete-dialog">
            <header>
              <div>
                <small>
                  Delete communication
                </small>

                <h2>
                  {String(
                    deleteTarget.status ??
                      "draft",
                  ) ===
                  "draft"
                    ? "Delete this draft?"
                    : `Delete this ${
                        String(
                          deleteTarget.kind ??
                            "announcement",
                        ) ===
                        "message"
                          ? "message"
                          : "announcement"
                      }?`}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  !busy &&
                  setDeleteTarget(
                    null,
                  )
                }
                disabled={
                  busy
                }
                aria-label="Close"
              >
                <X />
              </button>
            </header>

            <div className="status-dialog-body">
              <p>
                <strong>
                  {String(
                    deleteTarget.title ??
                      "Communication",
                  )}
                </strong>
              </p>

              <p>
                {String(
                  deleteTarget.status ??
                    "draft",
                ) ===
                "draft"
                  ? "This draft will be permanently removed."
                  : "This removes it from the BNMC portal and communication history. Any email already delivered to a recipient cannot be recalled."}
              </p>
            </div>

            <footer>
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(
                    null,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="communication-danger-button"
                onClick={() =>
                  deleteCommunication(
                    deleteTarget,
                  )
                }
                disabled={
                  busy
                }
              >
                {busy
                  ? "Deleting..."
                  : "Delete permanently"}
              </button>
            </footer>
          </div>
        </div>
      )}

    </section>
  );
}



function ClassCategoryManager({
  close,
  changed,
}: {
  close: () => void;
  changed: () => void;
}) {
  const [rows, setRows] =
    useState<Row[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState(false);
  const [error, setError] =
    useState("");
  const [editing, setEditing] =
    useState<Row | null>(null);
  const [name, setName] =
    useState("");
  const [description, setDescription] =
    useState("");

  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/v1/class-categories",
            { cache: "no-store" },
          );

        const result =
          (await response.json().catch(() => ({}))) as {
            data?: Row[];
            error?: string;
          };

        if (!response.ok) {
          setError(
            result.error ??
              "Unable to load categories.",
          );
          return;
        }

        setRows(
          result.data ??
            [],
        );
      } catch {
        setError(
          "Unable to connect to the server.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  function resetEditor() {
    setEditing(null);
    setName("");
    setDescription("");
    setError("");
  }

  function startEdit(row: Row) {
    setEditing(row);
    setName(
      String(row.name ?? ""),
    );
    setDescription(
      String(row.description ?? ""),
    );
    setError("");
  }

  async function saveCategory(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanName =
      name
        .replace(/\s+/g, " ")
        .trim();

    if (!cleanName) {
      setError(
        "Enter a category name.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/v1/class-categories",
          {
            method:
              editing
                ? "PATCH"
                : "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                ...(editing
                  ? {
                      id:
                        editing.id,
                    }
                  : {}),
                name:
                  cleanName,
                description:
                  description.trim(),
              }),
          },
        );

      const result =
        (await response.json().catch(() => ({}))) as {
          error?: string;
        };

      if (!response.ok) {
        setError(
          result.error ??
            "Unable to save category.",
        );
        return;
      }

      resetEditor();
      await load();
      changed();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(
    row: Row,
  ) {
    const current =
      String(
        row.status ??
          "active",
      );

    const next =
      current === "active"
        ? "inactive"
        : "active";

    setBusy(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/v1/class-categories",
          {
            method:
              "PATCH",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                id:
                  row.id,
                status:
                  next,
              }),
          },
        );

      const result =
        (await response.json().catch(() => ({}))) as {
          error?: string;
        };

      if (!response.ok) {
        setError(
          result.error ??
            "Unable to update category.",
        );
        return;
      }

      await load();
      changed();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <div className="class-category-manager">
        <header>
          <div>
            <small>
              Class structure
            </small>

            <h2>
              Manage categories
            </h2>

            <p>
              Create the categories your Madrasah needs. Classes can then be added or renamed independently.
            </p>
          </div>

          <button
            type="button"
            onClick={
              close
            }
          >
            <X />
          </button>
        </header>

        <div className="class-category-manager-body">
          <form
            className="category-editor"
            onSubmit={
              saveCategory
            }
          >
            <div>
              <h3>
                {editing
                  ? "Edit category"
                  : "Add category"}
              </h3>

              <p>
                Examples: Category 1, Hifz, Beginners, Adult Sisters.
              </p>
            </div>

            <label>
              Category name

              <input
                value={
                  name
                }
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="e.g. Category 1"
                maxLength={80}
                required
              />
            </label>

            <label>
              Description (optional)

              <input
                value={
                  description
                }
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Short description"
                maxLength={200}
              />
            </label>

            <div className="category-editor-actions">
              {editing && (
                <button
                  type="button"
                  onClick={
                    resetEditor
                  }
                  disabled={
                    busy
                  }
                >
                  Cancel edit
                </button>
              )}

              <button
                className="primary"
                disabled={
                  busy
                }
              >
                {busy
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Add category"}
              </button>
            </div>
          </form>

          {error && (
            <output className="category-manager-error">
              {error}
            </output>
          )}

          <section className="category-list">
            <div className="category-list-head">
              <h3>
                Existing categories
              </h3>

              <small>
                {rows.length} total
              </small>
            </div>

            {loading ? (
              <div className="category-empty">
                Loading categories...
              </div>
            ) : rows.length === 0 ? (
              <div className="category-empty">
                No categories yet. Add the first category above.
              </div>
            ) : (
              rows.map(
                (row) => {
                  const status =
                    String(
                      row.status ??
                        "active",
                    );

                  return (
                    <div
                      className={`category-row ${status}`}
                      key={
                        String(
                          row.id,
                        )
                      }
                    >
                      <span>
                        <b>
                          {String(
                            row.name ??
                              "Category",
                          )}
                        </b>

                        <small>
                          {Number(
                            row.class_count ??
                              0,
                          )}{" "}
                          class{Number(
                            row.class_count ??
                              0,
                          ) === 1
                            ? ""
                            : "es"}
                          {row.description
                            ? ` · ${String(row.description)}`
                            : ""}
                        </small>
                      </span>

                      <em className={`status ${status}`}>
                        {nice(
                          status,
                        )}
                      </em>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              row,
                            )
                          }
                          disabled={
                            busy
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            changeStatus(
                              row,
                            )
                          }
                          disabled={
                            busy
                          }
                        >
                          {status ===
                          "active"
                            ? "Archive"
                            : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  );
                },
              )
            )}
          </section>
        </div>

        <footer>
          <button
            className="primary"
            type="button"
            onClick={
              close
            }
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

function Records({
  resource,
  rows,
  loading,
  canCreate,
  canManage,
  create,
  edit,
  refresh,
  openStudent,
  user,
  navigate,
  openBilling,
  recordProgress,
}: {
  resource: string;
  rows: Row[];
  loading: boolean;
  canCreate: boolean;
  canManage: boolean;
  create: () => void;
  edit: (row: Row) => void;
  refresh: () => void;
  openStudent?:
    (studentId: unknown) => void;
  user: User;
  navigate:
    (target: string) => void;
  openBilling:
    (
      section?:
        BillingSection,
    ) => void;
  recordProgress:
    (row: Row) => void;
}) {
  const cols =
    headings[
      resource
    ] ?? [];
  const canRecordProgress =
    resource === "enrolments" &&
    [
      "admin",
      "teacher",
    ].includes(
      user.role,
    );


  const [
    categoryManagerOpen,
    setCategoryManagerOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    classFilter,
    setClassFilter,
  ] = useState("all");

  const [
    sortColumn,
    setSortColumn,
  ] = useState("");

  const [
    showArchived,
    setShowArchived,
  ] = useState(false);

  const [
    missingGuardianOnly,
    setMissingGuardianOnly,
  ] = useState(false);

  const missingGuardianCount =
    useMemo(
      () =>
        resource === "students"
          ? rows.filter(
              (row) =>
                Number(
                  row.guardian_missing ??
                    0,
                ) === 1,
            ).length
          : 0,
      [resource, rows],
    );

  const supportsArchive = [
    "students",
    "classes",
    "staff",
  ].includes(resource);

  const [
    sortDirection,
    setSortDirection,
  ] = useState<
    "asc" | "desc"
  >("asc");

  const statusOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            rows
              .map(
                (row) =>
                  String(
                    row.status ??
                      "",
                  ).trim(),
              )
              .filter(
                Boolean,
              ),
          ),
        ).sort(),
      [rows],
    );

  const classOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            rows
              .map((row) => String(row.class_name ?? "").trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
      [rows],
    );

  const visibleRows =
    useMemo(
      () => {
        const query =
          searchQuery
            .trim()
            .toLowerCase();

        const filtered =
          rows.filter(
            (row) => {
              const rowStatus = String(
                row.status ??
                  "",
              );

              if (
                resource === "students" &&
                classFilter !== "all" &&
                String(row.class_name ?? "") !== classFilter
              ) {
                return false;
              }

              if (
                supportsArchive &&
                !showArchived &&
                statusFilter === "all" &&
                rowStatus === "inactive"
              ) {
                return false;
              }

              if (
                statusFilter !==
                  "all" &&
                rowStatus !==
                  statusFilter
              ) {
                return false;
              }

              if (
                resource ===
                  "students" &&
                missingGuardianOnly &&
                Number(
                  row.guardian_missing ??
                    0,
                ) !== 1
              ) {
                return false;
              }

              if (!query) {
                return true;
              }

              return Object.values(
                row,
              ).some(
                (value) =>
                  String(
                    value ??
                      "",
                  )
                    .toLowerCase()
                    .includes(
                      query,
                    ),
              );
            },
          );

        if (!sortColumn) {
          return filtered;
        }

        return [
          ...filtered,
        ].sort(
          (
            left,
            right,
          ) => {
            const a =
              left[
                sortColumn
              ];

            const b =
              right[
                sortColumn
              ];

            const aNumber =
              Number(a);

            const bNumber =
              Number(b);

            let comparison =
              Number.isFinite(
                aNumber,
              ) &&
              Number.isFinite(
                bNumber,
              ) &&
              String(a ?? "").trim() !==
                "" &&
              String(b ?? "").trim() !==
                ""
                ? aNumber -
                  bNumber
                : String(
                    a ??
                      "",
                  ).localeCompare(
                    String(
                      b ??
                        "",
                    ),
                    undefined,
                    {
                      numeric:
                        true,
                      sensitivity:
                        "base",
                    },
                  );

            if (
              sortDirection ===
              "desc"
            ) {
              comparison *= -1;
            }

            return comparison;
          },
        );
      },
      [
        rows,
        searchQuery,
        statusFilter,
        classFilter,
        sortColumn,
        sortDirection,
        showArchived,
        supportsArchive,
        missingGuardianOnly,
        resource,
      ],
    );

  function toggleSort(
    column: string,
  ) {
    if (
      sortColumn ===
      column
    ) {
      setSortDirection(
        (current) =>
          current ===
          "asc"
            ? "desc"
            : "asc",
      );
      return;
    }

    setSortColumn(
      column,
    );
    setSortDirection(
      "asc",
    );
  }

  const [
    statusDialog,
    setStatusDialog,
  ] =
    useState<{
      id: unknown;
      currentStatus: string;
      row: Row;
    } | null>(
      null,
    );

  const [
    newStatus,
    setNewStatus,
  ] =
    useState("");

  const [
    statusNote,
    setStatusNote,
  ] =
    useState("");

  const [
    statusError,
    setStatusError,
  ] =
    useState("");

  const [
    statusBusy,
    setStatusBusy,
  ] =
    useState(false);

  const [
    accessBusyId,
    setAccessBusyId,
  ] = useState<string | null>(null);

  const [
    statusNotice,
    setStatusNotice,
  ] = useState<{
    type: "success" | "info";
    text: string;
  } | null>(null);

  const [
    admissionClasses,
    setAdmissionClasses,
  ] = useState<
    AdmissionClass[]
  >([]);

  const [
    admissionClassId,
    setAdmissionClassId,
  ] = useState("");

  const [
    admissionClassesLoading,
    setAdmissionClassesLoading,
  ] = useState(false);

  const [
    deleteDialog,
    setDeleteDialog,
  ] = useState<{
    id: string;
    name: string;
    studentNumber: string;
  } | null>(null);

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState("");

  const [
    deleteBusy,
    setDeleteBusy,
  ] = useState(false);

  const [manualRegistrationOpen, setManualRegistrationOpen] = useState(false);

  const [
    deleteError,
    setDeleteError,
  ] = useState("");

  const [
    staffDeleteDialog,
    setStaffDeleteDialog,
  ] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const [
    staffDeleteConfirmation,
    setStaffDeleteConfirmation,
  ] = useState("");

  const [
    staffDeleteBusy,
    setStaffDeleteBusy,
  ] = useState(false);

  const [
    staffDeleteError,
    setStaffDeleteError,
  ] = useState("");

  function openDeleteDialog(row: Row) {
    const name = String(
      row.name ??
        `${row.first_name ?? ""} ${row.last_name ?? ""}`,
    ).trim();

    const studentNumber = String(
      row.student_number ??
        "",
    ).trim();

    setDeleteError("");
    setDeleteConfirmation("");
    setDeleteDialog({
      id: String(row.id ?? ""),
      name: name || "this student",
      studentNumber,
    });
  }

  function closeDeleteDialog() {
    if (deleteBusy) {
      return;
    }

    setDeleteDialog(null);
    setDeleteConfirmation("");
    setDeleteError("");
  }

  async function confirmDeleteStudent() {
    if (!deleteDialog?.id) {
      return;
    }

    if (!deleteDialog.studentNumber) {
      setDeleteError(
        "This student has no student number, so permanent deletion cannot be confirmed safely.",
      );

      return;
    }

    if (
      deleteConfirmation.trim() !==
      deleteDialog.studentNumber
    ) {
      setDeleteError(
        `Type ${deleteDialog.studentNumber} exactly to confirm permanent deletion.`,
      );

      return;
    }

    setDeleteBusy(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `/api/v1/students?id=${encodeURIComponent(
          deleteDialog.id,
        )}&confirm=permanent`,
        { method: "DELETE" },
      );

      if (response.status === 401) {
        window.location.assign(
          "/login",
        );

        return;
      }

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        deleted?: {
          name?: string;
          studentNumber?: string;
        };
      };

      if (!response.ok) {
        setDeleteError(
          result.error ??
            "Unable to delete this student.",
        );

        return;
      }

      const deletedName =
        result.deleted?.name ??
        deleteDialog.name;

      setDeleteDialog(null);
      setDeleteConfirmation("");
      setStatusNotice({
        type: "success",
        text: `${deletedName} was permanently deleted. Financial transaction history was retained and detached from the student.`,
      });
      refresh();
    } catch {
      setDeleteError(
        "Unable to connect to the server. Nothing was deleted. Please try again.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  function openStaffDeleteDialog(
    row: Row,
  ) {
    setStaffDeleteError("");
    setStaffDeleteConfirmation("");

    setStaffDeleteDialog({
      id:
        String(
          row.id ??
            "",
        ),
      name:
        String(
          row.display_name ??
            "this staff account",
        ),
      email:
        String(
          row.email ??
            "",
        ),
      role:
        String(
          row.role ??
            "staff",
        ),
    });
  }

  function closeStaffDeleteDialog() {
    if (
      staffDeleteBusy
    ) {
      return;
    }

    setStaffDeleteDialog(
      null,
    );
    setStaffDeleteConfirmation(
      "",
    );
    setStaffDeleteError(
      "",
    );
  }

  async function confirmDeleteStaff() {
    if (
      !staffDeleteDialog?.id
    ) {
      return;
    }

    if (
      staffDeleteConfirmation
        .trim()
        .toLowerCase() !==
      staffDeleteDialog.email
        .trim()
        .toLowerCase()
    ) {
      setStaffDeleteError(
        `Type ${staffDeleteDialog.email} exactly to confirm permanent deletion.`,
      );
      return;
    }

    setStaffDeleteBusy(
      true,
    );
    setStaffDeleteError(
      "",
    );

    try {
      const response =
        await fetch(
          `/api/v1/staff?id=${encodeURIComponent(
            staffDeleteDialog.id,
          )}&confirm=permanent`,
          {
            method:
              "DELETE",
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          error?: string;
          deleted?: {
            name?: string;
            email?: string;
          };
        };

      if (
        response.status ===
        401
      ) {
        window.location.assign(
          "/login",
        );
        return;
      }

      if (!response.ok) {
        setStaffDeleteError(
          result.error ??
            "Unable to delete this staff account.",
        );
        return;
      }

      const deletedName =
        result.deleted
          ?.name ??
        staffDeleteDialog
          .name;

      setStaffDeleteDialog(
        null,
      );
      setStaffDeleteConfirmation(
        "",
      );
      setStatusNotice({
        type:
          "success",
        text:
          `${deletedName} was permanently removed from Staff & access.`,
      });

      refresh();
    } catch {
      setStaffDeleteError(
        "Unable to connect to the server. Nothing was deleted. Please try again.",
      );
    } finally {
      setStaffDeleteBusy(
        false,
      );
    }
  }

  async function openStatusDialog(
    row: Row,
    preferredStatus?: string,
  ) {
    const currentStatus =
      String(
        row.status ??
          "active",
      );

    let nextStatus =
      currentStatus;

    if (
      resource ===
      "applications"
    ) {
      switch (
        currentStatus
      ) {
        case "submitted":
          nextStatus =
            "accepted";
          break;

        case "under_review":
          nextStatus =
            "accepted";
          break;

        case "waitlisted":
          nextStatus =
            "under_review";
          break;

        case "accepted":
        case "rejected":
          nextStatus =
            "under_review";
          break;

        default:
          nextStatus =
            "under_review";
      }
    }

    setStatusDialog({
      id: row.id,
      currentStatus,
      row,
    });

    setNewStatus(
      preferredStatus ??
        nextStatus,
    );

    setStatusNote("");
    setStatusError("");
    setAdmissionClassId("");

    if (
      resource !==
        "applications" ||
      ![
        "submitted",
        "under_review",
        "waitlisted",
      ].includes(
        currentStatus,
      )
    ) {
      return;
    }

    setAdmissionClassesLoading(
      true,
    );

    try {
      const response =
        await fetch(
          "/api/v1/classes",
          {
            cache:
              "no-store",
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as {
          data?: Row[];
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to load classes",
        );
      }

      const studentGender =
        String(
          row.gender ??
            "",
        ).toLowerCase();

      const classes =
        (result.data ?? [])
          .map(
            (item) => ({
              id: String(
                item.id ??
                  "",
              ),
              name: String(
                item.name ??
                  "Class",
              ),
              enrolled: Number(
                item.enrolled ??
                  0,
              ),
              capacity: Number(
                item.capacity ??
                  0,
              ),
              status: String(
                item.status ??
                  "",
              ),
            }),
          )
          .filter(
            (item) =>
              item.id &&
              item.status ===
                "active" &&
              (
                !studentGender ||
                ![
                  "male",
                  "female",
                ].includes(
                  studentGender,
                ) ||
                item.name
                  .toLowerCase()
                  .includes(
                    `(${studentGender})`,
                  )
              ),
          );

      setAdmissionClasses(
        classes,
      );

      const firstAvailable =
        classes.find(
          (item) =>
            item.enrolled <
            item.capacity,
        );

      setAdmissionClassId(
        firstAvailable?.id ??
          "",
      );
    } catch (error) {
      setAdmissionClasses([]);
      setStatusError(
        error instanceof Error
          ? error.message
          : "Unable to load classes",
      );
    } finally {
      setAdmissionClassesLoading(
        false,
      );
    }
  }

  function closeStatusDialog() {
    if (
      statusBusy
    ) {
      return;
    }

    setStatusDialog(
      null,
    );

    setNewStatus("");
    setStatusNote("");
    setStatusError("");
    setAdmissionClassId("");
    setAdmissionClasses([]);
  }

  async function saveStatus() {
    if (
      !statusDialog ||
      !newStatus
    ) {
      return;
    }

    if (
      resource ===
        "applications" &&
      newStatus ===
        "accepted" &&
      !admissionClassId
    ) {
      setStatusError(
        "Please select an available class before accepting this application.",
      );

      return;
    }

    if (
      resource ===
        "applications" &&
      newStatus ===
        "rejected" &&
      !statusNote.trim()
    ) {
      setStatusError(
        "Please enter a review note before rejecting this application.",
      );

      return;
    }

    setStatusBusy(
      true,
    );

    setStatusError("");

    try {
      const response =
        await fetch(
          `/api/v1/${resource}`,
          {
            method:
              "PATCH",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  id:
                    statusDialog.id,

                  status:
                    newStatus,

                  ...(resource ===
                  "applications"
                    ? {
                        reviewNotes:
                          statusNote.trim(),

                        ...(newStatus ===
                        "accepted"
                          ? {
                              classId:
                                admissionClassId,
                            }
                          : {}),
                      }
                    : {}),
                },
              ),
          },
        );

      const result =
        (await response
          .json()
          .catch(
            () =>
              ({}),
          )) as {
          error?: string;
          parentAccess?: {
            status?: "sent" | "existing" | "failed";
            message?: string;
          } | null;
        };

      if (
        !response.ok
      ) {
        setStatusError(
          result.error ??
            "Unable to update status",
        );

        return;
      }

      setStatusDialog(
        null,
      );

      setNewStatus("");
      setStatusNote("");

      if (
        result.parentAccess?.message
      ) {
        setStatusNotice({
          type:
            result.parentAccess.status === "failed"
              ? "info"
              : "success",
          text:
            result.parentAccess.message,
        });
      }

      refresh();
    } catch {
      setStatusError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      setStatusBusy(
        false,
      );
    }
  }

  async function resendParentAccess(row: Row) {
    const applicationId = String(row.id ?? "");
    if (!applicationId) return;

    setAccessBusyId(applicationId);
    setStatusNotice(null);

    try {
      const response = await fetch("/api/v1/parent-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        parentAccess?: {
          status?: "sent" | "existing" | "failed";
          message?: string;
        };
      };

      setStatusNotice({
        type: response.ok ? "success" : "info",
        text:
          result.parentAccess?.message ??
          result.error ??
          "Unable to resend parent access.",
      });
    } catch {
      setStatusNotice({
        type: "info",
        text: "Unable to connect to the parent access service.",
      });
    } finally {
      setAccessBusyId(null);
    }
  }

  return (
    <section className="records">
      <WorkspaceTabs
        resource={
          resource
        }
        user={
          user
        }
        navigate={
          navigate
        }
        openBilling={
          openBilling
        }
      />

      <div className="records-head">
        <div>
          <h1>
            {
              nav.find(
                (item) =>
                  item.key ===
                  resource,
              )?.label ??
              nice(
                resource,
              )
            }
          </h1>

          <p>
            {resource === "enrolments"
              ? `${visibleRows.length} enrolment${visibleRows.length === 1 ? "" : "s"} shown. Manage class placement, transfers and withdrawals here.`
              : resource === "progress"
                ? `${visibleRows.length} assessment${visibleRows.length === 1 ? "" : "s"} shown. Review Qur'an learning and the next steps recorded for students.`
                : resource === "students" && missingGuardianCount > 0
                  ? `${visibleRows.length} of ${rows.length} students shown · ${missingGuardianCount} need guardian details`
                  : visibleRows.length === rows.length
                    ? `${rows.length} database record${rows.length === 1 ? "" : "s"}`
                    : `${visibleRows.length} of ${rows.length} records shown`}
          </p>
        </div>

        <span>
          <button
            onClick={
              refresh
            }
          >
            <RefreshCw />

            Refresh
          </button>

          {resource === "students" && canManage && (
            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  "/portal/bulk-students?mode=legacy_students",
                )
              }
            >
              <Users />

              Bulk register
            </button>
          )}
          {resource === "classes" && canManage && (
            <button
              type="button"
              onClick={() =>
                setCategoryManagerOpen(
                  true,
                )
              }
            >
              <Settings />
              Manage categories
            </button>
          )}

          {canCreate && (
            <button
              className="primary"
              onClick={() => {
                if (resource === "students") {
                  setManualRegistrationOpen(true);
                } else {
                  create();
                }
              }}
            >
              <Plus />

              {resource === "guardians"
                ? "Add guardian"
                : resource === "students"
                  ? "Register manually"
                  : resource === "enrolments"
                    ? "Enrol student"
                    : resource === "progress"
                      ? "Record progress"
                      : resource === "classes"
                        ? "Add class"
                        : "Add record"}
            </button>
          )}
        </span>
      </div>

      {statusNotice && (
        <div className={`records-notice ${statusNotice.type}`} role="status">
          <span>{statusNotice.text}</span>
          <button type="button" onClick={() => setStatusNotice(null)} aria-label="Dismiss notification">x</button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="record-tools">
          <label className="record-search">
            <span>
              Search
            </span>

            <input
              type="search"
              value={
                searchQuery
              }
              onChange={(event) =>
                setSearchQuery(
                  event.target
                    .value,
                )
              }
              placeholder={`Search ${portalNavLabel(resource, user).toLowerCase()}...`}
            />
          </label>

          {statusOptions.length > 1 && (
            <label className="record-filter">
              <span>
                Status
              </span>

              <select
                value={
                  statusFilter
                }
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value,
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>

                {statusOptions.map(
                  (status) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {nice(
                        status,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}

          {resource === "students" &&
            canManage &&
            missingGuardianCount > 0 && (
              <label className="record-archive-toggle guardian-filter-toggle">
                <input
                  type="checkbox"
                  checked={
                    missingGuardianOnly
                  }
                  onChange={(event) =>
                    setMissingGuardianOnly(
                      event.target.checked,
                    )
                  }
                />
                <span>
                  Missing guardian details only ({missingGuardianCount})
                </span>
              </label>
            )}

          {resource === "students" && classOptions.length > 0 && (
            <label className="record-filter">
              <span>Class / category</span>
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="all">All classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </label>
          )}

          {supportsArchive && canManage && (
            <label className="record-archive-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              <span>Show archived / inactive</span>
            </label>
          )}

          {(searchQuery ||
            statusFilter !==
              "all" ||
            classFilter !==
              "all" ||
            sortColumn ||
            showArchived ||
            missingGuardianOnly) && (
            <button
              type="button"
              className="record-clear"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setClassFilter("all");
                setSortColumn("");
                setSortDirection("asc");
                setShowArchived(false);
                setMissingGuardianOnly(false);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="empty">
            Loading records...
          </div>
        ) : rows.length ===
          0 ? (
          <div className="empty">
            <FileText />

            <b>
              No records yet
            </b>

            <p>
              {resource === "enrolments"
                ? "Use Enrol student to place an active student into a class."
                : resource === "progress"
                  ? "Use Record progress to add the first assessment."
                  : "Use Add record to create the first entry."}
            </p>
          </div>
        ) : visibleRows.length ===
          0 ? (
          <div className="empty">
            <FileText />

            <b>
              No matching records
            </b>

            <p>
              Clear the search or filter and try again.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {cols.map(
                  (column) => (
                    <th
                      key={
                        column
                      }
                    >
                      <button
                        type="button"
                        className="record-sort"
                        onClick={() =>
                          toggleSort(
                            column,
                          )
                        }
                        aria-label={`Sort by ${nice(column)}`}
                      >
                        {nice(
                          column,
                        )}

                        <span>
                          {sortColumn ===
                          column
                            ? sortDirection ===
                                "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                  ),
                )}

                {(canManage || canRecordProgress) && (
                  <th>
                    Action
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map(
                (
                  row,
                  index,
                ) => (
                  <tr
                    key={String(
                      row.id ??
                        index,
                    )}
                  >
                    {cols.map(
                      (
                        column,
                      ) => (
                        <td
                          key={
                            column
                          }
                        >
                          {column ===
                          "status" ? (
                            <em
                              className={`status ${String(
                                row[
                                  column
                                ] ??
                                  "",
                              )}`}
                            >
                              {nice(
                                String(
                                  row[
                                    column
                                  ] ??
                                    "-",
                                ),
                              )}
                            </em>
                          ) : column ===
                            "guardian_status" ? (
                            <em
                              className={`status ${Number(
                                row.guardian_missing ??
                                  0,
                              ) === 1
                                ? "pending"
                                : "active"}`}
                            >
                              {String(
                                row.guardian_status ??
                                  "-",
                              )}
                            </em>
                          ) : (
                            (
                              column ===
                                "name" ||
                              column ===
                                "student_name"
                            ) &&
                            openStudent &&
                            (
                              resource ===
                                "students"
                                ? row.id
                                : row.student_id
                            ) ? (
                              <button
                                type="button"
                                className="student-link"
                                onClick={() =>
                                  openStudent(
                                    resource ===
                                      "students"
                                      ? row.id
                                      : row.student_id,
                                  )
                                }
                              >
                                {String(
                                  row[
                                    column
                                  ] ??
                                    "-",
                                )}
                              </button>
                            ) : (
                              String(
                                row[
                                  column
                                ] ??
                                  "-",
                              )
                            )
                          )}
                        </td>
                      ),
                    )}

                    {(canManage || canRecordProgress) && (
                      <td>
                        {resource === "enrolments" ? (
                          <>
                            {String(
                              row.status ??
                                "",
                            ) ===
                              "active" && (
                              <button
                                type="button"
                                className="row-action"
                                onClick={() =>
                                  recordProgress(
                                    row,
                                  )
                                }
                              >
                                Record progress
                              </button>
                            )}

                            {canManage && (
                              <>
                                {String(
                                  row.status ??
                                    "",
                                ) ===
                                  "active" ? (
                                  <>
                                    <button
                                      type="button"
                                      className="row-action"
                                      onClick={() =>
                                        edit(
                                          row,
                                        )
                                      }
                                    >
                                      Transfer class
                                    </button>

                                    <button
                                      type="button"
                                      className="row-action"
                                      onClick={() =>
                                        openStatusDialog(
                                          row,
                                          "withdrawn",
                                        )
                                      }
                                    >
                                      Withdraw
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="row-action"
                                    onClick={() =>
                                      openStatusDialog(
                                        row,
                                      )
                                    }
                                  >
                                    Update status
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        ) : resource === "guardians" ? (
                          <button
                            type="button"
                            className="row-action"
                            onClick={() => edit(row)}
                          >
                            Edit guardian
                          </button>
                        ) : resource === "classes" ? (
                          <>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() => edit(row)}
                            >
                              Edit class
                            </button>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() => openStatusDialog(row)}
                            >
                              {String(row.status ?? "active") === "inactive"
                                ? "Reactivate"
                                : "Archive / status"}
                            </button>
                          </>
                        ) : resource === "staff" ? (
                          <>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() => edit(row)}
                            >
                              Edit profile
                            </button>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                openStatusDialog(row)
                              }
                            >
                              Update status
                            </button>

                            {user.role === "admin" && (
                              <button
                                type="button"
                                className="row-action danger-action"
                                disabled={String(row.id ?? "") === user.id}
                                title={
                                  String(row.id ?? "") === user.id
                                    ? "You cannot permanently delete your own account."
                                    : "Permanently delete this staff account"
                                }
                                onClick={() =>
                                  openStaffDeleteDialog(
                                    row,
                                  )
                                }
                              >
                                Delete account
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="row-action"
                            onClick={() =>
                              openStatusDialog(
                                row,
                              )
                            }
                          >
                            {resource ===
                            "applications"
                              ? "Review application"
                              : resource === "students"
                                ? "Archive / status"
                                : "Update status"}
                          </button>
                        )}

                        {resource === "students" &&
                          user.role === "admin" &&
                          Number(
                            row.guardian_missing ??
                              0,
                          ) === 1 && (
                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                window.location.assign(
                                  "/portal/bulk-students?mode=guardian_updates",
                                )
                              }
                            >
                              Add guardian details
                            </button>
                          )}

                        {resource === "students" && (
                          <button
                            type="button"
                            className="row-action danger-action"
                            onClick={() => openDeleteDialog(row)}
                          >
                            Delete student
                          </button>
                        )}

                        {resource ===
                          "applications" &&
                          String(
                            row.status ??
                            "",
                          ) ===
                            "accepted" && (

                          <>

                          <button
                            type="button"
                            className="row-action admission-letter-action"
                            onClick={() =>
                              window.open(
                                `/portal/admission-letter?id=${encodeURIComponent(
                                  String(
                                    row.id ??
                                    "",
                                  ),
                                )}`,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          >
                            Admission letter
                          </button>

                          <button
                            type="button"
                            className="row-action"
                            disabled={accessBusyId === String(row.id ?? "")}
                            onClick={() => resendParentAccess(row)}
                          >
                            {accessBusyId === String(row.id ?? "")
                              ? "Sending..."
                              : "Resend parent access"}
                          </button>

                          </>

                        )}
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {statusDialog && (
        <div className="modal">
          <div className="status-dialog">
            <header>
              <div>
                <small>
                  {resource === "enrolments"
                    ? "Class enrolment"
                    : "Record management"}
                </small>

                <h2>
                  {resource === "enrolments" &&
                  newStatus === "withdrawn"
                    ? "Withdraw student from class"
                    : "Update status"}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeStatusDialog
                }
                disabled={
                  statusBusy
                }
              >
                <X />
              </button>
            </header>

            <div className="status-dialog-body">
              <div className="status-current">
                <span>
                  Current status
                </span>

                <em
                  className={`status ${statusDialog.currentStatus}`}
                >
                  {nice(
                    statusDialog.currentStatus,
                  )}
                </em>
              </div>

              <label>
                New status

                <select
                  value={
                    newStatus
                  }
                  onChange={(event) =>
                    setNewStatus(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    statusBusy
                  }
                >
                  {resource ===
                  "applications" ? (
                    <>
                      {statusDialog.currentStatus ===
                        "submitted" && (
                        <>
                          <option value="accepted">
                            Accept and enrol
                          </option>

                          <option value="under_review">
                            Keep under review
                          </option>

                          <option value="waitlisted">
                            Waitlist
                          </option>

                          <option value="rejected">
                            Reject
                          </option>
                        </>
                      )}

                      {statusDialog.currentStatus ===
                        "under_review" && (
                        <>
                          <option value="accepted">
                            Accepted
                          </option>

                          <option value="waitlisted">
                            Waitlisted
                          </option>

                          <option value="rejected">
                            Rejected
                          </option>
                        </>
                      )}

                      {statusDialog.currentStatus ===
                        "waitlisted" && (
                        <>
                          <option value="under_review">
                            Under review
                          </option>

                          <option value="accepted">
                            Accepted
                          </option>

                          <option value="rejected">
                            Rejected
                          </option>
                        </>
                      )}

                      {(statusDialog.currentStatus ===
                        "accepted" ||
                        statusDialog.currentStatus ===
                          "rejected") && (
                        <option value="under_review">
                          Reopen for review
                        </option>
                      )}
                    </>
                  ) : resource ===
                    "enrolments" ? (
                    <>
                      <option value="active">
                        Active
                      </option>

                      <option value="pending">
                        Pending
                      </option>

                      <option value="completed">
                        Completed
                      </option>

                      <option value="withdrawn">
                        Withdrawn
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Archived / inactive
                      </option>

                      <option value="pending">
                        Pending
                      </option>

                      <option value="completed">
                        Completed
                      </option>
                    </>
                  )}
                </select>
              </label>

              {resource ===
                "applications" &&
                newStatus ===
                  "accepted" && (
                <label className="admission-class-field">
                  Class

                  <select
                    value={
                      admissionClassId
                    }
                    onChange={(event) =>
                      setAdmissionClassId(
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      statusBusy ||
                      admissionClassesLoading
                    }
                    required
                  >
                    <option value="">
                      {admissionClassesLoading
                        ? "Loading suitable classes..."
                        : "Select class"}
                    </option>

                    {admissionClasses.map(
                      (item) => {
                        const full =
                          item.enrolled >=
                          item.capacity;

                        return (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                            disabled={
                              full
                            }
                          >
                            {item.name}
                            {"  -  "}
                            {item.enrolled}/
                            {item.capacity}
                            {full
                              ? " (Full)"
                              : " places"}
                          </option>
                        );
                      },
                    )}
                  </select>

                  <small>
                    Accepting will activate the student and enrol them in this class in one step.
                  </small>
                </label>
              )}

              {resource ===
                "applications" && (
                <label>
                  Review note

                  <textarea
                    value={
                      statusNote
                    }
                    onChange={(event) =>
                      setStatusNote(
                        event.target
                          .value,
                      )
                    }
                    rows={4}
                  />
                </label>
              )}

              {statusError && (
                <output>
                  {statusError}
                </output>
              )}
            </div>

            <footer>
              <button
                type="button"
                onClick={
                  closeStatusDialog
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary"
                onClick={
                  saveStatus
                }
                disabled={
                  statusBusy
                }
              >
                {statusBusy
                  ? "Saving..."
                  : resource ===
                      "applications" &&
                    newStatus ===
                      "accepted"
                    ? "Accept & enrol"
                    : resource === "enrolments" &&
                        newStatus === "withdrawn"
                      ? "Confirm withdrawal"
                      : "Save status"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {deleteDialog && (
        <div className="modal">
          <div className="status-dialog delete-dialog">
            <header>
              <div>
                <small>
                  Student management
                </small>

                <h2>
                  Permanently delete student
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleteBusy}
                aria-label="Close"
              >
                <X />
              </button>
            </header>

            <div className="status-dialog-body">
              <p>
                You are about to permanently delete{" "}
                <strong>{deleteDialog.name}</strong>
                {deleteDialog.studentNumber
                  ? ` (${deleteDialog.studentNumber})`
                  : ""}
                .
              </p>

              <p className="delete-warning">
                This removes the student record and linked operational data, including admission links, enrolments, attendance, learning progress, fee agreements and invoices. Existing payment and receipt history is retained but detached from the student. Guardian and parent records are preserved because they may be shared with another student. This action cannot be undone.
              </p>

              {deleteDialog.studentNumber ? (
                <label className="delete-confirm-field">
                  <span>
                    Type{" "}
                    <strong>
                      {deleteDialog.studentNumber}
                    </strong>{" "}
                    to confirm
                  </span>

                  <input
                    value={deleteConfirmation}
                    onChange={(event) => {
                      setDeleteConfirmation(
                        event.target.value,
                      );

                      if (deleteError) {
                        setDeleteError("");
                      }
                    }}
                    placeholder={deleteDialog.studentNumber}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={deleteBusy}
                    autoFocus
                  />

                  <small>
                    The delete button is enabled only when the student number matches exactly.
                  </small>
                </label>
              ) : (
                <p className="delete-warning">
                  This student has no student number. Permanent deletion is blocked until the record has a student number that can be used for confirmation.
                </p>
              )}

              {deleteError && (
                <output>
                  {deleteError}
                </output>
              )}
            </div>

            <footer>
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleteBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteStudent}
                disabled={
                  deleteBusy ||
                  !deleteDialog.studentNumber ||
                  deleteConfirmation.trim() !==
                    deleteDialog.studentNumber
                }
              >
                {deleteBusy
                  ? "Deleting permanently..."
                  : "Delete permanently"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {staffDeleteDialog && (
        <div className="modal">
          <div className="status-dialog delete-dialog">
            <header>
              <div>
                <small>
                  Staff & access
                </small>

                <h2>
                  Delete account
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeStaffDeleteDialog
                }
                disabled={
                  staffDeleteBusy
                }
                aria-label="Close"
              >
                <X />
              </button>
            </header>

            <div className="status-dialog-body">
              <p>
                Permanently remove{" "}
                <strong>
                  {
                    staffDeleteDialog.name
                  }
                </strong>
                ?
              </p>

              <p className="delete-warning">
                Portal access will be permanently removed. Any class assigned to this teacher will become unassigned. Compliance and access-permission records for this account will be removed, while historical audit and communication records are preserved.
              </p>

              <label className="delete-confirm-field">
                <span>
                  Type{" "}
                  <strong>
                    {
                      staffDeleteDialog.email
                    }
                  </strong>{" "}
                  to confirm.
                </span>

                <input
                  type="text"
                  value={
                    staffDeleteConfirmation
                  }
                  onChange={(event) =>
                    setStaffDeleteConfirmation(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    staffDeleteBusy
                  }
                  autoComplete="off"
                />

                <small>
                  Use Inactive instead when a genuine member of staff has left and you want to retain their account record.
                </small>
              </label>

              {staffDeleteError && (
                <output>
                  {
                    staffDeleteError
                  }
                </output>
              )}
            </div>

            <footer>
              <button
                type="button"
                onClick={
                  closeStaffDeleteDialog
                }
                disabled={
                  staffDeleteBusy
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={
                  confirmDeleteStaff
                }
                disabled={
                  staffDeleteBusy ||
                  staffDeleteConfirmation
                    .trim()
                    .toLowerCase() !==
                    staffDeleteDialog.email
                      .trim()
                      .toLowerCase()
                }
              >
                {staffDeleteBusy
                  ? "Deleting..."
                  : "Permanently delete account"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {manualRegistrationOpen && (
        <ManualStudentRegistrationForm
          close={() => setManualRegistrationOpen(false)}
          saved={refresh}
        />
      )}
      {categoryManagerOpen && (
        <ClassCategoryManager
          close={() =>
            setCategoryManagerOpen(
              false,
            )
          }
          changed={
            refresh
          }
        />
      )}

    </section>
  );
}

function Reports({
  reports,
}: {
  reports:
    Record<
      string,
      Row[]
    >;
}) {
  function csvCell(
    value: unknown,
  ) {
    const text =
      String(
        value ??
          "",
      ).replaceAll(
        '"',
        '""',
      );

    return `"${text}"`;
  }

  function downloadCsv(
    filename: string,
    rows: Row[],
  ) {
    if (
      rows.length ===
      0
    ) {
      return;
    }

    const keys =
      Array.from(
        new Set(
          rows.flatMap(
            (row) =>
              Object.keys(
                row,
              ),
          ),
        ),
      );

    const csv = [
      keys
        .map(
          csvCell,
        )
        .join(","),

      ...rows.map(
        (row) =>
          keys
            .map(
              (key) =>
                csvCell(
                  row[
                    key
                  ],
                ),
            )
            .join(","),
      ),
    ].join(
      "\r\n",
    );

    const blob =
      new Blob(
        [
          "\ufeff",
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const link =
      document.createElement(
        "a",
      );

    link.href =
      url;

    link.download =
      filename;

    document.body.appendChild(
      link,
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url,
    );
  }

  function downloadAll() {
    const rows:
      Row[] = [];

    Object.entries(
      reports,
    ).forEach(
      ([
        reportName,
        reportRows,
      ]) => {
        reportRows.forEach(
          (row) => {
            rows.push({
              report:
                nice(
                  reportName,
                ),
              ...row,
            });
          },
        );
      },
    );

    downloadCsv(
      `bnmc-management-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  }

  const catalogue = [
    {
      key:
        "all_students",
      title:
        "All students",
      description:
        "Student number, class, guardian and current status.",
      icon:
        Users,
    },

    {
      key:
        "students_by_class",
      title:
        "Students by class",
      description:
        "Active class enrolments grouped for class administration.",
      icon:
        School,
    },

    {
      key:
        "missing_guardians",
      title:
        "Missing guardian details",
      description:
        "Active students who still need a linked guardian.",
      icon:
        UserCheck,
    },

    {
      key:
        "attendance_summary",
      title:
        "Attendance summary",
      description:
        "Present, absent, late and excused totals by class.",
      icon:
        ClipboardCheck,
    },

    {
      key:
        "outstanding_fees",
      title:
        "Outstanding fees",
      description:
        "Invoices with an unpaid balance, including amount outstanding.",
      icon:
        CreditCard,
    },

    {
      key:
        "staff_assignments",
      title:
        "Staff & class assignments",
      description:
        "Staff roles and the classes currently assigned to each account.",
      icon:
        GraduationCap,
    },
  ];

  const totalRows =
    catalogue.reduce(
      (
        total,
        report,
      ) =>
        total +
        (
          reports[
            report.key
          ]?.length ??
          0
        ),
      0,
    );

  return (
    <section className="records reports-simple">
      <div className="records-head">
        <div>
          <h1>
            Reports & exports
          </h1>

          <p>
            Download the information you need without working through large report tables.
          </p>
        </div>

        <span>
          <button
            type="button"
            onClick={
              downloadAll
            }
            disabled={
              totalRows ===
              0
            }
          >
            <FileText />

            Download all CSV
          </button>
        </span>
      </div>

      <div className="reports-simple-grid">
        {catalogue.map(
          (report) => {
            const Icon =
              report.icon;

            const rows =
              reports[
                report.key
              ] ??
              [];

            return (
              <section
                className="portal-card reports-simple-card"
                key={
                  report.key
                }
              >
                <div className="reports-simple-icon">
                  <Icon />
                </div>

                <div className="reports-simple-copy">
                  <h3>
                    {
                      report.title
                    }
                  </h3>

                  <p>
                    {
                      report.description
                    }
                  </p>

                  <small>
                    {rows.length}{" "}
                    {rows.length ===
                    1
                      ? "row"
                      : "rows"}{" "}
                    available
                  </small>
                </div>

                <button
                  type="button"
                  className="report-download"
                  disabled={
                    rows.length ===
                    0
                  }
                  onClick={() =>
                    downloadCsv(
                      `bnmc-${report.key.replaceAll("_", "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
                      rows,
                    )
                  }
                >
                  Download CSV
                </button>
              </section>
            );
          },
        )}
      </div>
    </section>
  );
}

function todayInputValue() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function EnrolmentForm({
  initial,
  close,
  saved,
}: {
  initial: Row | null;
  close: () => void;
  saved: () => void;
}) {
  const transferring =
    Boolean(
      initial?.id,
    );

  const [
    students,
    setStudents,
  ] = useState<Row[]>([]);

  const [
    classes,
    setClasses,
  ] = useState<Row[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    studentId,
    setStudentId,
  ] = useState(
    String(
      initial?.student_id ??
        "",
    ),
  );

  const [
    classId,
    setClassId,
  ] = useState("");

  const [
    enrolledAt,
    setEnrolledAt,
  ] = useState(
    todayInputValue(),
  );

  const [
    status,
    setStatus,
  ] = useState("active");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(
        "/api/v1/students",
        {
          cache:
            "no-store",
        },
      ),
      fetch(
        "/api/v1/classes",
        {
          cache:
            "no-store",
        },
      ),
    ])
      .then(async ([
        studentResponse,
        classResponse,
      ]) => {
        const studentResult =
          (await studentResponse
            .json()
            .catch(() => ({}))) as {
            data?: Row[];
            error?: string;
          };

        const classResult =
          (await classResponse
            .json()
            .catch(() => ({}))) as {
            data?: Row[];
            error?: string;
          };

        if (
          !studentResponse.ok
        ) {
          throw new Error(
            studentResult.error ??
              "Unable to load students.",
          );
        }

        if (
          !classResponse.ok
        ) {
          throw new Error(
            classResult.error ??
              "Unable to load classes.",
          );
        }

        if (cancelled) {
          return;
        }

        setStudents(
          (
            studentResult.data ??
            []
          ).filter(
            (row) =>
              String(
                row.status ??
                  "",
              ) ===
              "active",
          ),
        );

        setClasses(
          classResult.data ??
            [],
        );
      })
      .catch(
        (reason) => {
          if (
            !cancelled
          ) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to prepare the enrolment form.",
            );
          }
        },
      )
      .finally(() => {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      });

    return () => {
      cancelled =
        true;
    };
  }, []);

  const selectedStudent =
    useMemo(
      () =>
        students.find(
          (row) =>
            String(
              row.id ??
                "",
            ) ===
            studentId,
        ) ??
        (
          transferring
            ? {
                id:
                  initial
                    ?.student_id,
                name:
                  initial
                    ?.student_name,
                student_number:
                  initial
                    ?.student_number,
              }
            : null
        ),
      [
        students,
        studentId,
        transferring,
        initial,
      ],
    );

  const selectedGender =
    String(
      selectedStudent
        ?.gender ??
        "",
    )
      .trim()
      .toLowerCase();

  const availableClasses =
    useMemo(
      () =>
        classes.filter(
          (row) => {
            const statusValue =
              String(
                row.status ??
                  "",
              );

            if (
              statusValue !==
              "active"
            ) {
              return false;
            }

            if (
              transferring &&
              String(
                row.id ??
                  "",
              ) ===
                String(
                  initial
                    ?.class_id ??
                    "",
                )
            ) {
              return false;
            }

            const className =
              String(
                row.name ??
                  "",
              );

            if (
              [
                "male",
                "female",
              ].includes(
                selectedGender,
              ) &&
              !className
                .toLowerCase()
                .includes(
                  `(${selectedGender})`,
                )
            ) {
              return false;
            }

            return true;
          },
        ),
      [
        classes,
        selectedGender,
        transferring,
        initial,
      ],
    );

  const filteredStudents =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return students;
        }

        return students.filter(
          (row) =>
            [
              row.name,
              row.student_number,
              row.first_name,
              row.last_name,
            ].some(
              (value) =>
                String(
                  value ??
                    "",
                )
                  .toLowerCase()
                  .includes(
                    query,
                  ),
            ),
        );
      },
      [
        students,
        search,
      ],
    );

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !studentId
    ) {
      setError(
        "Please select a student.",
      );
      return;
    }

    if (
      !classId
    ) {
      setError(
        transferring
          ? "Please select the new class."
          : "Please select a class.",
      );
      return;
    }

    setBusy(
      true,
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/v1/enrolments",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                studentId,
                classId,
                enrolledAt,
                status:
                  transferring
                    ? "active"
                    : status,
                ...(transferring
                  ? {
                      transferFromId:
                        initial
                          ?.id,
                    }
                  : {}),
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(() => ({}))) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            (transferring
              ? "Unable to transfer the student."
              : "Unable to enrol the student."),
        );
        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  const studentDisplayName =
    String(
      selectedStudent
        ?.name ??
        initial
          ?.student_name ??
        "",
    ) ||
    [
      selectedStudent
        ?.first_name,
      selectedStudent
        ?.last_name,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="modal">
      <form
        className="task-form enrolment-form"
        onSubmit={
          submit
        }
      >
        <header>
          <div>
            <small>
              Class placement
            </small>

            <h2>
              {transferring
                ? "Transfer student"
                : "Enrol student"}
            </h2>

            <p>
              {transferring
                ? "Move the student to another suitable BNMC class without editing database IDs."
                : "Select an active student and an appropriate class. Capacity and gender rules are checked automatically."}
            </p>
          </div>

          <button
            type="button"
            onClick={
              close
            }
            disabled={
              busy
            }
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        <div className="task-form-body">
          {loading ? (
            <div className="form-loading">
              <RefreshCw />
              Loading students and classes...
            </div>
          ) : (
            <div className="form-grid">
              {transferring ? (
                <div className="task-summary-card full-width">
                  <span>
                    Student
                  </span>
                  <strong>
                    {studentDisplayName ||
                      "Student"}
                  </strong>
                  <small>
                    {String(
                      initial
                        ?.student_number ??
                        "",
                    )}
                    {initial
                      ?.class_name
                      ? ` • Current class: ${String(
                          initial.class_name,
                        )}`
                      : ""}
                  </small>
                </div>
              ) : (
                <>
                  <label className="full-width">
                    Find student
                    <input
                      type="search"
                      value={
                        search
                      }
                      onChange={(event) =>
                        setSearch(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Search by student name or registration number"
                    />
                  </label>

                  <label className="full-width">
                    Student
                    <select
                      value={
                        studentId
                      }
                      onChange={(event) => {
                        setStudentId(
                          event.target
                            .value,
                        );
                        setClassId(
                          "",
                        );
                      }}
                      required
                    >
                      <option value="">
                        Select student
                      </option>

                      {filteredStudents.map(
                        (student) => {
                          const name =
                            String(
                              student.name ??
                                "",
                            ) ||
                            [
                              student.first_name,
                              student.last_name,
                            ]
                              .filter(
                                Boolean,
                              )
                              .join(
                                " ",
                              );

                          return (
                            <option
                              key={String(
                                student.id,
                              )}
                              value={String(
                                student.id,
                              )}
                            >
                              {name}
                              {student.student_number
                                ? ` — ${String(
                                    student.student_number,
                                  )}`
                                : ""}
                            </option>
                          );
                        },
                      )}
                    </select>
                  </label>
                </>
              )}

              <label className="full-width">
                {transferring
                  ? "New class"
                  : "Class"}

                <select
                  value={
                    classId
                  }
                  onChange={(event) =>
                    setClassId(
                      event.target
                        .value,
                    )
                  }
                  required
                  disabled={
                    !studentId
                  }
                >
                  <option value="">
                    {!studentId
                      ? "Select a student first"
                      : transferring
                        ? "Select destination class"
                        : "Select class"}
                  </option>

                  {availableClasses.map(
                    (classRow) => {
                      const enrolled =
                        Number(
                          classRow.enrolled ??
                            0,
                        );

                      const capacity =
                        Number(
                          classRow.capacity ??
                            0,
                        );

                      const full =
                        capacity > 0 &&
                        enrolled >=
                          capacity;

                      return (
                        <option
                          key={String(
                            classRow.id,
                          )}
                          value={String(
                            classRow.id,
                          )}
                          disabled={
                            full
                          }
                        >
                          {String(
                            classRow.name ??
                              "Class",
                          )}
                          {" — "}
                          {enrolled}/
                          {capacity}
                          {full
                            ? " (Full)"
                            : " students"}
                        </option>
                      );
                    },
                  )}
                </select>

                <small>
                  Only active classes suitable for the selected student's gender are shown.
                </small>
              </label>

              <label>
                Enrolment date
                <input
                  type="date"
                  value={
                    enrolledAt
                  }
                  onChange={(event) =>
                    setEnrolledAt(
                      event.target
                        .value,
                    )
                  }
                  required
                />
              </label>

              {!transferring && (
                <label>
                  Status
                  <select
                    value={
                      status
                    }
                    onChange={(event) =>
                      setStatus(
                        event.target
                          .value,
                      )
                    }
                    required
                  >
                    <option value="active">
                      Active
                    </option>
                    <option value="pending">
                      Pending
                    </option>
                  </select>
                </label>
              )}
            </div>
          )}

          {studentId &&
            availableClasses.length ===
              0 &&
            !loading && (
              <div className="records-notice info">
                No suitable active class currently has availability for this student.
              </div>
            )}

          {error && (
            <output>
              {error}
            </output>
          )}
        </div>

        <footer>
          <button
            type="button"
            onClick={
              close
            }
            disabled={
              busy
            }
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy ||
              loading ||
              !studentId ||
              !classId
            }
          >
            {busy
              ? transferring
                ? "Transferring..."
                : "Enrolling..."
              : transferring
                ? "Transfer student"
                : "Save enrolment"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ProgressAssessmentForm({
  user,
  initial,
  close,
  saved,
}: {
  user: User;
  initial: Row | null;
  close: () => void;
  saved: () => void;
}) {
  const [
    enrolments,
    setEnrolments,
  ] = useState<Row[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const initialPair =
    initial?.student_id &&
    initial?.class_id
      ? `${String(
          initial.student_id,
        )}::${String(
          initial.class_id,
        )}`
      : "";

  const [
    pairKey,
    setPairKey,
  ] = useState(
    initialPair,
  );

  const [
    strand,
    setStrand,
  ] = useState("");

  const [
    assessedAt,
    setAssessedAt,
  ] = useState(
    todayInputValue(),
  );

  useEffect(() => {
    let cancelled = false;

    fetch(
      "/api/v1/enrolments",
      {
        cache:
          "no-store",
      },
    )
      .then(
        async (response) => {
          const result =
            (await response
              .json()
              .catch(() => ({}))) as {
              data?: Row[];
              error?: string;
            };

          if (!response.ok) {
            throw new Error(
              result.error ??
                "Unable to load class rosters.",
            );
          }

          if (cancelled) {
            return;
          }

          const active =
            (
              result.data ??
              []
            ).filter(
              (row) =>
                String(
                  row.status ??
                    "",
                ) ===
                "active",
            );

          setEnrolments(
            active,
          );

          if (
            initialPair &&
            !active.some(
              (row) =>
                `${String(
                  row.student_id,
                )}::${String(
                  row.class_id,
                )}` ===
                initialPair,
            )
          ) {
            setPairKey(
              "",
            );
          }
        },
      )
      .catch(
        (reason) => {
          if (
            !cancelled
          ) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to prepare the progress form.",
            );
          }
        },
      )
      .finally(() => {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      });

    return () => {
      cancelled =
        true;
    };
  }, [
    initialPair,
  ]);

  const filteredEnrolments =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return enrolments;
        }

        return enrolments.filter(
          (row) =>
            [
              row.student_name,
              row.student_number,
              row.class_name,
            ].some(
              (value) =>
                String(
                  value ??
                    "",
                )
                  .toLowerCase()
                  .includes(
                    query,
                  ),
            ),
        );
      },
      [
        enrolments,
        search,
      ],
    );

  const selectedEnrolment =
    enrolments.find(
      (row) =>
        `${String(
          row.student_id,
        )}::${String(
          row.class_id,
        )}` ===
        pairKey,
    ) ??
    (
      initialPair ===
      pairKey
        ? initial
        : null
    );

  const className =
    String(
      selectedEnrolment
        ?.class_name ??
        "",
    );

  const learningAreas =
    useMemo(
      () => {
        if (
          /category\s*1/i.test(
            className,
          )
        ) {
          return [
            "Arabic alphabet recognition",
            "Makharij / pronunciation",
            "Joining letters",
            "Nurul Bayan",
            "Memorisation",
          ];
        }

        if (
          /category\s*2/i.test(
            className,
          )
        ) {
          return [
            "Qur'an recitation",
            "Tajweed",
            "Fluency",
            "Jannat Al Quran",
            "Memorisation",
          ];
        }

        if (
          /category\s*3/i.test(
            className,
          )
        ) {
          return [
            "Qur'an memorisation",
            "Tajweed",
            "Revision",
            "Fluency",
            "Individual Hifz progress",
          ];
        }

        return [
          "Qur'an learning",
          "Tajweed",
          "Memorisation",
          "Revision",
        ];
      },
      [
        className,
      ],
    );

  useEffect(() => {
    if (
      strand &&
      !learningAreas.includes(
        strand,
      )
    ) {
      setStrand("");
    }
  }, [
    learningAreas,
    strand,
  ]);

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formData =
      new FormData(
        event.currentTarget,
      );

    const [
      studentId,
      classId,
    ] =
      pairKey.split(
        "::",
      );

    if (
      !studentId ||
      !classId
    ) {
      setError(
        "Please select a student from the active class roster.",
      );
      return;
    }

    setBusy(
      true,
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/v1/progress",
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                studentId,
                classId,
                strand,
                currentUnit:
                  String(
                    formData.get(
                      "currentUnit",
                    ) ??
                      "",
                  ),
                achievement:
                  String(
                    formData.get(
                      "achievement",
                    ) ??
                      "",
                  ),
                score:
                  String(
                    formData.get(
                      "score",
                    ) ??
                      "",
                  ),
                teacherComment:
                  String(
                    formData.get(
                      "teacherComment",
                    ) ??
                      "",
                  ),
                nextStep:
                  String(
                    formData.get(
                      "nextStep",
                    ) ??
                      "",
                  ),
                assessedAt,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(() => ({}))) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to save this progress assessment.",
        );
        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="modal">
      <form
        className="task-form progress-form"
        onSubmit={
          submit
        }
      >
        <header>
          <div>
            <small>
              Student learning
            </small>

            <h2>
              Record progress
            </h2>

            <p>
              Record today's Qur'an learning, achievement and the student's next step.
            </p>
          </div>

          <button
            type="button"
            onClick={
              close
            }
            disabled={
              busy
            }
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        <div className="task-form-body">
          {loading ? (
            <div className="form-loading">
              <RefreshCw />
              Loading your active class roster...
            </div>
          ) : (
            <div className="form-grid">
              <label className="full-width">
                Find student
                <input
                  type="search"
                  value={
                    search
                  }
                  onChange={(event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search by student name, registration number or class"
                />
              </label>

              <label className="full-width">
                Student
                <select
                  value={
                    pairKey
                  }
                  onChange={(event) => {
                    setPairKey(
                      event.target
                        .value,
                    );
                    setStrand(
                      "",
                    );
                  }}
                  required
                >
                  <option value="">
                    Select student
                  </option>

                  {filteredEnrolments.map(
                    (row) => (
                      <option
                        key={`${String(
                          row.student_id,
                        )}::${String(
                          row.class_id,
                        )}`}
                        value={`${String(
                          row.student_id,
                        )}::${String(
                          row.class_id,
                        )}`}
                      >
                        {String(
                          row.student_name ??
                            "Student",
                        )}
                        {row.student_number
                          ? ` — ${String(
                              row.student_number,
                            )}`
                          : ""}
                        {" — "}
                        {String(
                          row.class_name ??
                            "Class",
                        )}
                      </option>
                    ),
                  )}
                </select>

                <small>
                  {user.role ===
                  "teacher"
                    ? "Only students in classes assigned to you are available."
                    : "Students are selected from active enrolments."}
                </small>
              </label>

              {selectedEnrolment && (
                <div className="task-summary-card full-width">
                  <span>
                    Class
                  </span>
                  <strong>
                    {String(
                      selectedEnrolment
                        .class_name ??
                        "Class",
                    )}
                  </strong>
                  <small>
                    Class is populated automatically from the student's active enrolment.
                  </small>
                </div>
              )}

              <label>
                Assessment date
                <input
                  type="date"
                  value={
                    assessedAt
                  }
                  onChange={(event) =>
                    setAssessedAt(
                      event.target
                        .value,
                    )
                  }
                  required
                />
              </label>

              <label>
                Learning area
                <select
                  value={
                    strand
                  }
                  onChange={(event) =>
                    setStrand(
                      event.target
                        .value,
                    )
                  }
                  required
                  disabled={
                    !pairKey
                  }
                >
                  <option value="">
                    {pairKey
                      ? "Select learning area"
                      : "Select a student first"}
                  </option>

                  {learningAreas.map(
                    (area) => (
                      <option
                        key={
                          area
                        }
                        value={
                          area
                        }
                      >
                        {area}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Current level / unit
                <input
                  name="currentUnit"
                  required
                  placeholder="e.g. Suratun-Nas, page 12, letters Ba-Ta"
                />
              </label>

              <label>
                Achievement
                <select
                  name="achievement"
                  required
                  defaultValue=""
                >
                  <option
                    value=""
                    disabled
                  >
                    Select achievement
                  </option>
                  <option value="emerging">
                    Emerging
                  </option>
                  <option value="developing">
                    Developing
                  </option>
                  <option value="secure">
                    Secure
                  </option>
                  <option value="mastered">
                    Mastered
                  </option>
                </select>
              </label>

              <label>
                Score (optional)
                <input
                  name="score"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0–100"
                />
              </label>

              <label className="full-width">
                Teacher comment
                <textarea
                  name="teacherComment"
                  rows={3}
                  placeholder="Brief observation on today's learning"
                />
              </label>

              <label className="full-width">
                Next step
                <textarea
                  name="nextStep"
                  rows={3}
                  placeholder="What should the student practise or work on next?"
                />
              </label>
            </div>
          )}

          {!loading &&
            enrolments.length ===
              0 && (
              <div className="records-notice info">
                No active students are available in your class roster.
              </div>
            )}

          {error && (
            <output>
              {error}
            </output>
          )}
        </div>

        <footer>
          <button
            type="button"
            onClick={
              close
            }
            disabled={
              busy
            }
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy ||
              loading ||
              !pairKey ||
              !strand
            }
          >
            {busy
              ? "Saving assessment..."
              : "Save assessment"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function formInitialValue(
  row: Row,
  fieldName: string,
) {
  const databaseFields: Record<string, string> = {
    fullName: "full_name",
    displayName: "display_name",
    emergencyContactNumber: "emergency_contact_number",
    teacherId: "teacher_id",
    categoryId: "category_id",
    dayOfWeek: "day_of_week",
    startTime: "start_time",
    endTime: "end_time",
  };

  return String(
    row[databaseFields[fieldName] ?? fieldName] ?? "",
  );
}

function CreateForm({
  resource,
  initial,
  close,
  saved,
}: {
  resource: string;
  initial: Row | null;
  close: () => void;
  saved: () => void;
}) {
  const [
    error,
    setError,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [teacherOptions, setTeacherOptions] = useState<Row[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Row[]>([]);
  const [guardianStudentOptions, setGuardianStudentOptions] = useState<Row[]>([]);

  const initialStaffRoles =
    resource === "staff" && initial
      ? String(
          initial.roles ??
            initial.staff_role ??
            initial.role ??
            "",
        )
          .split(",")
          .map((value) =>
            value.trim().toLowerCase(),
          )
          .filter(
            (value) =>
              ["admin", "teacher", "finance", "safeguarding"].includes(
                value,
              ),
          )
      : [];

  useEffect(() => {
    if (
      resource !==
        "guardians" ||
      initial
    ) {
      return;
    }

    fetch(
      "/api/v1/students",
      {
        cache:
          "no-store",
      },
    )
      .then(
        async (
          response,
        ) => {
          const result =
            (await response
              .json()
              .catch(
                () => ({}),
              )) as {
              data?: Row[];
            };

          if (
            response.ok
          ) {
            const activeStudents =
              (
                result.data ??
                []
              ).filter(
                (row) =>
                  String(
                    row.status ??
                      "active",
                  ).toLowerCase() !==
                  "inactive",
              );

            const guardianResponse =
              await fetch(
                "/api/v1/guardians",
                {
                  cache:
                    "no-store",
                },
              );

            const guardianResult =
              (await guardianResponse
                .json()
                .catch(
                  () => ({}),
                )) as {
                data?: Row[];
              };

            /*
             * Guardian rows expose their linked children in the normal
             * guardians resource response. Build a set of student IDs
             * which already have at least one guardian and exclude them
             * from the "Add guardian" selector.
             *
             * This keeps the manual Add Guardian workflow focused only on
             * students who have no guardian record yet. Existing guardian
             * records can still be edited from the Guardians table.
             */
            const studentsWithGuardian =
              new Set<string>();

            if (
              guardianResponse.ok
            ) {
              for (
                const guardian of
                  guardianResult.data ??
                  []
              ) {
                const children =
                  guardian.children_details;

                if (
                  Array.isArray(
                    children,
                  )
                ) {
                  for (
                    const child of
                      children as Row[]
                  ) {
                    const childId =
                      String(
                        child.student_id ??
                          child.id ??
                          "",
                      ).trim();

                    if (
                      childId
                    ) {
                      studentsWithGuardian.add(
                        childId,
                      );
                    }
                  }
                }

                const linkedStudentIds =
                  guardian.student_ids;

                if (
                  Array.isArray(
                    linkedStudentIds,
                  )
                ) {
                  for (
                    const childId of
                      linkedStudentIds
                  ) {
                    const id =
                      String(
                        childId ??
                          "",
                      ).trim();

                    if (
                      id
                    ) {
                      studentsWithGuardian.add(
                        id,
                      );
                    }
                  }
                }
              }
            }

            setGuardianStudentOptions(
              activeStudents
                .filter(
                  (row) =>
                    !studentsWithGuardian.has(
                      String(
                        row.id ??
                          "",
                      ),
                    ),
                )
                .sort(
                  (
                    a,
                    b,
                  ) =>
                    String(
                      a.name ??
                        "",
                    ).localeCompare(
                      String(
                        b.name ??
                          "",
                      ),
                    ),
                ),
            );
          }
        },
      )
      .catch(
        () =>
          setGuardianStudentOptions(
            [],
          ),
      );
  }, [
    resource,
    initial,
  ]);

  useEffect(() => {
    if (resource !== "classes") {
      return;
    }

    Promise.all([
      fetch("/api/v1/staff", { cache: "no-store" }),
      fetch("/api/v1/class-categories", { cache: "no-store" }),
    ])
      .then(async ([staffResponse, categoryResponse]) => {
        const staffResult =
          (await staffResponse.json().catch(() => ({}))) as {
            data?: Row[];
          };

        const categoryResult =
          (await categoryResponse.json().catch(() => ({}))) as {
            data?: Row[];
          };

        if (staffResponse.ok) {
          setTeacherOptions(
            (staffResult.data ?? []).filter(
              (row) =>
                String(row.roles ?? row.role ?? "")
                  .toLowerCase()
                  .split(",")
                  .map((value) => value.trim())
                  .includes("teacher") &&
                String(row.status ?? "active").toLowerCase() === "active",
            ),
          );
        }

        if (categoryResponse.ok) {
          setCategoryOptions(
            (categoryResult.data ?? []).filter(
              (row) =>
                String(row.status ?? "active").toLowerCase() === "active",
            ),
          );
        }
      })
      .catch(() => {
        setTeacherOptions([]);
        setCategoryOptions([]);
      });
  }, [resource]);

  async function submit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(
      true,
    );

    setError("");

    const formData =
      new FormData(
        event.currentTarget,
      );

    const payload:
      Record<string, unknown> =
        Object.fromEntries(
          formData.entries(),
        );

    if (
      resource ===
      "staff"
    ) {
      const selectedRoles =
        formData
          .getAll("roles")
          .map(
            (value) =>
              String(value)
                .trim()
                .toLowerCase(),
          )
          .filter(Boolean);

      if (!selectedRoles.length) {
        setBusy(false);
        setError(
          "Select at least one staff role.",
        );
        return;
      }

      payload.roles =
        selectedRoles;

      // Keep a single role value for transitional compatibility
      // with older endpoints while the backend uses user_roles.
      payload.role =
        selectedRoles[0];
    }

    if (
      resource ===
      "classes"
    ) {
      const className =
        String(
          payload.name ??
            "",
        )
          .replace(/\s+/g, " ")
          .trim();

      if (!className) {
        setBusy(false);
        setError(
          "Enter a class name.",
        );
        return;
      }

      if (
        !String(
          payload.categoryId ??
            "",
        ).trim()
      ) {
        setBusy(false);
        setError(
          "Select a category.",
        );
        return;
      }

      payload.name =
        className;

      payload.startTime =
        String(payload.startTime ?? "09:30") || "09:30";

      payload.endTime =
        String(payload.endTime ?? "11:30") || "11:30";
    }

    try {
      const editing =
        ["guardians", "staff", "classes"].includes(resource) &&
        Boolean(initial?.id);

      if (editing) {
        payload.id = initial?.id;
      }

      const response =
        await fetch(
          `/api/v1/${resource}`,
          {
            method:
              editing
                ? "PATCH"
                : "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const result =
        (await response.json()) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        setError(
          result.error ??
            "Unable to save",
        );

        return;
      }

      saved();
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <div className="modal">
      <form
        onSubmit={
          submit
        }
      >
        <header>
          <div>
            <small>
              {initial
                ? resource === "staff"
                  ? "Update staff profile"
                  : resource === "classes"
                    ? "Update class"
                    : "Update guardian record"
                : resource === "guardians"
                  ? "Add guardian to student"
                  : "New database record"}
            </small>

            <h2>
              {initial
                ? resource === "staff"
                  ? "Edit staff profile"
                  : resource === "classes"
                    ? "Edit class"
                    : "Edit guardian"
                : resource === "classes"
                  ? "Add class"
                  : resource === "guardians"
                    ? "Add guardian details"
                    : `Add ${nice(resource)}`}
            </h2>
          </div>

          <button
            type="button"
            onClick={
              close
            }
          >
            <X />
          </button>
        </header>

        <div
          className={`form-grid${
            resource === "staff"
              ? " staff-form-grid"
              : ""
          }`}
        >
          {resource ===
            "guardians" &&
            !initial && (
            <>
              <label className="guardian-student-link-field">
                Student

                <select
                  name="studentId"
                  required
                  defaultValue=""
                >
                  <option
                    value=""
                    disabled
                  >
                    {guardianStudentOptions.length
                      ? "Select student"
                      : "No students without guardian records"}
                  </option>

                  {guardianStudentOptions.map(
                    (
                      student,
                    ) => (
                      <option
                        key={String(
                          student.id ??
                            "",
                        )}
                        value={String(
                          student.id ??
                            "",
                        )}
                      >
                        {String(
                          student.name ??
                            `${student.first_name ?? ""} ${student.last_name ?? ""}`,
                        ).trim()}
                        {" · "}
                        {String(
                          student.student_number ??
                            "",
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="guardian-primary-checkbox">
                <input
                  type="checkbox"
                  name="isPrimary"
                  value="true"
                  defaultChecked
                />

                <span>
                  <strong>
                    Set as primary guardian
                  </strong>

                  <small>
                    If this student already has a primary guardian, the existing guardian remains linked but will become secondary.
                  </small>
                </span>
              </label>
            </>
          )}

          {fields[resource].map((field) => {
            if (
              resource === "staff" &&
              field.name === "role" &&
              field.options
            ) {
              return (
                <fieldset
                  key={field.name}
                  className="staff-roles-field"
                >
                  <legend>Staff roles</legend>

                  <p>
                    Select every role this person should have.
                    Existing parent access is kept automatically.
                  </p>

                  <div className="staff-role-options">
                    {field.options.map((option) => (
                      <label
                        key={option.value}
                        className="staff-role-option"
                      >
                        <input
                          type="checkbox"
                          name="roles"
                          value={option.value}
                          defaultChecked={
                            initial
                              ? initialStaffRoles.includes(option.value)
                              : false
                          }
                        />

                        <span>
                          <strong>{option.label}</strong>
                          <small>
                            {option.value === "teacher"
                              ? "Teaching, classes, attendance and progress"
                              : option.value === "finance"
                                ? "Fees, payments and finance workflows"
                                : option.value === "safeguarding"
                                  ? "Safeguarding and compliance access"
                                  : "Full administration access"}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            }

            return (
              <label
                key={field.name}
                className={
                  resource === "staff" && field.name === "password"
                    ? "staff-password-field"
                    : undefined
                }
              >
                {field.label}

                {resource === "classes" && field.name === "categoryId" ? (
                  <select
                    name={field.name}
                    required
                    defaultValue={initial ? formInitialValue(initial, field.name) : ""}
                  >
                    <option value="" disabled>
                      Select category
                    </option>

                    {categoryOptions.map((category) => (
                      <option
                        key={String(category.id ?? category.name)}
                        value={String(category.id ?? "")}
                      >
                        {String(category.name ?? "Category")}
                      </option>
                    ))}
                  </select>
                ) : resource === "classes" && field.name === "teacherId" ? (
                  <select
                    name={field.name}
                    defaultValue={initial ? formInitialValue(initial, field.name) : ""}
                  >
                    <option value="">Unassigned</option>
                    {teacherOptions.map((teacher) => (
                      <option
                        key={String(teacher.id ?? teacher.email)}
                        value={String(teacher.id ?? "")}
                      >
                        {String(teacher.display_name ?? teacher.email ?? "Teacher")}
                      </option>
                    ))}
                  </select>
                ) : field.options ? (
                  <select
                    name={field.name}
                    required={field.required}
                    defaultValue={
                      initial
                        ? field.name === "role" &&
                          formInitialValue(initial, field.name) === "staff"
                          ? "teacher"
                          : formInitialValue(initial, field.name)
                        : ""
                    }
                  >
                    <option value="" disabled>
                      Select {field.label.toLowerCase()}
                    </option>

                    {field.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.name}
                    type={field.type ?? "text"}
                    required={
                      field.required &&
                      !(
                        resource === "staff" &&
                        Boolean(initial) &&
                        field.name === "password"
                      )
                    }
                    placeholder={
                      resource === "staff" && field.name === "password"
                        ? initial
                          ? "Leave blank to keep the current password"
                          : "Required only when creating a new portal account"
                        : resource === "classes" && field.name === "name"
                          ? "e.g. Category 1A (Female)"
                          : undefined
                    }
                    defaultValue={
                      initial && field.name !== "password"
                        ? formInitialValue(initial, field.name)
                        : ""
                    }
                  />
                )}

                {resource === "staff" && field.name === "password" && (
                  <small className="staff-field-help">
                    If this email already has a portal account, its current password is retained.
                  </small>
                )}
              </label>
            );
          })}
        </div>

        {error && (
          <output>
            {error}
          </output>
        )}

        <footer>
          <button
            type="button"
            onClick={
              close
            }
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy
            }
          >
            {busy
              ? "Saving..."
              : initial
                ? "Save changes"
                : "Save record"}
          </button>
        </footer>
      </form>
    </div>
  );
}

