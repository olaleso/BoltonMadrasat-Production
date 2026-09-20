import { env } from "cloudflare:workers";
import { actor, audit, fail } from "@/lib/backend";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function text(value: FormDataEntryValue | null | unknown) {
  return String(value ?? "").trim();
}

function truthy(value: FormDataEntryValue | null | unknown) {
  return [true, 1, "1", "true", "on", "yes"].includes(value as never);
}

function safeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-80) || "media";
}

function extensionFor(file: File) {
  const original = file.name.split(".").pop()?.toLowerCase();
  if (original && /^[a-z0-9]{2,6}$/.test(original)) return original;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  return "mp4";
}

function validExternalVideo(urlValue: string) {
  if (!urlValue) return false;
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return [
      "youtube.com",
      "youtu.be",
      "vimeo.com",
      "player.vimeo.com",
    ].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    await actor(request, ["admin"]);
    const runtime = env as typeof env & { DB: D1Database };
    const url = new URL(request.url);
    const status = text(url.searchParams.get("status"));
    const bindings: unknown[] = [];
    const where: string[] = [];

    if (status && ["draft", "published", "archived"].includes(status)) {
      where.push("mg.status = ?");
      bindings.push(status);
    }

    const result = await runtime.DB.prepare(`
      SELECT
        mg.id,
        mg.title,
        mg.caption,
        mg.media_type,
        mg.external_url,
        mg.mime_type,
        mg.file_size,
        mg.category,
        mg.album,
        mg.event_date,
        mg.is_featured,
        mg.use_in_carousel,
        mg.carousel_sort_order,
        mg.status,
        mg.contains_students,
        mg.photo_consent_confirmed,
        mg.published_at,
        mg.created_at,
        u.display_name AS uploaded_by_name
      FROM media_gallery mg
      LEFT JOIN users u ON u.id = mg.uploaded_by
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY mg.created_at DESC
      LIMIT 250
    `).bind(...bindings).all<Record<string, unknown>>();

    return json({
      ok: true,
      data: (result.results ?? []).map((row) => ({
        ...row,
        mediaUrl: row.media_type === "video_link"
          ? row.external_url
          : `/api/gallery/media/${row.id}?admin=1`,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const runtime = env as typeof env & {
      DB: D1Database;
      MEDIA: R2Bucket;
    };

    const form = await request.formData();
    const title = text(form.get("title"));
    const caption = text(form.get("caption"));
    const category = text(form.get("category")) || "Community";
    const album = text(form.get("album"));
    const eventDate = text(form.get("eventDate"));
    const status = text(form.get("status")) === "published" ? "published" : "draft";
    const featured = truthy(form.get("isFeatured"));
    const useInCarousel = truthy(form.get("useInCarousel"));
    const carouselSortOrder = Number(form.get("carouselSortOrder") ?? 0) || 0;
    const containsStudents = truthy(form.get("containsStudents"));
    const consentConfirmed = truthy(form.get("photoConsentConfirmed"));
    const externalUrl = text(form.get("externalUrl"));
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (containsStudents && !consentConfirmed) {
      return json({ error: "Confirm photo/media consent before uploading media containing students." }, 400);
    }

    if (useInCarousel && status !== "published") {
      return json({ error: "Homepage carousel media must be published first." }, 400);
    }

    if (!files.length && !externalUrl) {
      return json({ error: "Choose at least one media file or provide a YouTube/Vimeo link." }, 400);
    }

    if (externalUrl && files.length) {
      return json({ error: "Upload files or add an external video link in one action, not both." }, 400);
    }

    if (externalUrl && !validExternalVideo(externalUrl)) {
      return json({ error: "External video links must be from YouTube or Vimeo." }, 400);
    }

    if (useInCarousel && externalUrl) {
      return json({ error: "Only uploaded images can be used in the homepage carousel." }, 400);
    }

    if (files.length > 20) {
      return json({ error: "Upload a maximum of 20 files at a time." }, 400);
    }

    const createdIds: string[] = [];

    if (externalUrl) {
      const id = crypto.randomUUID();
      await runtime.DB.prepare(`
        INSERT INTO media_gallery (
          id, title, caption, media_type, external_url,
          category, album, event_date, is_featured, use_in_carousel, carousel_sort_order, status,
          contains_students, photo_consent_confirmed, uploaded_by,
          published_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'video_link', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        id,
        title || "BNMC video",
        caption || null,
        externalUrl,
        category,
        album || null,
        eventDate || null,
        featured ? 1 : 0,
        0,
        0,
        status,
        containsStudents ? 1 : 0,
        consentConfirmed ? 1 : 0,
        who.id,
        status,
      ).run();
      createdIds.push(id);
    }

    for (const file of files) {
      const isImage = IMAGE_TYPES.has(file.type);
      const isVideo = VIDEO_TYPES.has(file.type);

      if (!isImage && !isVideo) {
        return json({ error: `${file.name}: unsupported file type (${file.type || "unknown"}).` }, 400);
      }

      const maxBytes = isImage ? 12 * 1024 * 1024 : 80 * 1024 * 1024;
      if (file.size > maxBytes) {
        return json({ error: `${file.name}: file is too large. Images may be up to 12 MB and videos up to 80 MB.` }, 400);
      }

      const id = crypto.randomUUID();
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, "0");
      const storageKey = `gallery/${year}/${month}/${id}-${safeName(file.name.replace(/\.[^.]+$/, ""))}.${extensionFor(file)}`;
      const buffer = await file.arrayBuffer();

      await runtime.MEDIA.put(storageKey, buffer, {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          originalName: file.name,
          uploadedBy: who.id,
        },
      });

      try {
        await runtime.DB.prepare(`
          INSERT INTO media_gallery (
            id, title, caption, media_type, storage_key, mime_type, file_size,
            category, album, event_date, is_featured, use_in_carousel, carousel_sort_order, status,
            contains_students, photo_consent_confirmed, uploaded_by,
            published_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          id,
          title || file.name.replace(/\.[^.]+$/, "") || "BNMC media",
          caption || null,
          isImage ? "image" : "video",
          storageKey,
          file.type,
          file.size,
          category,
          album || null,
          eventDate || null,
          featured ? 1 : 0,
          useInCarousel && isImage ? 1 : 0,
          carouselSortOrder,
          status,
          containsStudents ? 1 : 0,
          consentConfirmed ? 1 : 0,
          who.id,
          status,
        ).run();
        createdIds.push(id);
      } catch (error) {
        await runtime.MEDIA.delete(storageKey);
        throw error;
      }
    }

    await audit(who, "media-upload", "media_gallery", createdIds[0], {
      count: createdIds.length,
      status,
      category,
      containsStudents,
      consentConfirmed,
    });

    return json({ ok: true, created: createdIds.length, ids: createdIds }, 201);
  } catch (error) {
    console.error("Media gallery upload failed", error);
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const runtime = env as typeof env & { DB: D1Database };
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id);

    if (!id) return json({ error: "Media ID is required." }, 400);

    const current = await runtime.DB.prepare(`
      SELECT id, media_type, contains_students, photo_consent_confirmed, use_in_carousel, carousel_sort_order
      FROM media_gallery
      WHERE id = ?
      LIMIT 1
    `).bind(id).first<Record<string, unknown>>();

    if (!current) return json({ error: "Media record not found." }, 404);

    const title = text(body.title);
    const caption = text(body.caption);
    const category = text(body.category) || "Community";
    const album = text(body.album);
    const eventDate = text(body.eventDate);
    const status = ["draft", "published", "archived"].includes(text(body.status))
      ? text(body.status)
      : "draft";
    const featured = truthy(body.isFeatured);
    const useInCarousel = truthy(body.useInCarousel);
    const carouselSortOrder = Number(body.carouselSortOrder ?? 0) || 0;
    const containsStudents = truthy(body.containsStudents);
    const consentConfirmed = truthy(body.photoConsentConfirmed);

    if (containsStudents && !consentConfirmed) {
      return json({ error: "Photo/media consent must be confirmed before publishing media containing students." }, 400);
    }

    if (useInCarousel && status !== "published") {
      return json({ error: "Homepage carousel media must be published first." }, 400);
    }

    if (useInCarousel && text(current.media_type) !== "image") {
      return json({ error: "Only images can be used in the homepage carousel." }, 400);
    }

    await runtime.DB.prepare(`
      UPDATE media_gallery
      SET title = ?, caption = ?, category = ?, album = ?, event_date = ?,
          is_featured = ?, use_in_carousel = ?, carousel_sort_order = ?, status = ?, contains_students = ?, photo_consent_confirmed = ?,
          published_at = CASE
            WHEN ? = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP
            WHEN ? <> 'published' THEN NULL
            ELSE published_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      title || "BNMC media",
      caption || null,
      category,
      album || null,
      eventDate || null,
      featured ? 1 : 0,
      useInCarousel ? 1 : 0,
      carouselSortOrder,
      status,
      containsStudents ? 1 : 0,
      consentConfirmed ? 1 : 0,
      status,
      status,
      id,
    ).run();

    await audit(who, "media-update", "media_gallery", id, { status, category, featured });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const runtime = env as typeof env & {
      DB: D1Database;
      MEDIA: R2Bucket;
    };
    const id = text(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ error: "Media ID is required." }, 400);

    const row = await runtime.DB.prepare(`
      SELECT id, storage_key, title
      FROM media_gallery
      WHERE id = ?
      LIMIT 1
    `).bind(id).first<{ id: string; storage_key: string | null; title: string }>();

    if (!row) return json({ error: "Media record not found." }, 404);

    if (row.storage_key) {
      await runtime.MEDIA.delete(row.storage_key);
    }

    await runtime.DB.prepare("DELETE FROM media_gallery WHERE id = ?").bind(id).run();
    await audit(who, "media-delete", "media_gallery", id, { title: row.title });

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
