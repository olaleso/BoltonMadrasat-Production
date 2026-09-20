import { hash } from "bcryptjs";

import { d1 } from "@/db";
import { applicationOrigin, escapeHtml } from "@/lib/email";
import { sendTrackedEmail } from "@/lib/email-delivery";
import { sha256 } from "@/lib/backend";

export type ParentAccessResult = {
  status: "sent" | "existing" | "failed";
  message: string;
};

type ParentRow = {
  application_id: string;
  application_status: string;
  student_name: string;
  guardian_id: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_user_id: string | null;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
};

function secureToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function parentForApplication(applicationId: string) {
  return d1()
    .prepare(
      `select
         a.id as application_id,
         a.status as application_status,
         s.first_name || ' ' || s.last_name as student_name,
         g.id as guardian_id,
         g.full_name as guardian_name,
         lower(g.email) as guardian_email,
         g.user_id as guardian_user_id
       from applications a
       join students s on s.id = a.student_id
       left join student_guardians sg
         on sg.student_id = s.id
        and sg.is_primary = 1
       left join guardians g on g.id = sg.guardian_id
       where a.id = ?
       limit 1`,
    )
    .bind(applicationId)
    .first<ParentRow>();
}

async function userForParent(parent: ParentRow) {
  if (parent.guardian_user_id) {
    const linked = await d1()
      .prepare(
        `select id, email, display_name, role, status
         from users
         where id = ?
         limit 1`,
      )
      .bind(parent.guardian_user_id)
      .first<UserRow>();

    if (linked) return linked;
  }

  if (!parent.guardian_email) return null;

  return d1()
    .prepare(
      `select id, email, display_name, role, status
       from users
       where lower(email) = lower(?)
       limit 1`,
    )
    .bind(parent.guardian_email)
    .first<UserRow>();
}

async function createAccessToken(
  userId: string,
  purpose: "account_setup" | "password_reset",
) {
  const token = secureToken();
  const tokenHash = await sha256(token);
  const lifetimeHours = purpose === "account_setup" ? 24 : 1;
  const expiresAt = new Date(
    Date.now() + lifetimeHours * 60 * 60 * 1000,
  ).toISOString();
  const db = d1();

  await db.batch([
    db.prepare(
      `update password_access_tokens
       set used_at = CURRENT_TIMESTAMP
       where user_id = ?
         and purpose = ?
         and used_at is null`,
    ).bind(userId, purpose),

    db.prepare(
      `insert into password_access_tokens
         (id, user_id, token_hash, purpose, expires_at)
       values (?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      purpose,
      expiresAt,
    ),
  ]);

  return token;
}

async function sendSetupEmail(
  parent: ParentRow,
  token: string,
  origin: string,
) {
  const guardian =
    parent.guardian_name ||
    "Parent / Guardian";

  const baseOrigin =
    applicationOrigin(
      origin,
    );

  const setupUrl =
    `${baseOrigin}/reset-password?token=${encodeURIComponent(token)}&mode=setup`;

  const admissionUrl =
    `${baseOrigin}/portal/admission-letter?id=${encodeURIComponent(parent.application_id)}`;

  const safeGuardian =
    escapeHtml(
      guardian,
    );

  const safeStudent =
    escapeHtml(
      parent.student_name,
    );

  const safeSetupUrl =
    escapeHtml(
      setupUrl,
    );

  const safeAdmissionUrl =
    escapeHtml(
      admissionUrl,
    );

  await sendTrackedEmail({
    to:
      String(
        parent.guardian_email,
      ),

    emailType:
      "admission_parent_setup",

    relatedEntityType:
      "application",

    relatedEntityId:
      parent.application_id,

    context: {
      applicationId:
        parent.application_id,
      requestOrigin:
        origin,
    },

    subject:
      "Set up your BNMC Madrasah parent account",

    text:
      `As-Salaamu alaykum ${guardian},

${parent.student_name}'s admission has been accepted.

Please set your parent portal password using this secure link:
${setupUrl}

The setup link expires in 24 hours and can only be used once.

After setting your password and signing in, open ${parent.student_name}'s profile in the parent portal to view or download the admission letter.

BNMC Madrasah`,

    html:
      `<p>As-Salaamu alaykum ${safeGuardian},</p>` +
      `<p><strong>${safeStudent}</strong>'s admission has been accepted.</p>` +
      `<p>Please set your parent portal password using the secure button below.</p>` +
      `<p><a href="${safeSetupUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#075d36;color:#ffffff;text-decoration:none;font-weight:700">Set up parent portal password</a></p>` +
      `<p>This secure setup link expires in 24 hours and can only be used once.</p>` +
      `<p>After setting your password and signing in, open <strong>${safeStudent}</strong>'s profile in the parent portal to view or download the admission letter.</p>` +
      `<p>Jazakumullahu Khayran,<br>BNMC Madrasah</p>`,
  });
}

async function sendExistingAccountEmail(
  parent: ParentRow,
  origin: string,
) {
  const guardian =
    parent.guardian_name ||
    "Parent / Guardian";

  const baseOrigin =
    applicationOrigin(
      origin,
    );

  const loginUrl =
    `${baseOrigin}/login`;

  const forgotUrl =
    `${baseOrigin}/forgot-password`;

  const admissionUrl =
    `${baseOrigin}/portal/admission-letter?id=${encodeURIComponent(parent.application_id)}`;

  const safeGuardian =
    escapeHtml(
      guardian,
    );

  const safeStudent =
    escapeHtml(
      parent.student_name,
    );

  const safeLoginUrl =
    escapeHtml(
      loginUrl,
    );

  const safeForgotUrl =
    escapeHtml(
      forgotUrl,
    );

  const safeAdmissionUrl =
    escapeHtml(
      admissionUrl,
    );

  await sendTrackedEmail({
    to:
      String(
        parent.guardian_email,
      ),

    emailType:
      "admission_confirmation",

    relatedEntityType:
      "application",

    relatedEntityId:
      parent.application_id,

    context: {
      applicationId:
        parent.application_id,
      requestOrigin:
        origin,
    },

    subject:
      `${parent.student_name}'s BNMC Madrasah admission is confirmed`,

    text:
      `As-Salaamu alaykum ${guardian},

${parent.student_name}'s admission has been accepted.

Sign in to your existing parent portal account:
${loginUrl}

Once signed in, open ${parent.student_name}'s profile to view or download the admission letter.

If you do not remember your password, reset it here:
${forgotUrl}

BNMC Madrasah`,

    html:
      `<p>As-Salaamu alaykum ${safeGuardian},</p>` +
      `<p><strong>${safeStudent}</strong>'s admission has been accepted.</p>` +
      `<p><a href="${safeLoginUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#075d36;color:#ffffff;text-decoration:none;font-weight:700">Open parent portal</a></p>` +
      `<p>Once signed in, open <strong>${safeStudent}</strong>'s profile to view or download the admission letter.</p>` +
      `<p>If you do not remember your password, <a href="${safeForgotUrl}">reset it here</a>.</p>` +
      `<p>Jazakumullahu Khayran,<br>BNMC Madrasah</p>`,
  });
}

export async function provisionParentAccess(
  applicationId: string,
  requestOrigin: string,
  forceSetup = false,
): Promise<ParentAccessResult> {
  try {
    const parent =
      await parentForApplication(
        applicationId,
      );

    if (
      !parent ||
      !parent.guardian_id ||
      !parent.guardian_email
    ) {
      return {
        status: "failed",
        message:
          "Admission saved, but the primary guardian email is missing.",
      };
    }

    let user =
      await userForParent(
        parent,
      );

    const isNewAccount =
      !user;

    if (!user) {
      const userId =
        crypto.randomUUID();

      const unusablePassword =
        await hash(
          secureToken(),
          12,
        );

      const db =
        d1();

      await db.batch([
        db.prepare(
          `insert into users
             (id, email, display_name, role, password_hash, status)
           values (?, ?, ?, 'parent', ?, 'active')`,
        ).bind(
          userId,
          parent.guardian_email,
          parent.guardian_name ||
            "Parent / Guardian",
          unusablePassword,
        ),

        db.prepare(
          `insert or ignore into user_roles
             (user_id, role)
           values (?, 'parent')`,
        ).bind(
          userId,
        ),

        db.prepare(
          `update guardians
           set user_id = ?, updated_at = CURRENT_TIMESTAMP
           where id = ?`,
        ).bind(
          userId,
          parent.guardian_id,
        ),
      ]);

      user = {
        id:
          userId,

        email:
          parent.guardian_email,

        display_name:
          parent.guardian_name ||
          "Parent / Guardian",

        role:
          "parent",

        status:
          "active",
      };
    }
    else {
      const db = d1();

      await db.batch([
        db.prepare(
          `insert or ignore into user_roles
             (user_id, role)
           values (?, 'parent')`,
        ).bind(
          user.id,
        ),

        db.prepare(
          `update guardians
           set user_id = ?, updated_at = CURRENT_TIMESTAMP
           where id = ?`,
        ).bind(
          user.id,
          parent.guardian_id,
        ),
      ]);
    }

    if (
      isNewAccount ||
      forceSetup
    ) {
      const token =
        await createAccessToken(
          user.id,
          "account_setup",
        );

      await sendSetupEmail(
        parent,
        token,
        requestOrigin,
      );

      return {
        status: "sent",
        message:
          `Parent password setup email sent to ${parent.guardian_email}.`,
      };
    }

    const setupToken =
      await createAccessToken(
        user.id,
        "account_setup",
      );

    await sendSetupEmail(
      parent,
      setupToken,
      requestOrigin,
    );

    return {
      status: "sent",
      message:
        `Admission confirmation and password setup link sent to ${parent.guardian_email}.`,
    };
  }
  catch (error) {
    console.error(
      "Parent access provisioning failed",
      error,
    );

    return {
      status: "failed",
      message:
        "Admission saved, but the parent access email could not be sent. Use Resend parent access to try again.",
    };
  }
}


type GuardianPortalRow = {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
};

type GuardianPortalUser = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
};

export type GuardianPortalAccessResult = {
  status: "sent" | "existing" | "added" | "failed";
  message: string;
};

async function guardianPortalRow(
  guardianId: string,
) {
  return d1()
    .prepare(
      `select
         id,
         full_name,
         lower(email) as email,
         user_id
       from guardians
       where id = ?
       limit 1`,
    )
    .bind(guardianId)
    .first<GuardianPortalRow>();
}

async function guardianPortalUser(
  guardian: GuardianPortalRow,
) {
  if (guardian.user_id) {
    const linked =
      await d1()
        .prepare(
          `select
             id,
             email,
             display_name,
             role,
             status
           from users
           where id = ?
           limit 1`,
        )
        .bind(guardian.user_id)
        .first<GuardianPortalUser>();

    if (linked) {
      return linked;
    }
  }

  return d1()
    .prepare(
      `select
         id,
         email,
         display_name,
         role,
         status
       from users
       where lower(email) = lower(?)
       limit 1`,
    )
    .bind(guardian.email)
    .first<GuardianPortalUser>();
}

async function userHasRole(
  userId: string,
  role: string,
) {
  const row =
    await d1()
      .prepare(
        `select 1 as found
         from user_roles
         where user_id = ?
           and role = ?
         limit 1`,
      )
      .bind(
        userId,
        role,
      )
      .first<{
        found: number;
      }>();

  return Boolean(row);
}

async function sendLegacyParentSetupEmail(
  guardian: GuardianPortalRow,
  token: string,
  origin: string,
) {
  const baseOrigin =
    applicationOrigin(
      origin,
    );

  const setupUrl =
    `${baseOrigin}/reset-password?token=${encodeURIComponent(token)}&mode=setup`;

  const safeGuardian =
    escapeHtml(
      guardian.full_name ||
      "Parent / Guardian",
    );

  const safeSetupUrl =
    escapeHtml(
      setupUrl,
    );

  await sendTrackedEmail({
    to:
      guardian.email,

    emailType:
      "parent_portal_setup",

    relatedEntityType:
      "guardian",

    relatedEntityId:
      guardian.id,

    context: {
      guardianId:
        guardian.id,
      requestOrigin:
        origin,
    },

    subject:
      "Set up your BNMC Madrasah parent portal account",

    text:
      `As-Salaamu alaykum ${guardian.full_name || "Parent / Guardian"},

Your BNMC Madrasah parent portal access is ready.

Please set your password using this secure link:
${setupUrl}

The setup link expires in 24 hours and can only be used once.

After signing in, you can view your linked child or children, keep contact details up to date, receive Madrasah information, and monitor attendance and learning progress as these records become available.

BNMC Madrasah`,

    html:
      `<p>As-Salaamu alaykum ${safeGuardian},</p>` +
      `<p>Your <strong>BNMC Madrasah parent portal</strong> access is ready.</p>` +
      `<p>Please set your password using the secure button below.</p>` +
      `<p><a href="${safeSetupUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#075d36;color:#ffffff;text-decoration:none;font-weight:700">Set up parent portal password</a></p>` +
      `<p>This setup link expires in 24 hours and can only be used once.</p>` +
      `<p>After signing in, you can view your linked child or children, keep contact details up to date, receive Madrasah information, and monitor attendance and learning progress as these records become available.</p>` +
      `<p>Jazakumullahu Khayran,<br>BNMC Madrasah</p>`,
  });
}

async function sendLegacyParentAccessAddedEmail(
  guardian: GuardianPortalRow,
  origin: string,
) {
  const baseOrigin =
    applicationOrigin(
      origin,
    );

  const loginUrl =
    `${baseOrigin}/login`;

  const forgotUrl =
    `${baseOrigin}/forgot-password`;

  const safeGuardian =
    escapeHtml(
      guardian.full_name ||
      "Parent / Guardian",
    );

  const safeLoginUrl =
    escapeHtml(
      loginUrl,
    );

  const safeForgotUrl =
    escapeHtml(
      forgotUrl,
    );

  await sendTrackedEmail({
    to:
      guardian.email,

    emailType:
      "parent_portal_access_added",

    relatedEntityType:
      "guardian",

    relatedEntityId:
      guardian.id,

    context: {
      guardianId:
        guardian.id,
      requestOrigin:
        origin,
    },

    subject:
      "BNMC Madrasah parent portal access added",

    text:
      `As-Salaamu alaykum ${guardian.full_name || "Parent / Guardian"},

Parent access has been added to your existing BNMC Madrasah portal account.

Sign in here:
${loginUrl}

If you do not remember your password, reset it here:
${forgotUrl}

You can use the parent view to access your linked child or children and monitor attendance and learning progress as these records become available.

BNMC Madrasah`,

    html:
      `<p>As-Salaamu alaykum ${safeGuardian},</p>` +
      `<p>Parent access has been added to your existing BNMC Madrasah portal account.</p>` +
      `<p><a href="${safeLoginUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#075d36;color:#ffffff;text-decoration:none;font-weight:700">Open parent portal</a></p>` +
      `<p>If you do not remember your password, <a href="${safeForgotUrl}">reset it here</a>.</p>` +
      `<p>You can use the parent view to access your linked child or children and monitor attendance and learning progress as these records become available.</p>` +
      `<p>Jazakumullahu Khayran,<br>BNMC Madrasah</p>`,
  });
}

/*
 * Used by the legacy Guardian Update import.
 *
 * One users row is shared across all roles. If the email already belongs
 * to a teacher/admin/etc, the parent role is added without replacing the
 * existing roles or password.
 */
export async function provisionGuardianPortalAccess(
  guardianId: string,
  requestOrigin: string,
): Promise<GuardianPortalAccessResult> {
  try {
    const guardian =
      await guardianPortalRow(
        guardianId,
      );

    if (
      !guardian ||
      !guardian.email
    ) {
      return {
        status: "failed",
        message:
          "Guardian saved, but no email address is available for portal access.",
      };
    }

    let user =
      await guardianPortalUser(
        guardian,
      );

    const isNewAccount =
      !user;

    let alreadyParent =
      false;

    if (user) {
      alreadyParent =
        await userHasRole(
          user.id,
          "parent",
        );
    }

    if (!user) {
      const userId =
        crypto.randomUUID();

      const unusablePassword =
        await hash(
          secureToken(),
          12,
        );

      const db =
        d1();

      await db.batch([
        db.prepare(
          `insert into users
             (
               id,
               email,
               display_name,
               role,
               password_hash,
               status
             )
           values (
             ?, ?, ?, 'parent', ?, 'active'
           )`,
        ).bind(
          userId,
          guardian.email,
          guardian.full_name ||
            "Parent / Guardian",
          unusablePassword,
        ),

        db.prepare(
          `insert or ignore into user_roles
             (user_id, role)
           values (?, 'parent')`,
        ).bind(
          userId,
        ),

        db.prepare(
          `update guardians
           set
             user_id = ?,
             updated_at = CURRENT_TIMESTAMP
           where id = ?`,
        ).bind(
          userId,
          guardian.id,
        ),
      ]);

      user = {
        id:
          userId,
        email:
          guardian.email,
        display_name:
          guardian.full_name ||
          "Parent / Guardian",
        role:
          "parent",
        status:
          "active",
      };
    }
    else {
      const db =
        d1();

      await db.batch([
        db.prepare(
          `insert or ignore into user_roles
             (user_id, role)
           values (?, 'parent')`,
        ).bind(
          user.id,
        ),

        db.prepare(
          `update guardians
           set
             user_id = ?,
             updated_at = CURRENT_TIMESTAMP
           where id = ?`,
        ).bind(
          user.id,
          guardian.id,
        ),
      ]);
    }

    if (isNewAccount) {
      const token =
        await createAccessToken(
          user.id,
          "account_setup",
        );

      await sendLegacyParentSetupEmail(
        guardian,
        token,
        requestOrigin,
      );

      return {
        status: "sent",
        message:
          `Parent portal setup email sent to ${guardian.email}.`,
      };
    }

    if (!alreadyParent) {
      await sendLegacyParentAccessAddedEmail(
        guardian,
        requestOrigin,
      );

      return {
        status: "added",
        message:
          `Parent access was added to the existing portal account for ${guardian.email}.`,
      };
    }

    return {
      status: "existing",
      message:
        `Existing parent portal account reused for ${guardian.email}.`,
    };
  }
  catch (error) {
    console.error(
      "Legacy guardian portal provisioning failed",
      error,
    );

    return {
      status: "failed",
      message:
        "Guardian details were saved, but parent portal access could not be provisioned.",
    };
  }
}

export async function resendApplicationParentAccess(
  applicationId: string,
  requestOrigin: string,
) {
  return provisionParentAccess(
    applicationId,
    requestOrigin,
    true,
  );
}

export async function resendGuardianPortalSetup(
  guardianId: string,
  requestOrigin: string,
) {
  try {
    const guardian =
      await guardianPortalRow(
        guardianId,
      );

    if (
      !guardian ||
      !guardian.email
    ) {
      return {
        status:
          "failed" as const,
        message:
          "Guardian email is missing.",
      };
    }

    const user =
      await guardianPortalUser(
        guardian,
      );

    if (
      !user
    ) {
      return {
        status:
          "failed" as const,
        message:
          "Parent portal account was not found.",
      };
    }

    const token =
      await createAccessToken(
        user.id,
        "account_setup",
      );

    await sendLegacyParentSetupEmail(
      guardian,
      token,
      requestOrigin,
    );

    return {
      status:
        "sent" as const,
      message:
        `Parent portal setup email sent to ${guardian.email}.`,
    };
  }
  catch (error) {
    console.error(
      "Parent portal setup resend failed",
      error,
    );

    return {
      status:
        "failed" as const,
      message:
        "Parent portal setup email could not be resent.",
    };
  }
}

export async function requestPasswordReset(
  email: string,
  requestOrigin: string,
) {
  const user =
    await d1()
      .prepare(
        `select id, email, display_name
         from users
         where lower(email) = lower(?)
           and status = 'active'
         limit 1`,
      )
      .bind(
        email,
      )
      .first<{
        id: string;
        email: string;
        display_name: string;
      }>();

  if (!user) {
    return;
  }

  const recent =
    await d1()
      .prepare(
        `select count(*) as total
         from password_access_tokens
         where user_id = ?
           and purpose = 'password_reset'
           and created_at > datetime('now', '-15 minutes')`,
      )
      .bind(
        user.id,
      )
      .first<{
        total: number;
      }>();

  if (
    Number(
      recent?.total ??
        0,
    ) >= 3
  ) {
    return;
  }

  const token =
    await createAccessToken(
      user.id,
      "password_reset",
    );

  const url =
    `${applicationOrigin(requestOrigin)}/reset-password?token=${encodeURIComponent(token)}`;

  await sendTrackedEmail({
    to:
      user.email,

    emailType:
      "password_reset",

    relatedEntityType:
      "user",

    relatedEntityId:
      user.id,

    context: {
      userId:
        user.id,
      requestOrigin:
        requestOrigin,
    },

    subject:
      "Reset your BNMC Madrasah password",

    text:
      `As-Salaamu alaykum ${user.display_name},

Reset your portal password using this secure link:
${url}

The link expires in one hour and can only be used once. If you did not request this, you can ignore this email.

BNMC Madrasah`,

    html:
      `<p>As-Salaamu alaykum ${escapeHtml(user.display_name)},</p>` +
      `<p>Use the button below to reset your BNMC Madrasah portal password.</p>` +
      `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#075d36;color:#ffffff;text-decoration:none;font-weight:700">Reset password</a></p>` +
      `<p>This link expires in one hour and can only be used once. If you did not request it, you can ignore this email.</p>` +
      `<p>BNMC Madrasah</p>`,
  });
}
