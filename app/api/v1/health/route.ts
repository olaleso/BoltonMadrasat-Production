import { d1 } from "@/db";

export async function GET() {
  try {
    await d1().prepare("select 1 as ok").first();

    return Response.json({
      ok: true,
      service: "BNMC Madrasah API",
      version: "1.0.0",
      database: "Cloudflare D1 (SQLite)",
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, database: "unavailable" },
      { status: 503 },
    );
  }
}
