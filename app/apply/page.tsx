"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  CircleHelp,
  Mail,
  Phone,
} from "lucide-react";
import "./apply.css";

type ApplicationResponse = {
  ok?: boolean;
  error?: string;
  applicationId?: string;
  studentNumber?: string;
};

type ReviewValues = Record<string, string>;

const steps = [
  "Child details",
  "Guardian details",
  "Additional information",
  "Review & submit",
];

const ethnicGroups = [
  "Hausa",
  "Yoruba",
  "Igbo",
  "Edo",
  "Kogi",
  "Other",
  "Prefer not to say",
];

function valueOf(
  values: ReviewValues,
  key: string,
) {
  return values[key]?.trim() || "-";
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="apply-review-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function ApplyPage() {

  const formRef =
    useRef<HTMLFormElement>(null);

  const [
    currentStep,
    setCurrentStep,
  ] = useState(0);

  const [
    reviewValues,
    setReviewValues,
  ] =
    useState<ReviewValues>({});

  const [done, setDone] =
    useState(false);

  const [
    reference,
    setReference,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [
    ethnicGroupChoice,
    setEthnicGroupChoice,
  ] =
    useState("");

  function collectValues() {

    if (!formRef.current) {
      return {};
    }

    const form =
      new FormData(
        formRef.current,
      );

    const result:
      ReviewValues = {};

    for (
      const [
        key,
        value,
      ] of form.entries()
    ) {

      if (
        typeof value ===
        "string"
      ) {
        result[key] =
          value;
      }
    }

    return result;
  }

  function validateStep() {

    const form =
      formRef.current;

    if (!form) {
      return false;
    }

    const section =
      form.querySelector<HTMLElement>(
        `[data-step="${currentStep}"]`,
      );

    if (!section) {
      return true;
    }

    const controls = [
      ...section.querySelectorAll("input"),
      ...section.querySelectorAll("select"),
      ...section.querySelectorAll("textarea"),
    ];

    for (
      const control
      of controls
    ) {

      if (
        !control
          .checkValidity()
      ) {

        control
          .reportValidity();

        control.focus();

        return false;
      }
    }

    return true;
  }

  function next() {

    setError("");

    if (
      !validateStep()
    ) {
      return;
    }

    const nextStep =
      Math.min(
        currentStep + 1,
        3,
      );

    if (
      nextStep === 3
    ) {
      setReviewValues(
        collectValues(),
      );
    }

    setCurrentStep(
      nextStep,
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function back() {

    setError("");

    setCurrentStep(
      Math.max(
        0,
        currentStep - 1,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submit(
    event:
      React.FormEvent<
        HTMLFormElement
      >,
  ) {

    event.preventDefault();

    if (
      currentStep < 3
    ) {
      next();
      return;
    }

    setBusy(true);
    setError("");

    try {

      const form =
        new FormData(
          event.currentTarget,
        );

      const selectedEthnicGroup =
        String(
          form.get(
            "ethnicGroup",
          ) ?? "",
        ).trim();

      const otherEthnicGroup =
        String(
          form.get(
            "ethnicGroupOther",
          ) ?? "",
        ).trim();

      const resolvedEthnicGroup =
        selectedEthnicGroup ===
          "Other"
          ? otherEthnicGroup
          : selectedEthnicGroup;

      const payload = {

        firstName:
          String(
            form.get(
              "firstName",
            ) ?? "",
          ).trim(),

        lastName:
          String(
            form.get(
              "lastName",
            ) ?? "",
          ).trim(),

        dateOfBirth:
          String(
            form.get(
              "dateOfBirth",
            ) ?? "",
          ),

        gender:
          String(
            form.get(
              "gender",
            ) ?? "",
          ).trim(),

        ethnicGroup:
          resolvedEthnicGroup,

        guardianName:
          String(
            form.get(
              "guardianName",
            ) ?? "",
          ).trim(),

        relationship:
          String(
            form.get(
              "relationship",
            ) ?? "",
          ).trim(),

        guardianEmail:
          String(
            form.get(
              "guardianEmail",
            ) ?? "",
          ).trim(),

        guardianPhone:
          String(
            form.get(
              "guardianPhone",
            ) ?? "",
          ).trim(),

        postcode:
          String(
            form.get(
              "postcode",
            ) ?? "",
          ).trim(),

        emergencyContactNumber:
          String(
            form.get(
              "emergencyContactNumber",
            ) ?? "",
          ).trim(),

        address:
          String(
            form.get(
              "address",
            ) ?? "",
          ).trim(),

        preferredSession:
          String(
            form.get(
              "preferredSession",
            ) ?? "",
          ).trim(),

        priorLevel:
          String(
            form.get(
              "priorLevel",
            ) ?? "",
          ).trim(),

        medicalNotes:
          String(
            form.get(
              "medicalNotes",
            ) ?? "",
          ).trim(),

        allergyNotes:
          String(
            form.get(
              "allergyNotes",
            ) ?? "",
          ).trim(),

        additionalNeeds:
          String(
            form.get(
              "additionalNeeds",
            ) ?? "",
          ).trim(),

        emergencyConsent:
          form.get(
            "emergencyConsent",
          ) === "true",

        photoConsent:
          form.get(
            "photoConsent",
          ) === "true",
      };

      const response =
        await fetch(
          "/api/admissions/apply",
          {
            method: "POST",

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
        (await response
          .json()
          .catch(
            () => ({}),
          )) as
          ApplicationResponse;

      if (
        !response.ok
      ) {

        setError(
          result.error ??
          "Unable to submit application",
        );

        return;
      }

      setReference(
        result.studentNumber ??
        result.applicationId ??
        "",
      );

      setDone(true);
    }
    catch (
      submitError
    ) {

      console.error(
        submitError,
      );

      setError(
        "Unable to submit the application. Please check your connection and try again.",
      );
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <main className="apply-page">

      <header className="apply-header">

        <Link href="/">

          <Image
            src="/community-logo.png"
            width={54}
            height={54}
            alt="Bolton Nigerian Muslim Community"
            priority
          />

          <span>
            <b>BNMC Madrasah</b>

            <small>
              Knowledge | Faith | Character
            </small>
          </span>

        </Link>

      </header>

      {done ? (

        <section className="apply-success">

          <CheckCircle2 />

          <small>
            Application submitted
          </small>

          <h1>
            Application received
          </h1>

          <p>
            JazakAllahu khayran.
            The admissions team
            will review the
            information and
            contact you about
            the appropriate next
            step.
          </p>

          {reference && (
            <strong>
              Reference:
              {" "}
              {reference}
            </strong>
          )}

          <Link href="/">
            Return to the
            Madrasah website
          </Link>

        </section>

      ) : (

        <>

          <nav
            className="apply-steps"
            aria-label="Application steps"
          >

            {steps.map(
              (
                step,
                index,
              ) => (

                <span
                  key={step}

                  className={
                    index ===
                    currentStep
                      ? "active"
                      :
                    index <
                    currentStep
                      ? "complete"
                      : ""
                  }
                >

                  <i>
                    {
                      index <
                      currentStep
                        ?
                      <Check />
                        :
                      index + 1
                    }
                  </i>

                  {step}

                </span>

              ),
            )}

          </nav>

          <form
            ref={formRef}
            className="apply-form"
            onSubmit={submit}
          >

            <section className="apply-form-main">

              <small className="apply-kicker">

                {
                  currentStep === 0
                    ? "Child details"
                    :
                  currentStep === 1
                    ? "Guardian details"
                    :
                  currentStep === 2
                    ? "Additional information"
                    :
                  "Review & submit"
                }

              </small>

              <h1>

                {
                  currentStep === 0
                    ? "Tell us about your child"
                    :
                  currentStep === 1
                    ? "Parent and guardian details"
                    :
                  currentStep === 2
                    ? "Learning and support information"
                    :
                  "Review your application"
                }

              </h1>

              <p className="apply-lead">

                {
                  currentStep === 0
                    ?
                  "Please provide your child's basic information."
                    :
                  currentStep === 1
                    ?
                  "Tell us how to contact you and who we should reach in an emergency."
                    :
                  currentStep === 2
                    ?
                  "Share information that will help us support your child."
                    :
                  "Please check the information below before submitting."
                }

              </p>

              <fieldset
                data-step="0"
                hidden={
                  currentStep !== 0
                }
              >

                <legend>
                  Child information
                </legend>

                <div className="apply-grid">

                  <label>
                    Child's first name *

                    <input
                      name="firstName"
                      required
                    />
                  </label>

                  <label>
                    Child's last name *

                    <input
                      name="lastName"
                      required
                    />
                  </label>

                  <label>
                    Date of birth *

                    <input
                      name="dateOfBirth"
                      type="date"
                      required
                    />
                  </label>

                  <label>
                    Gender *

                    <select
                      name="gender"
                      required
                      defaultValue=""
                    >

                      <option
                        value=""
                        disabled
                      >
                        Select
                      </option>

                      <option>
                        Male
                      </option>

                      <option>
                        Female
                      </option>

                    </select>
                  </label>

                  <label className="wide">
                    Ethnic group *

                    <select
                      name="ethnicGroup"
                      required
                      value={
                        ethnicGroupChoice
                      }
                      onChange={(event) =>
                        setEthnicGroupChoice(
                          event.target.value,
                        )
                      }
                    >

                      <option
                        value=""
                        disabled
                      >
                        Select ethnic group
                      </option>

                      {
                        ethnicGroups.map(
                          (
                            group,
                          ) => (

                            <option
                              key={group}
                              value={group}
                            >
                              {group}
                            </option>

                          ),
                        )
                      }

                    </select>
                  </label>

                  {ethnicGroupChoice ===
                    "Other" && (

                    <label className="wide">
                      Please specify ethnic group *

                      <input
                        name="ethnicGroupOther"
                        required
                        placeholder="Enter ethnic group"
                      />
                    </label>

                  )}

                </div>

              </fieldset>

              <fieldset
                data-step="1"
                hidden={
                  currentStep !== 1
                }
              >

                <legend>
                  Guardian information
                </legend>

                <div className="apply-grid">

                  <label>
                    Parent / guardian name *

                    <input
                      name="guardianName"
                      required
                    />
                  </label>

                  <label>
                    Relationship to child *

                    <select
                      name="relationship"
                      required
                      defaultValue=""
                    >

                      <option
                        value=""
                        disabled
                      >
                        Select
                      </option>

                      <option>
                        Father
                      </option>

                      <option>
                        Mother
                      </option>

                      <option>
                        Guardian
                      </option>

                      <option>
                        Other
                      </option>

                    </select>
                  </label>

                  <label>
                    Email address *

                    <input
                      name="guardianEmail"
                      type="email"
                      required
                    />
                  </label>

                  <label>
                    Telephone *

                    <input
                      name="guardianPhone"
                      type="tel"
                      required
                    />
                  </label>

                  <label>
                    Postcode *

                    <input
                      name="postcode"
                      placeholder="e.g. BL2 1DZ"
                      required
                    />
                  </label>

                  <label>
                    Emergency contact number *

                    <input
                      name="emergencyContactNumber"
                      type="tel"
                      required
                    />
                  </label>

                  <label className="wide">
                    Home address

                    <input
                      name="address"
                    />
                  </label>

                </div>

              </fieldset>

              <fieldset
                data-step="2"
                hidden={
                  currentStep !== 2
                }
              >

                <legend>
                  Learning & additional information
                </legend>

                <div className="apply-grid">

                  <label>
                    Preferred session

                    <input
                      name="preferredSession"
                    />
                  </label>

                  <label>
                    Previous Arabic/Qur'an level

                    <input
                      name="priorLevel"
                    />
                  </label>

                  <label className="wide">
                    Medical information

                    <textarea
                      name="medicalNotes"
                      rows={3}
                    />
                  </label>

                  <label className="wide">
                    Allergies

                    <textarea
                      name="allergyNotes"
                      rows={3}
                    />
                  </label>

                  <label className="wide">
                    Additional learning needs

                    <textarea
                      name="additionalNeeds"
                      rows={3}
                    />
                  </label>

                </div>

                <div className="apply-consents">

                  <label>

                    <input
                      type="checkbox"
                      name="emergencyConsent"
                      value="true"
                      required
                    />

                    I consent to
                    emergency first aid
                    where necessary.

                  </label>

                  <label>

                    <input
                      type="checkbox"
                      name="photoConsent"
                      value="true"
                    />

                    I consent to
                    appropriate
                    photographs for
                    internal learning
                    records.

                  </label>

                </div>

              </fieldset>

              <section
                className="apply-review"
                data-step="3"
                hidden={
                  currentStep !== 3
                }
              >

                <div className="apply-review-card">

                  <h2>
                    Child details
                  </h2>

                  <ReviewRow
                    label="Name"
                    value={
                      `${valueOf(
                        reviewValues,
                        "firstName",
                      )} ${valueOf(
                        reviewValues,
                        "lastName",
                      )}`
                    }
                  />

                  <ReviewRow
                    label="Date of birth"
                    value={
                      valueOf(
                        reviewValues,
                        "dateOfBirth",
                      )
                    }
                  />

                  <ReviewRow
                    label="Gender"
                    value={
                      valueOf(
                        reviewValues,
                        "gender",
                      )
                    }
                  />

                  <ReviewRow
                    label="Ethnic group"
                    value={
                      reviewValues.ethnicGroup ===
                        "Other"
                        ? valueOf(
                            reviewValues,
                            "ethnicGroupOther",
                          )
                        : valueOf(
                            reviewValues,
                            "ethnicGroup",
                          )
                    }
                  />

                </div>

                <div className="apply-review-card">

                  <h2>
                    Guardian details
                  </h2>

                  <ReviewRow
                    label="Guardian"
                    value={
                      valueOf(
                        reviewValues,
                        "guardianName",
                      )
                    }
                  />

                  <ReviewRow
                    label="Email"
                    value={
                      valueOf(
                        reviewValues,
                        "guardianEmail",
                      )
                    }
                  />

                  <ReviewRow
                    label="Telephone"
                    value={
                      valueOf(
                        reviewValues,
                        "guardianPhone",
                      )
                    }
                  />

                  <ReviewRow
                    label="Emergency contact"
                    value={
                      valueOf(
                        reviewValues,
                        "emergencyContactNumber",
                      )
                    }
                  />

                  <ReviewRow
                    label="Postcode"
                    value={
                      valueOf(
                        reviewValues,
                        "postcode",
                      )
                    }
                  />

                </div>

              </section>

              {error && (

                <output
                  className="apply-error"
                  role="alert"
                >
                  {error}
                </output>

              )}

              <footer className="apply-actions">

                {
                  currentStep === 0
                    ?

                  <Link href="/">
                    Cancel
                  </Link>

                    :

                  <button
                    type="button"
                    className="apply-secondary-button"
                    onClick={back}
                    disabled={busy}
                  >
                    Back
                  </button>
                }

                {
                  currentStep < 3
                    ?

                  <button
                    type="button"
                    onClick={next}
                  >
                    Continue
                  </button>

                    :

                  <button
                    type="submit"
                    disabled={busy}
                  >
                    {
                      busy
                        ?
                      "Submitting..."
                        :
                      "Submit application"
                    }
                  </button>
                }

              </footer>

            </section>

            <aside className="apply-aside">

              <div>

                <h3>
                  Why we ask for this information
                </h3>

                <p>
                  <Check />
                  Helps us know your child better
                </p>

                <p>
                  <Check />
                  Supports a safe environment
                </p>

                <p>
                  <Check />
                  Helps teachers support learning
                </p>

                <p>
                  <Check />
                  Required for registration
                </p>

              </div>

              <div>

                <h3>
                  <CircleHelp />
                  Need help?
                </h3>

                <p>
                  Contact the admissions
                  team if you need help
                  completing the form.
                </p>

                <a
                  className="apply-help-link"
                  href="tel:+447438725293"
                >
                  <Phone />
                  +44 7438 725293
                </a>

                <a
                  className="apply-help-link"
                  href="mailto:admin@bnmc.org.uk"
                >
                  <Mail />
                  admin@bnmc.org.uk
                </a>

              </div>

            </aside>

          </form>

        </>

      )}

    </main>
  );
}