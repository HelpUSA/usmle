/**
 * RootLayout
 *
 * 📍 Localização:
 * src/app/layout.tsx
 *
 * Função:
 * - Layout raiz da aplicação (App Router)
 * - Define metadata global
 * - Aplica estilos básicos de página
 * - Envolve a aplicação com Providers globais (ex: NextAuth SessionProvider)
 *
 * Observações importantes:
 * - Todo hook do NextAuth (useSession, signIn, signOut) exige que
 *   a aplicação esteja envolvida em <SessionProvider />
 * - O wrapper <Providers /> centraliza dependências globais client-side
 */

import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "USMLE API Starter",
  description: "Next.js + Railway Postgres starter (SQL direto)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <Providers>
          <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
