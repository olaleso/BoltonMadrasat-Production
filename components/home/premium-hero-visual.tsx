"use client";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Slide = {
  id: string;
  title?: string;
  caption?: string;
  mediaUrl: string;
};

const fallbackSlides:
  Slide[] = [
    {
      id:
        "fallback-1",
      title:
        "Learning together",
      caption:
        "Knowledge, faith and character.",
      mediaUrl:
        "/hero/mosque-evening.jpg",
    },

    {
      id:
        "fallback-2",
      title:
        "Growing in faith",
      caption:
        "A nurturing Islamic learning environment.",
      mediaUrl:
        "/hero/islamic-calligraphy.jpg",
    },

    {
      id:
        "fallback-3",
      title:
        "A place to belong",
      caption:
        "Rooted in community.",
      mediaUrl:
        "/hero/mosque-arches.jpg",
    },
  ];

export default function PremiumHeroVisual() {
  const [
    slides,
    setSlides,
  ] =
    useState<
      Slide[]
    >(
      fallbackSlides,
    );

  const [
    active,
    setActive,
  ] =
    useState(
      0,
    );

  useEffect(
    () => {
      let mounted =
        true;

      async function load() {
        try {
          let selectedIds:
            string[] =
              [];

          try {
            const settingsResponse =
              await fetch(
                "/api/public/homepage",
                {
                  cache:
                    "no-store",
                },
              );

            const settingsResult =
              (await settingsResponse
                .json()
                .catch(
                  () => ({}),
                )) as {
                data?: {
                  heroMediaIds?: string[];
                };
              };

            if (
              settingsResponse.ok &&
              Array.isArray(
                settingsResult.data
                  ?.heroMediaIds,
              )
            ) {
              selectedIds =
                settingsResult.data
                  ?.heroMediaIds ??
                [];
            }
          }
          catch {}

          if (
            selectedIds.length
          ) {
            const galleryResponse =
              await fetch(
                "/api/gallery?limit=60",
                {
                  cache:
                    "no-store",
                },
              );

            const galleryResult =
              (await galleryResponse
                .json()
                .catch(
                  () => ({}),
                )) as {
                data?: Array<{
                  id: string;
                  title?: string;
                  caption?: string;
                  media_type?: string;
                  mediaUrl?: string;
                }>;
              };

            const byId =
              new Map(
                (
                  galleryResult.data ??
                  []
                ).map(
                  (item) => [
                    item.id,
                    item,
                  ],
                ),
              );

            const selected =
              selectedIds
                .map(
                  (id) =>
                    byId.get(
                      id,
                    ),
                )
                .filter(
                  (
                    item,
                  ): item is NonNullable<
                    typeof item
                  > =>
                    Boolean(
                      item &&
                      item.media_type ===
                        "image" &&
                      item.mediaUrl,
                    ),
                )
                .map(
                  (item) => ({
                    id:
                      item.id,
                    title:
                      item.title,
                    caption:
                      item.caption,
                    mediaUrl:
                      item.mediaUrl!,
                  }),
                );

            if (
              mounted &&
              selected.length
            ) {
              setSlides(
                selected.slice(
                  0,
                  6,
                ),
              );

              setActive(
                0,
              );

              return;
            }
          }

          let response =
            await fetch(
              "/api/gallery/carousel",
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
                Slide[];
            };

          let data =
            (
              result.data ??
              []
            ).filter(
              (item) =>
                item.mediaUrl,
            );

          if (
            !data.length
          ) {
            response =
              await fetch(
                "/api/gallery?featured=1&limit=6",
                {
                  cache:
                    "no-store",
                },
              );

            const gallery =
              (await response
                .json()
                .catch(
                  () => ({}),
                )) as {
                data?: Array<{
                  id: string;
                  title?: string;
                  caption?: string;
                  media_type?: string;
                  mediaUrl?: string;
                }>;
              };

            data =
              (
                gallery.data ??
                []
              )
                .filter(
                  (item) =>
                    item.media_type ===
                      "image" &&
                    item.mediaUrl,
                )
                .map(
                  (item) => ({
                    id:
                      item.id,
                    title:
                      item.title,
                    caption:
                      item.caption,
                    mediaUrl:
                      item.mediaUrl!,
                  }),
                );
          }

          if (
            mounted &&
            data.length
          ) {
            setSlides(
              data.slice(
                0,
                6,
              ),
            );
            setActive(
              0,
            );
          }
        } catch {
          // Existing static hero images remain as a safe fallback.
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

  useEffect(
    () => {
      if (
        slides.length <
        2
      ) {
        return;
      }

      const timer =
        window.setInterval(
          () =>
            setActive(
              (current) =>
                (
                  current +
                  1
                ) %
                slides.length,
            ),
          6500,
        );

      return () =>
        window.clearInterval(
          timer,
        );
    },
    [
      slides.length,
    ],
  );

  const thumbnails =
    useMemo(
      () =>
        slides
          .filter(
            (
              _,
              index,
            ) =>
              index !==
              active,
          )
          .slice(
            0,
            2,
          ),
      [
        slides,
        active,
      ],
    );

  function move(
    direction:
      -1 |
      1,
  ) {
    setActive(
      (current) =>
        (
          current +
          direction +
          slides.length
        ) %
        slides.length,
    );
  }

  const current =
    slides[
      active
    ] ??
    fallbackSlides[0];

  return (
    <div className="bnmc-premium-hero-visual">
      <div className="bnmc-hero-arch">
        <img
          src={
            current.mediaUrl
          }
          alt={
            current.title ||
            "BNMC Madrasah community"
          }
        />

        <div className="bnmc-hero-image-caption">
          <small>
            Moments at BNMC
          </small>

          <strong>
            {current.title ||
              "Learning together"}
          </strong>
        </div>

        {slides.length >
          1 && (
          <div className="bnmc-hero-image-controls">
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() =>
                move(
                  -1,
                )
              }
            >
              <ChevronLeft />
            </button>

            <button
              type="button"
              aria-label="Next photo"
              onClick={() =>
                move(
                  1,
                )
              }
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>

      <div className="bnmc-hero-polaroids">
        {thumbnails.map(
          (
            slide,
            index,
          ) => (
            <button
              type="button"
              key={
                slide.id
              }
              className={
                index ===
                1
                  ? "tilted"
                  : ""
              }
              onClick={() =>
                setActive(
                  slides.findIndex(
                    (
                      item,
                    ) =>
                      item.id ===
                      slide.id,
                  ),
                )
              }
              aria-label={`Show ${slide.title || "photo"}`}
            >
              <img
                src={
                  slide.mediaUrl
                }
                alt=""
              />
            </button>
          ),
        )}
      </div>

      <div className="bnmc-hero-handwritten">
        <span>
          A place to learn
        </span>

        <span>
          A place to belong
        </span>

        <strong>
          A brighter tomorrow
        </strong>
      </div>
    </div>
  );
}
