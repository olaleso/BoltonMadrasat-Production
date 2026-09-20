"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

import "./attendance.css";

type Row =
  Record<
    string,
    unknown
  >;

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

export default function AttendancePage() {

  const [
    classes,
    setClasses,
  ] =
    useState<Row[]>(
      [],
    );

  const [
    classId,
    setClassId,
  ] =
    useState("");

  const [
    sessionDate,
    setSessionDate,
  ] =
    useState(
      today(),
    );

  const [
    students,
    setStudents,
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
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    updating,
    setUpdating,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const loadClasses =
    useCallback(
      async () => {

        setLoading(
          true,
        );

        setError("");

        try {

          const response =
            await fetch(
              "/api/v1/attendance-register",
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
              classes?: Row[];
              error?: string;
            };

          if (
            !response.ok
          ) {

            setError(
              result.error ??
              "Unable to load classes.",
            );

            return;
          }

          const rows =
            result.classes ??
            [];

          setClasses(
            rows,
          );

          if (
            rows.length >
            0
          ) {

            setClassId(
              String(
                rows[0].id,
              ),
            );

          }

        }
        catch {

          setError(
            "Unable to connect to the attendance service.",
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

  const loadRegister =
    useCallback(
      async () => {

        if (
          !classId ||
          !sessionDate
        ) {

          setStudents(
            [],
          );

          return;
        }

        setLoading(
          true,
        );

        setError("");

        try {

          const response =
            await fetch(
              `/api/v1/attendance-register?classId=${encodeURIComponent(
                classId,
              )}&sessionDate=${encodeURIComponent(
                sessionDate,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const result =
            (await response.json()) as {
              students?: Row[];
              error?: string;
            };

          if (
            !response.ok
          ) {

            setError(
              result.error ??
              "Unable to load register.",
            );

            setStudents(
              [],
            );

            return;
          }

          setStudents(
            result.students ??
            [],
          );

        }
        catch {

          setError(
            "Unable to load the attendance register.",
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
        sessionDate,
      ],
    );

  useEffect(
    () => {

      loadClasses();

    },
    [
      loadClasses,
    ],
  );

  useEffect(
    () => {

      if (
        classId
      ) {

        loadRegister();

      }

    },
    [
      classId,
      sessionDate,
      loadRegister,
    ],
  );

  useEffect(
    () => {

      if (
        !message
      ) {
        return;
      }

      const timer =
        window.setTimeout(
          () =>
            setMessage(
              "",
            ),
          6000,
        );

      return () =>
        window.clearTimeout(
          timer,
        );

    },
    [
      message,
    ],
  );

  async function markAllPresent() {

    if (
      !classId ||
      !sessionDate
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError("");
    setMessage("");

    try {

      const response =
        await fetch(
          "/api/v1/attendance-register",
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
                  "mark-all-present",

                classId,

                sessionDate,
              }),
          },
        );

      const result =
        (await response.json()) as {
          updated?: number;
          error?: string;
        };

      if (
        !response.ok
      ) {

        setError(
          result.error ??
          "Unable to mark the class present.",
        );

        return;
      }

      const count =
        Number(
          result.updated ??
          0,
        );

      setMessage(
        `${count} student${
          count === 1
            ? ""
            : "s"
        } marked present. Change only the exceptions below.`,
      );

      await loadRegister();

    }
    catch {

      setError(
        "Unable to save attendance.",
      );

    }
    finally {

      setBusy(
        false,
      );

    }
  }

  async function updateStatus(
    studentId: string,
    status: string,
  ) {

    setUpdating(
      studentId,
    );

    setError("");

    try {

      const response =
        await fetch(
          "/api/v1/attendance-register",
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
                  "set-status",

                classId,

                sessionDate,

                studentId,

                status,
              }),
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
          "Unable to update attendance.",
        );

        return;
      }

      setStudents(
        (
          current,
        ) =>
          current.map(
            (
              student,
            ) =>
              String(
                student.student_id,
              ) ===
              studentId
                ? {
                    ...student,
                    status,
                  }
                : student,
          ),
      );

    }
    catch {

      setError(
        "Unable to update attendance.",
      );

    }
    finally {

      setUpdating(
        "",
      );

    }
  }

  const present =
    students.filter(
      (
        student,
      ) =>
        String(
          student.status ??
          "",
        ) ===
        "present",
    ).length;

  const absent =
    students.filter(
      (
        student,
      ) =>
        String(
          student.status ??
          "",
        ) ===
        "absent",
    ).length;

  const late =
    students.filter(
      (
        student,
      ) =>
        String(
          student.status ??
          "",
        ) ===
        "late",
    ).length;

  return (
    <main className="attendance-page">

      <header className="attendance-topbar">

        <Link
          href="/portal"
          className="attendance-brand"
        >

          <Image
            src="/community-logo.png"
            width={48}
            height={48}
            alt="BNMC Madrasah"
            priority
          />

          <span>

            <b>
              BNMC Madrasah
            </b>

            <small>
              Attendance Register
            </small>

          </span>

        </Link>

        <Link
          href="/portal"
          className="attendance-back"
        >

          <ArrowLeft />

          Back to portal

        </Link>

      </header>

      <section className="attendance-shell">

        <div className="attendance-heading">

          <div>

            <small>
              Classes & Attendance
            </small>

            <h1>
              Class register
            </h1>

            <p>
              Mark the whole class present with one click,
              then change only absent, late or excused students.
            </p>

          </div>

          <button
            type="button"
            className="mark-all"
            onClick={
              markAllPresent
            }
            disabled={
              busy ||
              !classId
            }
          >

            <CheckCircle2 />

            {busy
              ? "Marking..."
              : "Mark all present"}

          </button>

        </div>

        <section className="attendance-controls">

          <label>

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

              {classes.length ===
                0 && (

                <option value="">
                  No classes available
                </option>

              )}

              {classes.map(
                (
                  row,
                ) => (

                  <option
                    key={
                      String(
                        row.id,
                      )
                    }
                    value={
                      String(
                        row.id,
                      )
                    }
                  >
                    {String(
                      row.name,
                    )}
                  </option>

                ),
              )}

            </select>

          </label>

          <label>

            Register date

            <input
              type="date"
              value={
                sessionDate
              }
              onChange={(event) =>
                setSessionDate(
                  event.target.value,
                )
              }
            />

          </label>

          <div className="attendance-stats">

            <span>
              <b>
                {students.length}
              </b>

              <small>
                Students
              </small>
            </span>

            <span>
              <b>
                {present}
              </b>

              <small>
                Present
              </small>
            </span>

            <span>
              <b>
                {absent}
              </b>

              <small>
                Absent
              </small>
            </span>

            <span>
              <b>
                {late}
              </b>

              <small>
                Late
              </small>
            </span>

          </div>

        </section>

        {message && (

          <div className="attendance-success">
            {message}
          </div>

        )}

        {error && (

          <div className="attendance-error">
            {error}
          </div>

        )}

        {loading ? (

          <div className="attendance-empty">

            <RefreshCw />

            Loading register...

          </div>

        ) : students.length ===
          0 ? (

          <div className="attendance-empty">

            <ClipboardCheck />

            <b>
              No students enrolled
            </b>

            <p>
              Students must be actively enrolled in this class before attendance can be taken.
            </p>

          </div>

        ) : (

          <div className="attendance-table">

            <table>

              <thead>

                <tr>

                  <th>
                    Student
                  </th>

                  <th>
                    Student number
                  </th>

                  <th>
                    Attendance
                  </th>

                </tr>

              </thead>

              <tbody>

                {students.map(
                  (
                    student,
                  ) => {

                    const studentId =
                      String(
                        student.student_id,
                      );

                    const status =
                      String(
                        student.status ??
                        "unmarked",
                      );

                    return (

                      <tr
                        key={
                          studentId
                        }
                      >

                        <td>
                          <b>
                            {String(
                              student.student_name ??
                              "-",
                            )}
                          </b>
                        </td>

                        <td>
                          {String(
                            student.student_number ??
                            "-",
                          )}
                        </td>

                        <td>

                          <select
                            className={
                              `attendance-status ${status}`
                            }
                            value={
                              status
                            }
                            disabled={
                              updating ===
                              studentId
                            }
                            onChange={(event) =>
                              updateStatus(
                                studentId,
                                event.target.value,
                              )
                            }
                          >

                            <option
                              value="unmarked"
                              disabled
                            >
                              Not marked
                            </option>

                            <option value="present">
                              Present
                            </option>

                            <option value="absent">
                              Absent
                            </option>

                            <option value="late">
                              Late
                            </option>

                            <option value="excused">
                              Excused
                            </option>

                          </select>

                        </td>

                      </tr>

                    );
                  },
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </main>
  );
}