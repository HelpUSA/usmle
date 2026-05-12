/*
 * File: src/app/layout.tsx
 *
 * Responsibility:
 * - Define the root App Router layout.
 * - Define global metadata.
 * - Wrap the application with global client-side Providers.
 * - Provide the primary responsive navigation shell.
 * - Keep internal navigation protected through ProtectedNavLink.
 * - Keep external HelpUS/WhatsApp links as normal anchors.
 *
 * Important behavior:
 * - Pages using useSession(), signIn(), or signOut() require the application
 *   to be wrapped by Providers, which should include NextAuth SessionProvider.
 * - Internal app links use ProtectedNavLink so navigation can respect the
 *   confirmBeforeLeavingSession preference.
 * - External links are not blocked by ProtectedNavLink.
 */

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Providers from "./providers";
import ProtectedNavLink from "./ProtectedNavLink";

export const metadata: Metadata = {
  title: "HelpUS · USMLE Platform",
  description: "USMLE-style practice platform",
};

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          background: "#f5f6f8",
          color: "#111827",
        }}
      >
        <Providers>
          <style>{`
            .desktop-nav {
              display: none;
            }

            .mobile-menu {
              display: block;
            }

            @media (min-width: 900px) {
              .desktop-nav {
                display: flex;
              }

              .mobile-menu {
                display: none;
              }
            }

            .layout-shell {
              max-width: 1200px;
              margin: 0 auto;
            }

            .mobile-menu summary::-webkit-details-marker {
              display: none;
            }
          `}</style>

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
                    Dashboard
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/study" style={navLinkStyle}>
                    Study
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/results" style={navLinkStyle}>
                    Results
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/progress" style={navLinkStyle}>
                    Progress
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/settings" style={navLinkStyle}>
                    Settings
                  </ProtectedNavLink>

                  <a
                    href={HELPUS_WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    style={externalGreenLinkStyle}
                  >
                    WhatsApp
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
                    Dashboard
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/study" style={mobileMenuLinkStyle}>
                    Study
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/results" style={mobileMenuLinkStyle}>
                    Results
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/progress" style={mobileMenuLinkStyle}>
                    Progress
                  </ProtectedNavLink>

                  <ProtectedNavLink href="/settings" style={mobileMenuLinkStyle}>
                    Settings
                  </ProtectedNavLink>

                  <a
                    href={HELPUS_SITE_URL}
                    target="_blank"
                    rel="noreferrer"
                    style={mobileMenuLinkStyle}
                  >
                    Visit HelpUS site
                  </a>

                  <a
                    href={HELPUS_WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    style={mobileExternalGreenLinkStyle}
                  >
                    WhatsApp HelpUS
                  </a>
                </nav>
              </details>
            </div>
          </header>

          <main
            className="layout-shell"
            style={{
              padding: "16px",
            }}
          >
            {children}
          </main>

          <footer
            style={{
              marginTop: 40,
              padding: 20,
              textAlign: "center",
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <a
              href={HELPUS_SITE_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "inherit",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              © {new Date().getFullYear()} HelpUS
            </a>{" "}
            · Built for medical learning
          </footer>
        </Providers>
      </body>
    </html>
  );
}