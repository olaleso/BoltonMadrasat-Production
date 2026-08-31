import { actor, fail, json } from "@/lib/backend";
export async function GET(request: Request) { try { return json({ok:true,user:await actor(request)}); } catch(error) { return fail(error); } }
