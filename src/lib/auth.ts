/**
 * File: src/lib/auth.ts
 *
 * Purpose:
 * Centraliza a lógica de identificação do usuário para APIs.
 * Suporta:
 *  - chamadas autenticadas via sessão (NextAuth v4, via getServerSession)
 *  - chamadas de teste/desenvolvimento via header `x-user-id`
 *
 * Também gera um UUID determinístico a partir do email,
 * garantindo consistência do user_id (uuid) no Postgres.
 *
 * Last update:
 * 2026-01-28 02:32 (America/Sao_Paulo)
 */

import { AUTH_MODULE_MARKER, authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import crypto from "crypto";

/**
 * Mantém compatibilidade com os testes via PowerShell.
 */
export function getUserIdFromRequest(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) throw new Error("Missing x-user-id header");
  return userId;
}

/**
 * Obtém o usuário autenticado via sessão (browser) usando NextAuth v4.
 */
export async function getUserFromSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Not authenticated");
  }

  return {
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

/**
 * Gera um UUID v4 determinístico a partir de uma string (ex: email),
 * para podermos usar o mesmo user_id (uuid) no Postgres.
 *
 * Implementação correta:
 * - usa os primeiros 16 bytes do SHA-256
 * - seta version = 4
 * - seta variant = RFC 4122
 */
function stableUuidFromString(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest(); // Buffer
  const b = Buffer.from(hash.subarray(0, 16)); // 16 bytes

  // version 4
  b[6] = (b[6] & 0x0f) | 0x40;
  // variant RFC 4122
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = b.toString("hex");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20, 32)
  );
}

/**
 * ✅ Função principal para uso nas rotas API.
 *
 * Ordem de prioridade:
 * 1) Header `x-user-id` (PowerShell / testes / dev)
 * 2) Sessão autenticada (browser / produção)
 */
export async function getUserIdForApi(req: Request) {
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) return headerUserId;

  // marker fica aqui só para facilitar debug de resolução do módulo "@/auth"
  // (se importar errado, isso ajuda a detectar rapidamente em logs/erros)
  if (!AUTH_MODULE_MARKER) {
    throw new Error("Auth module marker missing (unexpected).");
  }

  const u = await getUserFromSession();
  return stableUuidFromString(u.email);
}
