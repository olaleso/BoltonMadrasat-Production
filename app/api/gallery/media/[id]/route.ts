import { env } from "cloudflare:workers";
import { actor } from "@/lib/backend";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const runtime = env as typeof env & {
      DB: D1Database;
      MEDIA: R2Bucket;
    };

    const row = await runtime.DB.prepare(`
      SELECT id, storage_key, mime_type, status
      FROM media_gallery
      WHERE id = ?
      LIMIT 1
    `).bind(id).first<{
      id: string;
      storage_key: string | null;
      mime_type: string | null;
      status: string;
    }>();

    if (!row || !row.storage_key) {
      return new Response("Media not found", { status: 404 });
    }

    if (row.status !== "published") {
      try {
        await actor(request, ["admin"]);
      } catch {
        return new Response("Media not found", { status: 404 });
      }
    }

    const object = await runtime.MEDIA.get(row.storage_key);
    if (!object) {
      return new Response("Media file not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", row.status === "published"
      ? "public, max-age=86400, immutable"
      : "private, no-store");
    headers.set("content-type", row.mime_type || headers.get("content-type") || "application/octet-stream");

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Gallery media retrieval failed", error);
    return new Response("Unable to load media", { status: 500 });
  }
}
