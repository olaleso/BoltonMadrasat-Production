import { actor, body, fail, json, required } from "@/lib/backend";
import { provisionParentAccess } from "@/lib/parent-access";

export async function POST(request: Request) {
  try {
    await actor(request, ["admin"]);
    const input = await body(request);
    const applicationId = required(input.applicationId, "Application");
    const result = await provisionParentAccess(applicationId, new URL(request.url).origin, true);
    return json({ ok: result.status !== "failed", parentAccess: result }, result.status === "failed" ? 502 : 200);
  } catch (error) {
    return fail(error);
  }
}
