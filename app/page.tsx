import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Heart,
  Landmark,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";

import PremiumPublicHeader from "@/components/home/premium-public-header";
import PremiumHeroVisual from "@/components/home/premium-hero-visual";
import PremiumGallery from "@/components/home/premium-gallery";
import {
  PremiumAnnouncement,
  PremiumTestimonial,
} from "@/components/home/premium-home-dynamic";

import "./home.css";

const pillars = [
  {
    icon: BookOpen,
    title: "Knowledge",
    text:
      "Qur’an, Arabic and Islamic learning that gives every child a strong foundation.",
  },
  {
    icon: Landmark,
    title: "Faith",
    text:
      "Nurturing love of Allah, confidence in worship and a meaningful Islamic identity.",
  },
  {
    icon: GraduationCap,
    title: "Character",
    text:
      "Helping children grow in adab, responsibility, kindness and confidence.",
  },
  {
    icon: Heart,
    title: "Community",
    text:
      "A warm learning environment where children and families feel known and supported.",
  },
];

const learning = [
  {
    icon: BookOpen,
    title: "Qur’an & Tajweed",
    text:
      "Learn to read, recite and grow in love for the Qur’an with structured support.",
  },
  {
    icon: Landmark,
    title: "Islamic Studies",
    text:
      "Build strong foundations in belief, worship, seerah and everyday Islamic practice.",
  },
  {
    icon: Users,
    title: "Age-appropriate classes",
    text:
      "Learning groups designed around children’s stage, confidence and development.",
  },
  {
    icon: Heart,
    title: "Character & life skills",
    text:
      "Putting Islamic values into practice through manners, responsibility and community.",
  },
];

const admissions = [
  {
    number: "01",
    title: "Apply online",
    text:
      "Complete the secure application form from your phone, tablet or computer.",
  },
  {
    number: "02",
    title: "Review & assessment",
    text:
      "The Madrasah reviews the application and confirms the appropriate next step.",
  },
  {
    number: "03",
    title: "Receive your offer",
    text:
      "Parents receive confirmation and secure portal account setup instructions.",
  },
  {
    number: "04",
    title: "Join the community",
    text:
      "Your child is placed into the right class and their learning journey begins.",
  },
];

const parentFeatures = [
  {
    icon: Users,
    title: "Parent portal",
    text:
      "Keep each child’s key information together in one secure place.",
  },
  {
    icon: BarChart3,
    title: "Track progress",
    text:
      "See attendance, learning progress and the next steps recorded by teachers.",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    text:
      "Receive announcements and important updates directly from the Madrasah.",
  },
  {
    icon: CreditCard,
    title: "Easy payments",
    text:
      "View invoices and manage fee payments through a clear family experience.",
  },
];

export default function HomePage() {
  return (
    <main className="bnmc-public-home">
      <PremiumAnnouncement />

      <PremiumPublicHeader />

      <section className="bnmc-hero" aria-labelledby="bnmc-hero-title">
        <div className="bnmc-hero-pattern" aria-hidden="true" />

        <div className="bnmc-hero-copy">
          <p className="bnmc-eyebrow">
            A welcoming Islamic school for our community
          </p>

          <h1 id="bnmc-hero-title">
            Nurturing
            <span>Knowledge, Faith</span>
            <strong>&amp; Character</strong>
          </h1>

          <p className="bnmc-hero-lead">
            BNMC Madrasah provides a safe, nurturing and inspiring environment
            where children learn the Qur&apos;an, strengthen their faith and
            develop character for life.
          </p>

          <div className="bnmc-hero-actions">
            <Link className="bnmc-btn bnmc-btn-primary" href="/apply">
              Apply for admission
              <ArrowRight />
            </Link>

            <a className="bnmc-btn bnmc-btn-secondary" href="#learning">
              Explore the Madrasah
              <ArrowRight />
            </a>
          </div>

          <div className="bnmc-hero-trust" aria-label="BNMC highlights">
            <span>
              <BookOpen />
              Islamic education
            </span>

            <span>
              <Users />
              Caring teachers
            </span>

            <span>
              <Heart />
              Strong community
            </span>
          </div>
        </div>

        <div className="bnmc-hero-visual-wrap">
          <PremiumHeroVisual />

          <aside className="bnmc-hero-verse">
            <b lang="ar" dir="rtl">
              رَبِّ زِدْنِي عِلْمًا
            </b>

            <span>
              “My Lord, increase me in knowledge.”
            </span>

            <small>Qur&apos;an 20:114</small>
          </aside>
        </div>
      </section>

      <section className="bnmc-section bnmc-pillars" id="about">
        <header className="bnmc-section-heading centered">
          <span className="bnmc-ornament" aria-hidden="true">
            ✦
          </span>

          <p className="bnmc-kicker">
            Why BNMC Madrasah?
          </p>

          <h2>
            More than a Madrasah — a foundation for life.
          </h2>
        </header>

        <div className="bnmc-pillar-grid">
          {pillars.map(({ icon: Icon, title, text }) => (
            <article key={title} className="bnmc-pillar-card">
              <i>
                <Icon />
              </i>

              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bnmc-learning-section" id="learning">
        <div className="bnmc-learning-pattern" aria-hidden="true" />

        <header className="bnmc-section-heading split">
          <div>
            <p className="bnmc-kicker">
              Our learning path
            </p>

            <h2>
              A lifetime of guidance begins here.
            </h2>

            <p>
              Structured learning that helps every child grow in recitation,
              understanding, confidence and character.
            </p>
          </div>

          <span className="bnmc-section-note">
            Knowledge today.
            <br />
            Brighter tomorrows.
          </span>
        </header>

        <div className="bnmc-learning-grid">
          {learning.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <i>
                <Icon />
              </i>

              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bnmc-admissions-section" id="admissions">
        <header className="bnmc-section-heading centered">
          <p className="bnmc-kicker">
            Admissions
          </p>

          <h2>
            Your child&apos;s journey starts here.
          </h2>

          <p>
            A simple and transparent admissions process designed around
            families.
          </p>
        </header>

        <div className="bnmc-journey">
          {admissions.map((step, index) => (
            <article key={step.number}>
              <span>
                {step.number}
              </span>

              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>

              {index < admissions.length - 1 && (
                <ArrowRight className="bnmc-journey-arrow" aria-hidden="true" />
              )}
            </article>
          ))}
        </div>

        <div className="bnmc-admissions-actions">
          <Link className="bnmc-btn bnmc-btn-gold" href="/apply">
            Start an application
            <ArrowRight />
          </Link>

          <Link className="bnmc-text-link" href="/login">
            Already part of BNMC?
            <span>
              Open parent portal
              <ArrowRight />
            </span>
          </Link>
        </div>
      </section>

      <section className="bnmc-parent-section">
        <div className="bnmc-parent-visual" aria-hidden="true">
          <div className="bnmc-parent-arch">
            <Image
              src="/community-logo.png"
              alt=""
              width={180}
              height={180}
            />
          </div>

          <div className="bnmc-parent-visual-copy">
            <small>
              One connected experience
            </small>

            <strong>
              Home and Madrasah, working together.
            </strong>
          </div>
        </div>

        <div className="bnmc-parent-copy">
          <header className="bnmc-section-heading">
            <p className="bnmc-kicker">
              A connected parent experience
            </p>

            <h2>
              Stay informed. Stay involved. Support the journey.
            </h2>

            <p>
              The BNMC parent portal keeps important information, progress,
              communication and payments together.
            </p>
          </header>

          <div className="bnmc-parent-features">
            {parentFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <i>
                  <Icon />
                </i>

                <span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </span>
              </article>
            ))}
          </div>

          <Link className="bnmc-btn bnmc-btn-primary" href="/login">
            Access parent portal
            <ArrowRight />
          </Link>
        </div>
      </section>

      <PremiumGallery />

      <section className="bnmc-community-section">
        <div className="bnmc-community-pattern" aria-hidden="true" />

        <div className="bnmc-community-quote">
          <BookOpen />

          <blockquote>
            “The best of you are those who learn the Qur&apos;an and teach it.”
          </blockquote>

          <small>
            Sahih al-Bukhari
          </small>
        </div>

        <div className="bnmc-community-promise">
          <p className="bnmc-kicker light">
            Our community promise
          </p>

          <h2>
            A place to learn.
            <br />
            A place to belong.
          </h2>

          <p>
            We want every child to feel welcomed, supported and inspired to
            become a confident Muslim who carries knowledge with beautiful
            character.
          </p>

          <PremiumTestimonial />

          <div>
            <span>
              <ShieldCheck />
              Safe &amp; caring
            </span>

            <span>
              <CalendarDays />
              Structured learning
            </span>

            <span>
              <CheckCircle2 />
              Clear family experience
            </span>
          </div>
        </div>
      </section>

      <section className="bnmc-final-cta">
        <div>
          <p className="bnmc-kicker">
            Ready when you are
          </p>

          <h2>
            Give your child a strong Islamic foundation.
          </h2>

          <p>
            Begin the application online and let the BNMC Madrasah team guide
            you through the next step.
          </p>
        </div>

        <div>
          <Link className="bnmc-btn bnmc-btn-gold" href="/apply">
            Apply for admission
            <ArrowRight />
          </Link>

          <a className="bnmc-btn bnmc-btn-outline-light" href="#contact">
            Contact us
          </a>
        </div>
      </section>

      <footer className="bnmc-footer" id="contact">
        <div className="bnmc-footer-main">
          <section className="bnmc-footer-brand">
            <div>
              <Image
                src="/community-logo.png"
                alt="Bolton Nigerian Muslim Community"
                width={68}
                height={68}
              />

              <span>
                <strong>
                  BNMC Madrasah
                </strong>

                <small>
                  Knowledge • Faith • Character
                </small>
              </span>
            </div>

            <p>
              Bolton Nigerian Muslim Community Madrasah — nurturing knowledge,
              faith and character in a caring Islamic environment.
            </p>
          </section>

          <section>
            <h3>
              Quick links
            </h3>

            <nav>
              <a href="#about">
                About
              </a>

              <a href="#learning">
                Learning
              </a>

              <a href="#admissions">
                Admissions
              </a>

              <Link href="/gallery">
                Gallery
              </Link>

              <Link href="/login">
                Parent portal
              </Link>
            </nav>
          </section>

          <section>
            <h3>
              Get in touch
            </h3>

            <address>
              <span>
                <MapPin />
                The Play Space Events, 1A Salop Street, Bolton, BL2 1DZ
              </span>

              <a href="mailto:admin@bnmc.org.uk">
                <Mail />
                admin@bnmc.org.uk
              </a>

              <a href="tel:+447438725293">
                <Phone />
                +44 7438 725293
              </a>
            </address>
          </section>

          <section className="bnmc-footer-action">
            <h3>
              Begin the journey
            </h3>

            <p>
              Admissions are handled securely online.
            </p>

            <Link href="/apply">
              Apply now
              <ArrowRight />
            </Link>
          </section>
        </div>

        <div className="bnmc-footer-bottom">
          <span>
            © {new Date().getFullYear()} BNMC Madrasah. All rights reserved.
          </span>

          <span>
            Designed and delivered by{" "}
            <a
              href="https://nuraspecs.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              NuraSpecs
            </a>
          </span>
        </div>
      </footer>

      <nav className="bnmc-mobile-actions" aria-label="Mobile quick actions">
        <Link href="/login">
          Parent portal
        </Link>

        <Link href="/apply">
          Apply now
          <ArrowRight />
        </Link>
      </nav>
    </main>
  );
}
