"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./gallery-preview.module.css";

type MediaItem = {
  id: string;
  title: string;
  media_type: "image" | "video" | "video_link";
  mediaUrl?: string;
  category?: string | null;
  external_url?: string | null;
};

export default function PublicGalleryPreview() {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        let response = await fetch("/api/gallery?featured=1&limit=6", { cache: "no-store" });
        let result = await response.json() as { data?: MediaItem[] };
        let data = result.data ?? [];
        if (!data.length) {
          response = await fetch("/api/gallery?limit=6", { cache: "no-store" });
          result = await response.json() as { data?: MediaItem[] };
          data = result.data ?? [];
        }
        setItems(data);
      } catch {
        setItems([]);
      }
    }
    load();
  }, []);

  if (!items.length) return null;

  return (
    <section className={styles.section} id="gallery">
      <div className={styles.heading}>
        <div>
          <small>Life at BNMC</small>
          <h2>Moments from our Madrasah</h2>
          <p>A glimpse into learning, Qur'an activities, events and community life.</p>
        </div>
        <Link href="/gallery">View full gallery <ArrowRight /></Link>
      </div>

      <div className={styles.grid}>
        {items.map((item, index) => (
          <Link href="/gallery" className={`${styles.card} ${index === 0 ? styles.large : ""}`} key={item.id}>
            {item.media_type === "image" ? (
              <img src={item.mediaUrl} alt={item.title} loading="lazy" />
            ) : item.media_type === "video" ? (
              <video src={item.mediaUrl} muted preload="metadata" />
            ) : (
              <div className={styles.videoPlaceholder}><Play /></div>
            )}
            {item.media_type !== "image" ? <span className={styles.play}><Play /></span> : null}
            <span className={styles.overlay}>
              <small>{item.category || "Community"}</small>
              <b>{item.title}</b>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
