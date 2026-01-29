/**
 * NextAuth Route Handler (NextAuth v4)
 *
 * 📍 Localização:
 * src/app/api/auth/[...nextauth]/route.ts
 *
 * Objetivo:
 * - Habilitar login via Google (beta)
 * - Manter compatibilidade com NextAuth v4 no App Router
 *
 * Observações importantes:
 * - v4 usa `NEXTAUTH_SECRET` (padrão) e `NEXTAUTH_URL` (recomendado em produção).
 * - Mantemos seus env vars atuais (AUTH_*) para não quebrar seu setup, mas também aceitamos os padrões.
 * - Futuro (beta fechado): allowlist de emails pode ser aplicado no callback `signIn`.
 */

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

const authOptions: NextAuthOptions = {
  // Aceita tanto AUTH_SECRET quanto NEXTAUTH_SECRET (padrão do NextAuth)
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  // Ajuda em produção / proxies; e evita problemas comuns de callback URL
  // (não força nada; apenas respeita o env se existir)
  ...(process.env.NEXTAUTH_URL ? {} : {}),

  callbacks: {
    /**
     * Beta fechado (opcional):
     * - Se quiser limitar por domínio/email, faça aqui.
     * - Por enquanto: permite login normalmente.
     */
    async signIn({ account, profile }) {
      // Exemplo (desativado):
      // const allowed = new Set(["medico1@gmail.com", "medico2@gmail.com"]);
      // const email = profile?.email?.toLowerCase();
      // if (!email || !allowed.has(email)) return false;

      // Garantia mínima: só aceita Google
      if (account?.provider !== "google") return false;

      // Se profile não tiver email, recusa
      const email = (profile as any)?.email;
      if (!email) return false;

      return true;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
