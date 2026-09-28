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
import NavigationHeader from "@/components/NavigationHeader";

export const metadata: Metadata = {
  title: "HelpUS Â· USMLE Platform",
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

          <NavigationHeader />

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
              Â© {new Date().getFullYear()} HelpUS
            </a>{" "}
            Â· Built for medical learning
          </footer>
        </Providers>
      </body>
    </html>
  );
}
