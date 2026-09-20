"use client";

import Link from "next/link";

import {
  ArrowRight,
  Quote,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

type PublicHomepageSettings = {
  announcement?: {
    enabled?: boolean;
    text?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  testimonial?: {
    quote?: string;
    author?: string;
  };
};

function useHomepageSettings() {
  const [
    settings,
    setSettings,
  ] =
    useState<PublicHomepageSettings>(
      {},
    );

  useEffect(
    () => {
      let mounted =
        true;

      fetch(
        "/api/public/homepage",
        {
          cache:
            "no-store",
        },
      )
        .then(
          async (
            response,
          ) => {
            const result =
              (await response
                .json()
                .catch(
                  () => ({}),
                )) as {
                data?:
                  PublicHomepageSettings;
              };

            if (
              mounted &&
              response.ok
            ) {
              setSettings(
                result.data ??
                  {},
              );
            }
          },
        )
        .catch(
          () => {},
        );

      return () => {
        mounted =
          false;
      };
    },
    [],
  );

  return settings;
}

export function PremiumAnnouncement() {
  const settings =
    useHomepageSettings();

  const announcement =
    settings.announcement;

  if (
    announcement
      ?.enabled ===
    false
  ) {
    return null;
  }

  const text =
    announcement
      ?.text ||
    "Bismillah — begin your child's BNMC Madrasah journey";

  const ctaLabel =
    announcement
      ?.ctaLabel ||
    "Apply now";

  const ctaUrl =
    announcement
      ?.ctaUrl ||
    "/apply";

  return (
    <div className="bnmc-announcement">
      <div className="bnmc-announcement-inner">
        <span>
          <i aria-hidden="true">
            ☾
          </i>

          {text}
        </span>

        {ctaLabel &&
          ctaUrl && (
          <Link
            href={
              ctaUrl
            }
          >
            {ctaLabel}
            <ArrowRight />
          </Link>
        )}
      </div>
    </div>
  );
}

export function PremiumTestimonial() {
  const settings =
    useHomepageSettings();

  const quote =
    settings.testimonial
      ?.quote ||
    "A warm and nurturing environment where children can grow in knowledge, faith and character.";

  const author =
    settings.testimonial
      ?.author ||
    "BNMC Parent";

  if (
    !quote
  ) {
    return null;
  }

  return (
    <blockquote className="bnmc-dynamic-testimonial">
      <Quote />

      <p>
        “{quote}”
      </p>

      <footer>
        — {author}
      </footer>
    </blockquote>
  );
}
