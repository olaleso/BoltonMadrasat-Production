import { d1 } from "@/db";
import { cookie, sha256 } from "@/lib/backend";

export async function POST(request: Request) {
  const token = cookie(request, "madrasat_session");

  if (token) {
    await d1()
      .prepare("delete from sessions where token_hash = ?")
      .bind(await sha256(token))
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "set-cookie":
        "madrasat_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}
