import { d1 } from "@/db";

const defaults: Record<string, string> = {
  homepage_announcement_enabled:
    "true",
  homepage_announcement_text:
    "Bismillah — begin your child's BNMC Madrasah journey",
  homepage_announcement_cta_label:
    "Apply now",
  homepage_announcement_cta_url:
    "/apply",
  homepage_testimonial_quote:
    "A warm and nurturing environment where children can grow in knowledge, faith and character.",
  homepage_testimonial_author:
    "BNMC Parent",
  homepage_hero_media_ids:
    "[]",
};

export async function GET() {
  const keys =
    Object.keys(
      defaults,
    );

  const result =
    await d1()
      .prepare(
        `select
           key,
           value
         from app_settings
         where key in (${keys
           .map(
             () => "?",
           )
           .join(",")})`,
      )
      .bind(
        ...keys,
      )
      .all<{
        key: string;
        value: string;
      }>();

  const settings = {
    ...defaults,
  };

  for (
    const row of
      result.results ??
      []
  ) {
    if (
      row.key in
      settings
    ) {
      settings[
        row.key
      ] =
        String(
          row.value ??
            "",
        );
    }
  }

  let heroMediaIds:
    string[] =
      [];

  try {
    const parsed =
      JSON.parse(
        settings.homepage_hero_media_ids ||
          "[]",
      );

    if (
      Array.isArray(
        parsed,
      )
    ) {
      heroMediaIds =
        parsed
          .filter(
            (value) =>
              typeof value ===
              "string",
          )
          .slice(
            0,
            6,
          );
    }
  }
  catch {}

  return Response.json(
    {
      ok: true,
      data: {
        announcement: {
          enabled:
            settings.homepage_announcement_enabled !==
            "false",
          text:
            settings.homepage_announcement_text,
          ctaLabel:
            settings.homepage_announcement_cta_label,
          ctaUrl:
            settings.homepage_announcement_cta_url,
        },
        testimonial: {
          quote:
            settings.homepage_testimonial_quote,
          author:
            settings.homepage_testimonial_author,
        },
        heroMediaIds,
      },
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
