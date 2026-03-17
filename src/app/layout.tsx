/**
 * RootLayout
 *
 * 📍 Localização:
 * src/app/layout.tsx
 *
 * Função:
 * - Layout raiz da aplicação (App Router)
 * - Define metadata global
 * - Aplica estrutura visual global do produto
 * - Envolve a aplicação com Providers globais (ex: NextAuth SessionProvider)
 * - Fornece navegação principal responsiva para desktop e celular
 *
 * Estratégia de navegação:
 * - Desktop:
 *   - exibe links principais no header
 *   - oculta o menu hambúrguer
 * - Mobile:
 *   - exibe menu expansível com <details>/<summary>
 *   - oculta a navegação horizontal do desktop
 *
 * Observações importantes:
 * - Todo hook do NextAuth (useSession, signIn, signOut) exige que
 *   a aplicação esteja envolvida em <SessionProvider />
 * - O wrapper <Providers /> centraliza dependências globais client-side
 * - Nesta fase, alguns links ainda apontam para áreas futuras do sistema:
 *   - Dashboard (/)
 *   - Study (/)
 *   - Results (#)
 *   - Progress (#)
 *   - Settings (#)
 *
 * ✅ Atualização (2026-03-17):
 * - Header global refinado
 * - Navegação desktop visível apenas em telas maiores
 * - Menu mobile funcional apenas em telas menores
 * - Responsividade corrigida para evitar menu duplicado
 * - Branding HelpUS integrado ao topo da aplicação
 */

import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "HelpUS · USMLE Platform",
  description: "USMLE-style practice platform",
};

const navLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#374151",
  fontSize: 14,
  fontWeight: 700,
  padding: "10px 12px",
  borderRadius: 10,
  display: "inline-block",
};

const mobileMenuLinkStyle: React.CSSProperties = {
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
          `}</style>

          {/* HEADER */}
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
              {/* Top row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {/* LEFT: BRAND */}
                <a
                  href="/"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    textDecoration: "none",
                    color: "inherit",
                    minWidth: 0,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #111827 0%, #1d4ed8 100%)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    H
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>
                      HelpUS
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.2 }}>
                      USMLE Platform
                    </div>
                  </div>
                </a>

                {/* DESKTOP NAV */}
                <nav
                  className="desktop-nav"
                  aria-label="Primary desktop navigation"
                  style={{
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <a href="/" style={navLinkStyle}>
                    Dashboard
                  </a>
                  <a href="/" style={navLinkStyle}>
                    Study
                  </a>
                  <a href="#" style={navLinkStyle}>
                    Results
                  </a>
                  <a href="#" style={navLinkStyle}>
                    Progress
                  </a>
                  <a href="#" style={navLinkStyle}>
                    Settings
                  </a>
                  <a
                    href="mailto:helpus.ecommerce@gmail.com"
                    style={{
                      ...navLinkStyle,
                      color: "#1d4ed8",
                    }}
                  >
                    Contact
                  </a>
                </nav>

                {/* MOBILE ICON ONLY */}
                <div
                  className="mobile-menu"
                  aria-hidden
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

              {/* MOBILE MENU PANEL */}
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
                  <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>
                    ☰
                  </span>
                </summary>

                <div
                  style={{
                    padding: "0 12px 12px 12px",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <a href="/" style={mobileMenuLinkStyle}>
                    Dashboard
                  </a>
                  <a href="/" style={mobileMenuLinkStyle}>
                    Study
                  </a>
                  <a href="#" style={mobileMenuLinkStyle}>
                    Results
                  </a>
                  <a href="#" style={mobileMenuLinkStyle}>
                    Progress
                  </a>
                  <a href="#" style={mobileMenuLinkStyle}>
                    Settings
                  </a>
                  <a
                    href="mailto:helpus.ecommerce@gmail.com"
                    style={{
                      ...mobileMenuLinkStyle,
                      color: "#1d4ed8",
                    }}
                  >
                    Contact HelpUS
                  </a>
                </div>
              </details>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main
            className="layout-shell"
            style={{
              padding: "16px",
            }}
          >
            {children}
          </main>

          {/* FOOTER */}
          <footer
            style={{
              marginTop: 40,
              padding: 20,
              textAlign: "center",
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            © {new Date().getFullYear()} HelpUS · Built for medical learning
          </footer>
        </Providers>
      </body>
    </html>
  );
}