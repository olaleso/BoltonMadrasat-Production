"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileVideo2, ImagePlus, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import "./media-gallery.css";

type MediaRow = {
  id: string;
  title: string;
  caption?: string | null;
  media_type: "image" | "video" | "video_link";
  external_url?: string | null;
  mediaUrl?: string;
  category?: string | null;
  album?: string | null;
  event_date?: string | null;
  is_featured?: number;
  use_in_carousel?: number;
  carousel_sort_order?: number;
  status: "draft" | "published" | "archived";
  contains_students?: number;
  photo_consent_confirmed?: number;
  created_at?: string;
};

const categories = ["Classes", "Events", "Qur'an", "Community", "Awards & Achievements"];

export default function MediaGalleryAdminPage() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [status, setStatus] = useState<"all" | "published" | "draft" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Community");
  const [album, setAlbum] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">("draft");
  const [featured, setFeatured] = useState(false);
  const [containsStudents, setContainsStudents] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [useInCarousel, setUseInCarousel] = useState(false);
  const [carouselSortOrder, setCarouselSortOrder] = useState("0");
  const [editingRow, setEditingRow] = useState<MediaRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const response = await fetch(`/api/v1/media-gallery${query}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (response.status === 403) {
        window.location.assign("/portal");
        return;
      }
      const result = await response.json() as { data?: MediaRow[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load media gallery.");
      setRows(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load media gallery.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    published: rows.filter((row) => row.status === "published").length,
    draft: rows.filter((row) => row.status === "draft").length,
    archived: rows.filter((row) => row.status === "archived").length,
  }), [rows]);

  function resetForm() {
    setFiles([]);
    setTitle("");
    setCaption("");
    setCategory("Community");
    setAlbum("");
    setEventDate("");
    setExternalUrl("");
    setPublishStatus("draft");
    setFeatured(false);
    setContainsStudents(false);
    setConsentConfirmed(false);
    setUseInCarousel(false);
    setCarouselSortOrder("0");
    setEditingRow(null);
  }

  function openEdit(row: MediaRow) {
    setEditingRow(row);
    setFiles([]);
    setTitle(row.title ?? "");
    setCaption(row.caption ?? "");
    setCategory(row.category ?? "Community");
    setAlbum(row.album ?? "");
    setEventDate(row.event_date ?? "");
    setExternalUrl(row.external_url ?? "");
    setPublishStatus(row.status === "published" ? "published" : "draft");
    setFeatured(Boolean(row.is_featured));
    setContainsStudents(Boolean(row.contains_students));
    setConsentConfirmed(Boolean(row.photo_consent_confirmed));
    setUseInCarousel(Boolean(row.use_in_carousel));
    setCarouselSortOrder(String(row.carousel_sort_order ?? 0));
    setShowUpload(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (containsStudents && !consentConfirmed) {
      setError("Confirm photo/media consent before saving media containing students.");
      return;
    }
    if (useInCarousel && publishStatus !== "published") {
      setError("Homepage carousel media must be published first.");
      return;
    }
    if (useInCarousel && editingRow?.media_type !== "image" && editingRow) {
      setError("Only published images can be used in the homepage carousel.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (editingRow) {
        const response = await fetch("/api/v1/media-gallery", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: editingRow.id,
            title,
            caption,
            category,
            album,
            eventDate,
            status: publishStatus,
            isFeatured: featured,
            containsStudents,
            photoConsentConfirmed: consentConfirmed,
            useInCarousel,
            carouselSortOrder: Number(carouselSortOrder || 0),
          }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Unable to save media changes.");
        setMessage("Media item updated successfully.");
      } else {
        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        form.set("title", title);
        form.set("caption", caption);
        form.set("category", category);
        form.set("album", album);
        form.set("eventDate", eventDate);
        form.set("externalUrl", externalUrl);
        form.set("status", publishStatus);
        form.set("isFeatured", featured ? "1" : "0");
        form.set("containsStudents", containsStudents ? "1" : "0");
        form.set("photoConsentConfirmed", consentConfirmed ? "1" : "0");
        form.set("useInCarousel", useInCarousel ? "1" : "0");
        form.set("carouselSortOrder", carouselSortOrder || "0");

        const response = await fetch("/api/v1/media-gallery", { method: "POST", body: form });
        const result = await response.json().catch(() => ({})) as { created?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        setMessage(`${Number(result.created ?? 0)} media item${Number(result.created ?? 0) === 1 ? "" : "s"} saved successfully.`);
      }

      resetForm();
      setShowUpload(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingRow ? "Unable to save media changes." : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function updateRow(row: MediaRow, nextStatus: MediaRow["status"], nextFeatured = Boolean(row.is_featured)) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/media-gallery", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          title: row.title,
          caption: row.caption || "",
          category: row.category || "Community",
          album: row.album || "",
          eventDate: row.event_date || "",
          status: nextStatus,
          isFeatured: nextFeatured,
          containsStudents: Boolean(row.contains_students),
          photoConsentConfirmed: Boolean(row.photo_consent_confirmed),
          useInCarousel: nextStatus === "published" ? Boolean(row.use_in_carousel) : false,
          carouselSortOrder: Number(row.carousel_sort_order ?? 0),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update media.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update media.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: MediaRow) {
    if (!window.confirm(`Permanently delete “${row.title}”? This also removes the stored media file.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/media-gallery?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to delete media.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete media.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="media-admin-page">
      <header className="media-admin-topbar">
        <button onClick={() => window.location.assign("/portal")}><ArrowLeft /> Back to portal</button>
        <div><b>BNMC Madrasah</b><small>Media Gallery</small></div>
      </header>

      <section className="media-admin-shell">
        <div className="media-admin-heading">
          <div><small>PUBLIC WEBSITE</small><h1>Media Gallery</h1><p>Upload, review and publish photos and videos for the public BNMC gallery.</p></div>
          <span>
            <button className="secondary" onClick={load} disabled={loading || busy}><RefreshCw /> Refresh</button>
            <button className="primary" onClick={() => setShowUpload(true)}><ImagePlus /> Upload media</button>
          </span>
        </div>

        <div className="media-admin-metrics">
          <article><b>{counts.published}</b><span>Published</span></article>
          <article><b>{counts.draft}</b><span>Drafts</span></article>
          <article><b>{counts.archived}</b><span>Archived</span></article>
        </div>

        <div className="media-admin-tabs">
          {(["all", "published", "draft", "archived"] as const).map((item) => (
            <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item === "all" ? "All media" : item[0].toUpperCase() + item.slice(1)}</button>
          ))}
        </div>

        {error ? <div className="media-admin-message error">{error}</div> : null}
        {message ? <div className="media-admin-message success"><CheckCircle2 /> {message}</div> : null}

        {loading ? <div className="media-admin-empty"><RefreshCw /> Loading media…</div> : rows.length === 0 ? (
          <div className="media-admin-empty"><FileVideo2 /><b>No media here yet</b><p>Upload photos or videos to begin building the public gallery.</p></div>
        ) : (
          <div className="media-admin-grid">
            {rows.map((row) => (
              <article className="media-admin-card" key={row.id}>
                <div className="media-admin-thumb">
                  {row.media_type === "image" ? <img src={row.mediaUrl} alt={row.title} /> : row.media_type === "video" ? <video src={row.mediaUrl} muted preload="metadata" /> : <div><FileVideo2 /><span>External video</span></div>}
                  <span className={`status ${row.status}`}>{row.status}</span>
                </div>
                <div className="media-admin-copy">
                  <small>{row.category || "Community"}</small>
                  <h3>{row.title}</h3>
                  {row.caption ? <p>{row.caption}</p> : null}
                  <div className="media-admin-flags">
                    {row.is_featured ? <span>Featured</span> : null}
                    {row.use_in_carousel ? <span>Homepage carousel</span> : null}
                    {row.contains_students ? <span>Students shown</span> : null}
                    {row.photo_consent_confirmed ? <span>Consent confirmed</span> : null}
                  </div>
                  <div className="media-admin-actions">
                    <button onClick={() => openEdit(row)} disabled={busy}><Pencil /> Edit</button>
                    {row.status !== "published" ? <button onClick={() => updateRow(row, "published")} disabled={busy}>Publish</button> : <button onClick={() => updateRow(row, "draft")} disabled={busy}>Unpublish</button>}
                    <button onClick={() => updateRow(row, row.status, !Boolean(row.is_featured))} disabled={busy}>{row.is_featured ? "Remove featured" : "Feature"}</button>
                    {row.status !== "archived" ? <button onClick={() => updateRow(row, "archived")} disabled={busy}>Archive</button> : null}
                    <button className="danger" onClick={() => remove(row)} disabled={busy}><Trash2 /> Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showUpload && (
        <div className="media-modal-overlay" onClick={() => !busy && setShowUpload(false)}>
          <form className="media-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <header><div><small>MEDIA GALLERY</small><h2>{editingRow ? "Edit media" : "Upload media"}</h2><p>{editingRow ? "Update the title, caption, publishing status and homepage placement." : "Save as draft first, or publish when the media is ready for the public website."}</p></div><button type="button" onClick={() => { setShowUpload(false); resetForm(); }} disabled={busy}><X /></button></header>
            <section className="media-modal-body">
              {!editingRow ? (
                <>
                  <label className="media-upload-zone"><Upload /><b>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose photos or videos"}</b><span>JPG, PNG, WebP, GIF, MP4, WebM or MOV</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} disabled={Boolean(externalUrl)} /></label>
                  <div className="media-divider"><span>OR</span></div>
                  <label><span>YouTube / Vimeo link</span><input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://youtu.be/..." disabled={files.length > 0} /></label>
                </>
              ) : (
                <div className="media-edit-note">The existing media file is retained. Use this form to update its information and publishing options.</div>
              )}
              <div className="media-form-grid">
                <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Qur'an Class Celebration" /></label>
                <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Album / event</span><input value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Optional" /></label>
                <label><span>Event date</span><input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
                <label className="wide"><span>Caption</span><textarea rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Optional public caption" /></label>
                <label><span>Status</span><select value={publishStatus} onChange={(event) => setPublishStatus(event.target.value as "draft" | "published")}><option value="draft">Draft</option><option value="published">Published</option></select></label>
              </div>
              <label className="media-check"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /><span><b>Feature on homepage</b><small>Highlights this media in the public gallery preview.</small></span></label>
              <label className="media-check"><input type="checkbox" checked={useInCarousel} onChange={(event) => setUseInCarousel(event.target.checked)} disabled={(editingRow?.media_type ?? (files[0]?.type?.startsWith("image/") ? "image" : "")) !== "image" || publishStatus !== "published"} /><span><b>Use in public homepage carousel</b><small>Published photos selected here replace the existing calligraphy slides.</small></span></label>
              {useInCarousel ? <label><span>Carousel order</span><input type="number" min="0" step="1" value={carouselSortOrder} onChange={(event) => setCarouselSortOrder(event.target.value)} /></label> : null}
              <label className="media-check"><input type="checkbox" checked={containsStudents} onChange={(event) => { setContainsStudents(event.target.checked); if (!event.target.checked) setConsentConfirmed(false); }} /><span><b>This media contains identifiable students</b><small>Use this whenever a child can be recognised in the photo or video.</small></span></label>
              {containsStudents ? <label className="media-check consent"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /><span><b>Photo/media consent has been confirmed</b><small>Required before this media can be saved or published.</small></span></label> : null}
            </section>
            <footer><button type="button" className="secondary" onClick={() => { setShowUpload(false); resetForm(); }} disabled={busy}>Cancel</button><button type="submit" className="primary" disabled={busy || (!editingRow && !files.length && !externalUrl)}>{busy ? "Saving…" : editingRow ? "Save changes" : publishStatus === "published" ? "Upload & publish" : "Save draft"}</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}
