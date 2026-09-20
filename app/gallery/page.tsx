"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ImageIcon, Play, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./gallery.css";

type MediaItem = {
  id: string;
  title: string;
  caption?: string | null;
  media_type: "image" | "video" | "video_link";
  external_url?: string | null;
  category?: string | null;
  album?: string | null;
  event_date?: string | null;
  is_featured?: number;
  mediaUrl?: string;
};

function youtubeEmbed(urlValue: string) {
  try {
    const url = new URL(urlValue);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace(/^\//, "");
      return id ? `https://www.youtube.com/embed/${id}` : urlValue;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : urlValue;
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : urlValue;
    }
  } catch {}
  return urlValue;
}

export default function GalleryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<MediaItem | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/gallery?limit=100", { cache: "no-store" });
        const result = await response.json() as { data?: MediaItem[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Unable to load gallery.");
        setItems(result.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load gallery.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", key);
    };
  }, [selected]);

  const categories = useMemo(() => [
    "All",
    ...Array.from(new Set(items.map((item) => item.category || "Community"))).sort(),
  ], [items]);

  const visible = category === "All"
    ? items
    : items.filter((item) => (item.category || "Community") === category);

  return (
    <main className="gallery-page">
      <header className="gallery-nav">
        <Link href="/" className="gallery-brand">
          <Image src="/community-logo.png" alt="BNMC" width={52} height={52} priority />
          <span><b>BNMC Madrasah</b><small>Knowledge • Faith • Character</small></span>
        </Link>
        <Link href="/" className="gallery-back"><ArrowLeft /> Back to home</Link>
      </header>

      <section className="gallery-hero">
        <small>BNMC MEDIA GALLERY</small>
        <h1>Life at our Madrasah</h1>
        <p>A glimpse into learning, activities, events and community life at BNMC Madrasah.</p>
      </section>

      <section className="gallery-shell">
        <div className="gallery-filters" aria-label="Gallery categories">
          {categories.map((item) => (
            <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="gallery-state"><ImageIcon /><b>Loading gallery…</b></div>
        ) : error ? (
          <div className="gallery-state error"><b>{error}</b></div>
        ) : visible.length === 0 ? (
          <div className="gallery-state"><ImageIcon /><b>No published media yet</b><p>Please check back soon.</p></div>
        ) : (
          <div className="gallery-grid">
            {visible.map((item) => (
              <button className="gallery-card" key={item.id} onClick={() => setSelected(item)}>
                <div className="gallery-thumb">
                  {item.media_type === "image" ? (
                    <img src={item.mediaUrl} alt={item.title} loading="lazy" />
                  ) : item.media_type === "video" ? (
                    <video src={item.mediaUrl} preload="metadata" muted />
                  ) : (
                    <div className="video-link-thumb"><Play /></div>
                  )}
                  {item.media_type !== "image" && <span className="play-badge"><Play /></span>}
                  {item.is_featured ? <span className="featured-badge">Featured</span> : null}
                </div>
                <div className="gallery-copy">
                  <small>{item.category || "Community"}</small>
                  <strong>{item.title}</strong>
                  {item.caption ? <p>{item.caption}</p> : null}
                  {item.event_date ? <time>{new Date(`${item.event_date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="gallery-lightbox" role="presentation" onClick={() => setSelected(null)}>
          <div className="gallery-lightbox-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="gallery-lightbox-close" aria-label="Close" onClick={() => setSelected(null)}><X /></button>
            <div className="gallery-lightbox-media">
              {selected.media_type === "image" ? (
                <img src={selected.mediaUrl} alt={selected.title} />
              ) : selected.media_type === "video" ? (
                <video src={selected.mediaUrl} controls autoPlay playsInline />
              ) : (
                <iframe
                  src={youtubeEmbed(selected.external_url || selected.mediaUrl || "")}
                  title={selected.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>
            <div className="gallery-lightbox-copy">
              <small>{selected.category || "Community"}</small>
              <h2>{selected.title}</h2>
              {selected.caption ? <p>{selected.caption}</p> : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
