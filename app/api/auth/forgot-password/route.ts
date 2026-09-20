import { body, fail, json, required } from "@/lib/backend";
import { requestPasswordReset } from "@/lib/parent-access";

export async function POST(request: Request) {
  try {
    const input = await body(request);
    const email = required(input.email, "Email").trim().toLowerCase();

    await requestPasswordReset(email, request.url);

    // Deliberately generic to avoid exposing whether an account exists.
    return json({
      ok: true,
      message:
        "If an active account matches that email, password reset instructions have been sent.",
    });
  } catch (error) {
    return fail(error);
  }
}
