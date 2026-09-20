import { env } from "cloudflare:workers";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = String(url.searchParams.get("category") ?? "").trim();
    const featured = url.searchParams.get("featured") === "1";
    const requestedLimit = Number(url.searchParams.get("limit") ?? 48);
    const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 48));

    const clauses = ["status = 'published'"];
    const bindings: unknown[] = [];

    if (category && category.toLowerCase() !== "all") {
      clauses.push("lower(category) = lower(?)");
      bindings.push(category);
    }

    if (featured) {
      clauses.push("is_featured = 1");
    }

    const db = (env as typeof env & { DB: D1Database }).DB;
    const query = `
      SELECT
        id,
        title,
        caption,
        media_type,
        external_url,
        mime_type,
        category,
        album,
        event_date,
        is_featured,
        published_at,
        created_at
      FROM media_gallery
      WHERE ${clauses.join(" AND ")}
      ORDER BY
        is_featured DESC,
        COALESCE(event_date, published_at, created_at) DESC,
        created_at DESC
      LIMIT ?
    `;

    bindings.push(limit);
    const result = await db.prepare(query).bind(...bindings).all<Record<string, unknown>>();

    const data = (result.results ?? []).map((row) => ({
      ...row,
      mediaUrl: row.media_type === "video_link"
        ? row.external_url
        : `/api/gallery/media/${row.id}`,
    }));

    return json({ ok: true, data });
  } catch (error) {
    console.error("Public gallery load failed", error);
    return json({ error: "Unable to load the gallery right now." }, 500);
  }
}
