/**
 * File: src/auth.ts
 *
 * Configuração do NextAuth (v4)
 * - Sessão baseada em JWT
 * - Expiração controlada (24h)
 * - Compatível com getServerSession()
 */

import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

export const AUTH_MODULE_MARKER = "src/auth.ts";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  // 🔐 CONTROLE DE SESSÃO
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24, // ⏱️ 24 horas
  },

  // 🔐 CONTROLE DO TOKEN
  jwt: {
    maxAge: 60 * 60 * 24, // ⏱️ 24 horas
  },

  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};