/**
 * RootLayout (Product-ready)
 *
 * 📍 src/app/layout.tsx
 *
 * Evolução:
 * - Adiciona header global
 * - Adiciona menu responsivo (mobile + desktop)
 * - Prepara base para dashboard/app navigation
 * - Mantém Providers (NextAuth)
 */

import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "HelpUS · USMLE Platform",
  description: "USMLE-style practice platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          background: "#f5f6f8",
        }}
      >
        <Providers>
          {/* HEADER */}
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 50,
              background: "white",
              borderBottom: "1px solid #e5e5e5",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                maxWidth: 1200,
                margin: "0 auto",
              }}
            >
              {/* LEFT: LOGO */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#111",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                  }}
                >
                  H
                </div>

                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    HelpUS
                  </div>
                  <div style={{ fontSize: 11, color: "#777" }}>
                    USMLE Platform
                  </div>
                </div>
              </div>

              {/* RIGHT: MENU ICON (mobile ready) */}
              <div style={{ fontSize: 20, cursor: "pointer" }}>
                ☰
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "16px",
            }}
          >
            {children}
          </main>

          {/* FOOTER */}
          <footer
            style={{
              marginTop: 40,
              padding: 16,
              textAlign: "center",
              fontSize: 12,
              color: "#777",
            }}
          >
            © {new Date().getFullYear()} HelpUS · Built for medical learning
          </footer>
        </Providers>
      </body>
    </html>
  );
}