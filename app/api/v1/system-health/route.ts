import { env } from "cloudflare:workers";
import { d1 } from "@/db";
import { actor, fail, json } from "@/lib/backend";

const runtimeEnv = env as unknown as Record<string, string | undefined>;

function configured(name: string) {
  return Boolean(
    String(runtimeEnv[name] ?? process.env[name] ?? "").trim(),
  );
}

export async function GET(request: Request) {
  try {
    await actor(request, ["admin"]);

    let database = {
      status: "healthy",
      detail: "Cloudflare D1 is responding.",
    };

    try {
      await d1().prepare("select 1 as ok").first();
    } catch {
      database = {
        status: "error",
        detail: "Cloudflare D1 could not be queried.",
      };
    }

    let webhooks: Array<Record<string, unknown>> = [];

    try {
      const result = await d1()
        .prepare(
          `select
             provider,
             count(*) as total_24h,
             sum(case when status = 'failed' then 1 else 0 end) as failed_24h,
             max(received_at) as last_received_at,
             max(case when status = 'processed' then processed_at end) as last_processed_at
           from payment_webhook_events
           where datetime(received_at) >= datetime('now', '-24 hours')
           group by provider
           order by provider`,
        )
        .all<Record<string, unknown>>();
      webhooks = result.results ?? [];
    } catch {
      webhooks = [];
    }

    const emailReady = configured("RESEND_API_KEY") && configured("EMAIL_FROM");
    const stripeReady = configured("STRIPE_SECRET_KEY");
    const stripeWebhookReady = configured("STRIPE_WEBHOOK_SECRET");
    const gocardlessReady = configured("GOCARDLESS_ACCESS_TOKEN");
    const gocardlessWebhookReady = configured("GOCARDLESS_WEBHOOK_SECRET");

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      services: [
        {
          key: "database",
          label: "Database",
          ...database,
        },
        {
          key: "email",
          label: "Parent email",
          status: emailReady ? "healthy" : "warning",
          detail: emailReady
            ? "Resend and sender address are configured."
            : "Email delivery is not fully configured.",
        },
        {
          key: "stripe",
          label: "Card payments",
          status: stripeReady && stripeWebhookReady ? "healthy" : "warning",
          detail:
            stripeReady && stripeWebhookReady
              ? "Stripe checkout and webhook configuration are present."
              : "Stripe checkout or webhook configuration is incomplete.",
        },
        {
          key: "gocardless",
          label: "Direct Debit",
          status:
            gocardlessReady && gocardlessWebhookReady ? "healthy" : "warning",
          detail:
            gocardlessReady && gocardlessWebhookReady
              ? "GoCardless API and webhook configuration are present."
              : "GoCardless API or webhook configuration is incomplete.",
        },
      ],
      webhooks,
    });
  } catch (error) {
    return fail(error);
  }
}
