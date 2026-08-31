import { cookie, sha256 } from "@/lib/backend";
import { sql } from "@/db";
export async function POST(request: Request) { const token = cookie(request, "madrasat_session"); if (token) await sql`delete from sessions where token_hash=${await sha256(token)}`; return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":"madrasat_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"}}); }
