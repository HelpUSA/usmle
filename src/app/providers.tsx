/**
 * Providers
 *
 * 📍 Localização:
 * src/app/providers.tsx
 *
 * Função:
 * - Centralizar todos os providers client-side da aplicação
 * - Atualmente:
 *   - NextAuth SessionProvider (necessário para useSession, signIn, signOut)
 *
 * Por que este arquivo existe:
 * - No App Router, layouts são Server Components por padrão
 * - SessionProvider é um Client Component
 * - Este wrapper resolve essa separação de forma explícita e limpa
 *
 * Convenção:
 * - Qualquer provider global client-side novo deve ser adicionado aqui
 *   (ex: ThemeProvider, QueryClientProvider, etc.)
 */

"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
