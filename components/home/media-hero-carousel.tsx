"use client";

import { useEffect, useState } from "react";
import LegacyHeroCarousel from "@/components/home/hero-carousel";
import styles from "./media-hero-carousel.module.css";

type Slide = {
  id: string;
  title?: string;
  caption?: string;
  mediaUrl: string;
};

export default function MediaHeroCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let mounted = true;

    fetch("/api/gallery/carousel", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          data?: Slide[];
        };
        if (mounted && response.ok) {
          setSlides(result.data ?? []);
        }
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!loaded || slides.length === 0) {
    return <LegacyHeroCarousel />;
  }

  return (
    <section className={styles.carousel} aria-label="BNMC Madrasah photo carousel">
      <div className={styles.slides}>
        {slides.map((slide, index) => (
          <article
            key={slide.id}
            className={`${styles.slide} ${index === active ? styles.active : ""}`}
            aria-hidden={index !== active}
          >
            <img src={slide.mediaUrl} alt={slide.title || "BNMC Madrasah"} />
            {(slide.title || slide.caption) && (
              <div className={styles.caption}>
                {slide.title ? <strong>{slide.title}</strong> : null}
                {slide.caption ? <span>{slide.caption}</span> : null}
              </div>
            )}
          </article>
        ))}
      </div>

      {slides.length > 1 && (
        <div className={styles.dots} aria-label="Choose carousel slide">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              aria-label={`Show slide ${index + 1}`}
              aria-current={index === active}
              className={index === active ? styles.dotActive : styles.dot}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
