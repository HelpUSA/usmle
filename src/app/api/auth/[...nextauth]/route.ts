/**
 * NextAuth Route Handler (NextAuth v4)
 *
 * 📍 Localização:
 * src/app/api/auth/[...nextauth]/route.ts
 *
 * Objetivo:
 * - Expor handlers GET/POST do NextAuth no App Router
 * - Usar configuração CENTRALIZADA de autenticação (src/auth.ts)
 *
 * Motivo da mudança:
 * - Evita duplicação de config (providers, callbacks, session)
 * - Garante que getServerSession() e login usem a MESMA lógica
 * - Permite controle correto de expiração (maxAge)
 *
 * ⚠️ Regra importante:
 * - NÃO definir authOptions aqui
 * - Toda configuração deve ficar em: src/auth.ts
 *
 * ✅ Atualização:
 * - Agora usa authOptions central
 * - Compatível com sessão JWT + expiração configurada
 */

import NextAuth from "next-auth";
import { authOptions } from "@/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };