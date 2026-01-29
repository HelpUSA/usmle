/**
 * File: src/auth.ts
 *
 * Purpose:
 * Configuração do NextAuth (v4) + export de authOptions para uso com getServerSession().
 * Este projeto está em next-auth@4.x, então NÃO existe `auth()` nem `handlers` via destructuring.
 *
 * Last update:
 * 2026-01-28 02:27 (America/Sao_Paulo)
 */

import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

// marcador para diagnosticar se ESTE arquivo está sendo importado
export const AUTH_MODULE_MARKER = "src/auth.ts";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        // guardamos o id do usuário aqui (por enquanto email)
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
