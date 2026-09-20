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

export async function GET() {
  try {
    const db = (env as typeof env & { DB: D1Database }).DB;
    const result = await db.prepare(`
      SELECT
        id,
        title,
        caption,
        category,
        album,
        event_date,
        carousel_sort_order,
        created_at
      FROM media_gallery
      WHERE status = 'published'
        AND media_type = 'image'
        AND use_in_carousel = 1
      ORDER BY
        carousel_sort_order ASC,
        COALESCE(event_date, created_at) DESC,
        created_at DESC
      LIMIT 12
    `).all<Record<string, unknown>>();

    return json({
      ok: true,
      data: (result.results ?? []).map((row) => ({
        ...row,
        mediaUrl: `/api/gallery/media/${row.id}`,
      })),
    });
  } catch (error) {
    console.error("Homepage carousel load failed", error);
    return json({ error: "Unable to load homepage photos right now." }, 500);
  }
}
