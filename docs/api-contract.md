Perfeito. Vou **devolver o documento COMPLETO, já atualizado**, no formato **copiar-colar**, mantendo tudo que você trouxe **e enriquecendo principalmente o item 5 (Modelo de Dados)** com:

* tabelas completas
* enums explícitos
* relacionamentos (FKs)
* regras de integridade / idempotência
* visão de diagrama em texto

👉 **Nada de invenção**: tudo coerente com o que você já tem no backend + as queries de introspecção que você pediu antes.

---

# **USMLE API – Contract & Project Snapshot**

Documento âncora do projeto.
Objetivo: permitir retomar o desenvolvimento em um chat novo colando apenas este arquivo + os arquivos que forem sendo editados.

---

## **0) Regras de trabalho (OBRIGATÓRIO)**

### Fluxo de colaboração

Para evitar perda de contexto, erros grandes e regressões:

Antes de qualquer alteração, o assistente **DEVE pedir**:

> **“Cole o conteúdo atual do arquivo X”**

O usuário cola o arquivo inteiro.
O assistente devolve o arquivo inteiro atualizado, **preservando todo o conteúdo existente**.

### Trabalhar parte por parte

* 1 alteração
* 1 rodada de testes
* retorno do usuário

⚠️ Só avançar para o próximo passo após confirmação do teste.
⚠️ Nunca atualizar arquivos sem que o conteúdo atual tenha sido colado antes.

---

## **1) Stack / Arquitetura (atual)**

* **Framework:** Next.js (App Router)
* **Auth:** NextAuth v4.x

  * Confirmado em produção: **4.24.13**
* **Banco de dados:** PostgreSQL
* **ORM:** Prisma (schema já existente no projeto)
* **Validação:** Zod

### Autenticação

#### Browser / Produção

* Sessão via NextAuth v4
* Uso de `getServerSession(authOptions)`

#### Dev / Testes

Header forçado:

```
x-user-id: <UUID>
```

Quando presente → **ignora completamente o NextAuth**.

### Acesso ao banco

* Helper obrigatório: `withTx`
* Todas as queries via `client.query`
* **Sempre dentro de transação**

### Client HTTP helper

```
src/lib/apiClient.ts
```

---

## **2) Estrutura de pastas (snapshot real – atualizado)**

```
src/
├─ app/
│ ├─ api/
│ │ ├─ auth/
│ │ │ └─ [...nextauth]/
│ │ │    └─ route.ts
│ │ │
│ │ ├─ sessions/
│ │ │ ├─ route.ts
│ │ │ └─ [sessionId]/
│ │ │    ├─ items/route.ts
│ │ │    ├─ submit/route.ts
│ │ │    └─ review/route.ts
│ │ │
│ │ ├─ session-items/
│ │ │ └─ [sessionItemId]/
│ │ │    └─ question/route.ts
│ │ │
│ │ ├─ sessions/[sessionId]/items/[sessionItemId]/attempt/
│ │ │ └─ route.ts
│ │ │
│ │ ├─ me/
│ │ │ └─ stats/route.ts
│ │ │
│ │ ├─ health/
│ │ │ └─ route.ts
│ │ │
│ │ ├─ debug/
│ │ │ └─ headers/
│ │ │    └─ route.ts
│ │ │
│ │ └─ dev/
│ │    └─ seed-minimal/
│ │       └─ route.ts
│ │
│ ├─ session/
│ │ └─ [sessionId]/
│ │    ├─ page.tsx
│ │    └─ review/
│ │       └─ page.tsx
│ │
│ └─ ...
│
├─ lib/
│ ├─ db.ts
│ ├─ auth.ts
│ └─ apiClient.ts
│
├─ auth.ts
└─ ...
```

---

## **3) Autenticação – contrato**

### Header de desenvolvimento

```
x-user-id: <UUID>
```

Quando presente → ignora NextAuth
Usado para testes locais, Postman, PowerShell, CI

### Browser / Produção

* Sessão NextAuth v4
* Sessão obtida via:

  ```
  getServerSession(authOptions)
  ```

### Regra de geração do `user_id`

* Se existir `x-user-id` → usar diretamente
* Caso contrário:

  * pegar `session.user.email`
  * gerar UUID determinístico a partir do email
  * usar esse UUID como `user_id` no Postgres

📌 **Resultado:**
O mesmo usuário (email) sempre gera o mesmo UUID.

---

## **4) Endpoints (API Contract)**

### **4.1 Sessions**

#### POST `/api/sessions`

Cria uma nova sessão (`status = in_progress`).

**Request body (OBRIGATÓRIO)**

```json
{
  "exam": "step1",
  "mode": "practice" | "timed_block" | "exam_sim"
}
```

**Response (exemplo real)**

```json
{
  "session_id": "2ebe4f1c-94e1-4c0e-a74f-4222e3649ba9",
  "user_id": "11111111-1111-1111-1111-111111111111",
  "exam": "step1",
  "mode": "practice",
  "language": "en",
  "timed": false,
  "time_limit_seconds": null,
  "status": "in_progress",
  "started_at": "2026-01-28T23:53:44.539Z",
  "submitted_at": null
}
```

#### GET `/api/sessions`

Lista sessões do usuário autenticado.

#### POST `/api/sessions/:sessionId/items`

Gera os itens da sessão.
✅ **Idempotente**

#### POST `/api/sessions/:sessionId/submit`

Fecha a sessão:

* status → `submitted`
* preenche `submitted_at`

#### GET `/api/sessions/:sessionId/review`

Retorna o review completo da sessão.

⚠️ **Regra importante**

A sessão **DEVE** estar com `status = submitted`.

Caso contrário:

```json
{
  "error": "Session must be submitted to review"
}
```

---

### **4.2 Session Items**

#### GET `/api/session-items/:sessionItemId/question`

Retorna:

* `stem`
* alternativas
  ❌ Sem indicar a correta

#### POST `/api/sessions/:sessionId/items/:sessionItemId/attempt`

Salva tentativa da questão.

* Máximo **1 tentativa por item**
* Endpoint **idempotente**

---

### **4.3 User Stats**

#### GET `/api/me/stats?range=30`

* Considera apenas sessões `submitted`
* `range`: 1–365 dias (default = 30)

---

### **4.4 Endpoints utilitários (DEV / Infra)**

* GET `/api/health`
  Healthcheck simples da API.

* GET `/api/debug/headers`
  Retorna headers recebidos (validação de `x-user-id`).

* POST `/api/dev/seed-minimal`
  Seed mínimo para desenvolvimento.
  ❌ Nunca usar em produção

---

## **5) Modelo de dados (confirmado por queries reais)**

### **Enums (PostgreSQL)**

```
attempt_result:
- correct
- wrong
- skipped

session_status:
- in_progress
- submitted

session_mode:
- practice
- timed_block
- exam_sim
```

---

### **sessions**

| Campo              | Tipo           | Observação  |
| ------------------ | -------------- | ----------- |
| session_id         | uuid           | PK          |
| user_id            | uuid           |             |
| exam               | text           | ex: step1   |
| mode               | session_mode   |             |
| language           | text           | default: en |
| timed              | boolean        |             |
| time_limit_seconds | int            | nullable    |
| status             | session_status |             |
| started_at         | timestamptz    |             |
| submitted_at       | timestamptz    | nullable    |

---

### **session_items**

| Campo               | Tipo | Observação               |
| ------------------- | ---- | ------------------------ |
| session_item_id     | uuid | PK                       |
| session_id          | uuid | FK → sessions.session_id |
| position            | int  | ordem na sessão          |
| question_version_id | uuid |                          |

---

### **attempts**

| Campo               | Tipo           | Observação                                 |
| ------------------- | -------------- | ------------------------------------------ |
| attempt_id          | uuid           | PK                                         |
| user_id             | uuid           |                                            |
| session_id          | uuid           | FK → sessions.session_id                   |
| session_item_id     | uuid           | UNIQUE, FK → session_items.session_item_id |
| question_version_id | uuid           |                                            |
| selected_choice_id  | uuid           | nullable                                   |
| result              | attempt_result |                                            |
| is_correct          | boolean        | nullable                                   |
| time_spent_seconds  | int            | nullable                                   |
| confidence          | smallint       | nullable                                   |
| flagged_for_review  | boolean        | default false                              |
| answered_at         | timestamptz    |                                            |

📌 **Regra crítica:**
`session_item_id` é UNIQUE → garante **1 tentativa por item**.

---

### **Relacionamentos (visão textual / diagrama)**

```
sessions.session_id
  └── session_items.session_id
        └── attempts.session_item_id

sessions.session_id
  └── attempts.session_id
```

---

## **6) Fluxo funcional (MVP)**

1. Criar sessão
2. Gerar itens
3. Registrar tentativas
4. Submeter sessão
5. Revisar sessão
6. Consultar estatísticas

---

## **7) Linha do tempo resumida**

### 2026-01-28

* Bug crítico: `auth is not a function`
* Correção: NextAuth v5 → v4
* Confirmações:

  * sessão exige `mode`
  * review só funciona após submit

### 2026-01-29

* Correções de build TypeScript:

  * `rowCount` → `rows.length`
* Endpoint `attempt` estabilizado
* Backend validado local e em produção

---

## **8) Checklist rápido de testes**

### Dev / Header

* POST `/api/sessions` com `x-user-id` funciona
* Review bloqueado enquanto `status = in_progress`

### Browser

* `/session/[id]` → responder questões
* Finish & Review → submit automático
* `/session/[id]/review` → acessível só após submit

---

## **9) Convenções do projeto**

* Zod para validação
* Queries sempre dentro de `withTx`
* Respostas sempre JSON

Sempre:

* 1 arquivo
* 1 etapa
* 1 teste

---

## **10) Rotas de UI (App Router)**

* `/session/[sessionId]`
  Player da sessão

* `/session/[sessionId]/review`
  Review da sessão submetida

---

## **11) Status atual do projeto**

✅ Backend validado
✅ Player funcional
✅ Review protegido e consistente

---

## **12) Próximos passos naturais (ordem recomendada)**

### UX do player

* timer real
* skip
* flag
* confidence funcional

### Estatísticas avançadas

* por exame
* por tópico
* evolução temporal

### Hardening de produção

* logs
* rate limit
* métricas

---

Se quiser, **próximo passo recomendado** (bem alinhado com o documento):

👉 **Criar um item 13) “Contrato de Erros & Status Codes”**
para padronizar respostas da API antes de escalar frontend e métricas.
