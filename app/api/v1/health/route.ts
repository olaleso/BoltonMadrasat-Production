import { sql } from "@/db";
export async function GET() { try { await sql`select 1`; return Response.json({ok:true,service:"Bolton Madrasat API",version:"1.0.0",database:"PostgreSQL",time:new Date().toISOString()}); } catch { return Response.json({ok:false,database:"unavailable"},{status:503}); } }
