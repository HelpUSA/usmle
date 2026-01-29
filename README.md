# usmle-api-starter (do zero, simples)

Este projeto é **Next.js (App Router) + TypeScript + PostgreSQL (Railway)** usando **SQL direto via `pg`**.
Sem Prisma, sem migrações locais, sem engine/adapter — foco total em reduzir fricção no início.

## Pré-requisitos
- **Node.js 20 LTS** recomendado (evita dores de cabeça com ferramentas).  
  > Se você já usa Node 22, pode funcionar, mas o caminho mais estável é Node 20.

## Setup (Windows / PowerShell)

1) Crie uma pasta nova (ex: `usmle-api`) e extraia o zip nela.

2) Instale dependências:
```powershell
npm install
```

3) Configure ambiente:
- Copie `.env.example` para `.env.local`
- Cole seu `DATABASE_URL` do Railway

4) Rode o servidor:
```powershell
npm run dev
```

5) Teste no navegador:
- `http://localhost:3000/api/health`

## Endpoints prontos

### GET `/api/health`
Faz `SELECT NOW()` no banco.

### POST `/api/sessions`
Cria (se não existir) o `users_profile` e cria uma `sessions`.

Header obrigatório (por enquanto, auth provisória):
- `x-user-id: <uuid>`

Body:
```json
{
  "mode": "practice",
  "exam": "step1",
  "language": "en",
  "timed": false,
  "time_limit_seconds": 1200
}
```

### GET `/api/sessions`
Lista as últimas 20 sessões do usuário (header `x-user-id`).

## Próximos passos sugeridos
1) Implementar geração de `session_items` (seleção de questões)
2) Implementar `attempts` (respostas do usuário)
3) Trocar o header `x-user-id` por autenticação real (Auth.js / Clerk)

Deployed pipeline test.

