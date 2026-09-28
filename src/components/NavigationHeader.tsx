"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import ProtectedNavLink from "@/app/ProtectedNavLink";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";

const HELPUS_SITE_URL = "https://helpusbr.com";
const HELPUS_WHATSAPP_URL = "https://wa.me/5583998721848";

const navLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#374151",
  fontSize: 14,
  fontWeight: 700,
  padding: "10px 12px",
  borderRadius: 10,
  display: "inline-block",
};

const mobileMenuLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111827",
  fontSize: 15,
  fontWeight: 700,
  padding: "12px 12px",
  borderRadius: 12,
  display: "block",
  background: "#f9fafb",
  border: "1px solid #eceff3",
};

const externalGreenLinkStyle: CSSProperties = {
  ...navLinkStyle,
  color: "#16a34a",
};

const mobileExternalGreenLinkStyle: CSSProperties = {
  ...mobileMenuLinkStyle,
  color: "#16a34a",
};

export default function NavigationHeader() {
  const { t } = useLanguage();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        className="layout-shell"
        style={{
          padding: "12px 16px",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <a
            href={HELPUS_SITE_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
              minWidth: 0,
            }}
            title="Open HelpUS site"
          >
            <Image
              src="/img/helpus-logo.png"
              alt="HelpUS logo"
              width={40}
              height={40}
              priority
              style={{
                width: 40,
                height: 40,
                objectFit: "contain",
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                padding: 4,
                flexShrink: 0,
              }}
            />

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                  lineHeight: 1.1,
                }}
              >
                HelpUS
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  lineHeight: 1.2,
                }}
              >
                USMLE Platform
              </div>
            </div>
          </a>

          <nav
            className="desktop-nav"
            aria-label="Primary desktop navigation"
            style={{
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <ProtectedNavLink href="/" style={navLinkStyle}>
              {t("nav_dashboard")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/study" style={navLinkStyle}>
              {t("nav_study")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/flashcards" style={navLinkStyle}>
              {t("nav_flashcards")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/results" style={navLinkStyle}>
              {t("nav_results")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/progress" style={navLinkStyle}>
              {t("nav_progress")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/settings" style={navLinkStyle}>
              {t("nav_settings")}
            </ProtectedNavLink>

            <LanguageSelector />

            <a
              href={HELPUS_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              style={externalGreenLinkStyle}
            >
              {t("nav_whatsapp")}
            </a>
          </nav>

          <div
            className="mobile-menu"
            aria-hidden="true"
            style={{
              fontSize: 20,
              lineHeight: 1,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            ☰
          </div>
        </div>

        <details
          className="mobile-menu"
          style={{
            borderRadius: 16,
            background: "white",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontWeight: 800,
              userSelect: "none",
            }}
          >
            <span>Menu</span>
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
              ☰
            </span>
          </summary>

          <nav
            aria-label="Primary mobile navigation"
            style={{
              padding: "0 12px 12px 12px",
              display: "grid",
              gap: 10,
            }}
          >
            <ProtectedNavLink href="/" style={mobileMenuLinkStyle}>
              {t("nav_dashboard")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/study" style={mobileMenuLinkStyle}>
              {t("nav_study")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/flashcards" style={mobileMenuLinkStyle}>
              {t("nav_flashcards")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/results" style={mobileMenuLinkStyle}>
              {t("nav_results")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/progress" style={mobileMenuLinkStyle}>
              {t("nav_progress")}
            </ProtectedNavLink>

            <ProtectedNavLink href="/settings" style={mobileMenuLinkStyle}>
              {t("nav_settings")}
            </ProtectedNavLink>

            <LanguageSelector isMobile />

            <a
              href={HELPUS_SITE_URL}
              target="_blank"
              rel="noreferrer"
              style={mobileMenuLinkStyle}
            >
              HelpUS Site
            </a>

            <a
              href={HELPUS_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              style={mobileExternalGreenLinkStyle}
            >
              {t("nav_whatsapp")} HelpUS
            </a>
          </nav>
        </details>
      </div>
    </header>
  );
}
