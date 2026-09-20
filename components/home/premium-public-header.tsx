"use client";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  Menu,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

export default function PremiumPublicHeader() {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    scrolled,
    setScrolled,
  ] =
    useState(false);

  useEffect(() => {
    const onScroll =
      () =>
        setScrolled(
          window.scrollY >
            12,
        );

    onScroll();

    window.addEventListener(
      "scroll",
      onScroll,
      {
        passive:
          true,
      },
    );

    return () =>
      window.removeEventListener(
        "scroll",
        onScroll,
      );
  }, []);

  useEffect(
    () => {
      document.body.style.overflow =
        open
          ? "hidden"
          : "";

      return () => {
        document.body.style.overflow =
          "";
      };
    },
    [
      open,
    ],
  );

  function close() {
    setOpen(
      false,
    );
  }

  return (
    <>
      <header
        className={`bnmc-public-header ${
          scrolled
            ? "scrolled"
            : ""
        }`}
      >
        <Link
          href="/"
          className="bnmc-public-brand"
          onClick={
            close
          }
        >
          <Image
            src="/community-logo.png"
            alt="Bolton Nigerian Muslim Community"
            width={62}
            height={62}
            priority
          />

          <span>
            <b>
              BNMC Madrasah
            </b>

            <small>
              Knowledge • Faith • Character
            </small>
          </span>
        </Link>

        <nav
          className="bnmc-desktop-nav"
          aria-label="Main navigation"
        >
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

          <a href="#contact">
            Contact
          </a>
        </nav>

        <div className="bnmc-header-actions">
          <Link
            href="/login"
            className="bnmc-header-portal"
          >
            Portal
          </Link>

          <Link
            href="/apply"
            className="bnmc-header-apply"
          >
            Apply now
            <ArrowRight />
          </Link>

          <button
            type="button"
            className="bnmc-menu-button"
            aria-label="Open menu"
            aria-expanded={
              open
            }
            onClick={() =>
              setOpen(
                true,
              )
            }
          >
            <Menu />
          </button>
        </div>
      </header>

      <div
        className={`bnmc-mobile-menu ${
          open
            ? "open"
            : ""
        }`}
        aria-hidden={
          !open
        }
      >
        <button
          className="bnmc-mobile-menu-backdrop"
          type="button"
          aria-label="Close menu"
          onClick={
            close
          }
        />

        <aside>
          <header>
            <Link
              href="/"
              className="bnmc-public-brand"
              onClick={
                close
              }
            >
              <Image
                src="/community-logo.png"
                alt=""
                width={54}
                height={54}
              />

              <span>
                <b>
                  BNMC Madrasah
                </b>

                <small>
                  Knowledge • Faith • Character
                </small>
              </span>
            </Link>

            <button
              type="button"
              aria-label="Close menu"
              onClick={
                close
              }
            >
              <X />
            </button>
          </header>

          <nav>
            <a
              href="#about"
              onClick={
                close
              }
            >
              About
            </a>

            <a
              href="#learning"
              onClick={
                close
              }
            >
              Learning
            </a>

            <a
              href="#admissions"
              onClick={
                close
              }
            >
              Admissions
            </a>

            <Link
              href="/gallery"
              onClick={
                close
              }
            >
              Gallery
            </Link>

            <a
              href="#contact"
              onClick={
                close
              }
            >
              Contact
            </a>
          </nav>

          <div>
            <Link
              href="/login"
              onClick={
                close
              }
            >
              Portal
            </Link>

            <Link
              href="/apply"
              onClick={
                close
              }
            >
              Apply for admission
              <ArrowRight />
            </Link>
          </div>

          <blockquote>
            <b lang="ar" dir="rtl">
              رَبِّ زِدْنِي عِلْمًا
            </b>

            <span>
              “My Lord, increase me in knowledge.”
            </span>
          </blockquote>
        </aside>
      </div>
    </>
  );
}
