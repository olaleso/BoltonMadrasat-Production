"use client";

import Link from "next/link";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type MediaItem = {
  id: string;
  title: string;
  media_type:
    | "image"
    | "video"
    | "video_link";
  mediaUrl?: string;
  category?: string | null;
};

export default function PremiumGallery() {
  const [
    items,
    setItems,
  ] =
    useState<
      MediaItem[]
    >([]);

  const rail =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(
    () => {
      let mounted =
        true;

      async function load() {
        try {
          let response =
            await fetch(
              "/api/gallery?featured=1&limit=8",
              {
                cache:
                  "no-store",
              },
            );

          let result =
            (await response
              .json()
              .catch(
                () => ({}),
              )) as {
              data?:
                MediaItem[];
            };

          let data =
            result.data ??
            [];

          if (
            !data.length
          ) {
            response =
              await fetch(
                "/api/gallery?limit=8",
                {
                  cache:
                    "no-store",
                },
              );

            result =
              (await response
                .json()
                .catch(
                  () => ({}),
                )) as {
                data?:
                  MediaItem[];
              };

            data =
              result.data ??
              [];
          }

          if (
            mounted
          ) {
            setItems(
              data,
            );
          }
        } catch {
          if (
            mounted
          ) {
            setItems(
              [],
            );
          }
        }
      }

      load();

      return () => {
        mounted =
          false;
      };
    },
    [],
  );

  if (
    !items.length
  ) {
    return null;
  }

  function move(
    direction:
      -1 |
      1,
  ) {
    rail.current
      ?.scrollBy({
        left:
          direction *
          Math.max(
            280,
            rail.current
              .clientWidth *
              0.72,
          ),
        behavior:
          "smooth",
      });
  }

  return (
    <section
      className="bnmc-gallery-section"
      id="gallery"
    >
      <header className="bnmc-section-heading split">
        <div>
          <p className="bnmc-kicker">
            Moments from the Madrasah
          </p>

          <h2>
            Real learning. Real community.
          </h2>

          <p>
            A glimpse into the learning and community life of BNMC Madrasah.
          </p>
        </div>

        <Link
          href="/gallery"
          className="bnmc-gallery-link"
        >
          View full gallery
          <ArrowRight />
        </Link>
      </header>

      <div className="bnmc-gallery-wrap">
        <button
          type="button"
          className="bnmc-gallery-arrow previous"
          aria-label="Previous gallery items"
          onClick={() =>
            move(
              -1,
            )
          }
        >
          <ChevronLeft />
        </button>

        <div
          className="bnmc-gallery-rail"
          ref={
            rail
          }
        >
          {items.map(
            (
              item,
              index,
            ) => (
              <Link
                href="/gallery"
                key={
                  item.id
                }
                className={`bnmc-gallery-card ${
                  index ===
                  0
                    ? "featured"
                    : ""
                }`}
              >
                {item.media_type ===
                  "image" &&
                item.mediaUrl ? (
                  <img
                    src={
                      item.mediaUrl
                    }
                    alt={
                      item.title ||
                      "BNMC Madrasah"
                    }
                    loading="lazy"
                  />
                ) : item.media_type ===
                    "video" &&
                  item.mediaUrl ? (
                  <video
                    src={
                      item.mediaUrl
                    }
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="bnmc-gallery-video-placeholder">
                    <Play />
                  </div>
                )}

                {item.media_type !==
                  "image" && (
                  <i className="bnmc-gallery-play">
                    <Play />
                  </i>
                )}

                <span>
                  <small>
                    {item.category ||
                      "BNMC community"}
                  </small>

                  <b>
                    {item.title ||
                      "Madrasah moment"}
                  </b>
                </span>
              </Link>
            ),
          )}
        </div>

        <button
          type="button"
          className="bnmc-gallery-arrow next"
          aria-label="Next gallery items"
          onClick={() =>
            move(
              1,
            )
          }
        >
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
