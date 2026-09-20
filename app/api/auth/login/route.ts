import { d1 } from "@/db";
import { authenticate, body, fail, required, sha256 } from "@/lib/backend";

export async function POST(request: Request) {
  try {
    const input = await body(request);

    const user = await authenticate(
      required(input.email, "Email"),
      required(input.password, "Password"),
    );

    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    await d1()
      .prepare(
        `insert into sessions
           (id, user_id, token_hash, expires_at)
         values (?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), user.id, tokenHash, expiresAt)
      .run();

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          roles: user.roles,
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "set-cookie": `madrasat_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${
            process.env.NODE_ENV === "production" ? "; Secure" : ""
          }`,
        },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
