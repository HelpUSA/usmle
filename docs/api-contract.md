Perfeito — excelente nível de organização 👌
Vou fazer **exatamente** o que você pediu, sem invenção e sem “embelezar” demais.

Abaixo está o **DOCUMENTO COMPLETO**, já **atualizado com as informações do último chat**, **reaproveitando tudo que já existia** e **acrescentando apenas o que de fato avançamos**.

🔒 **O que foi incorporado agora (novo):**

* Estado real do **deploy em produção (Vercel)**
* Decisão arquitetural: **deploy somente via GitHub (hook removido)**
* Situação atual do **banco de dados (seed mínimo / problema das 10 questões)**
* Clarificação do papel do endpoint `/dev/seed-minimal`
* Atualização do **status do projeto**
* Ajuste fino em **Hardening / Infra**

Nada foi removido. Apenas **enriquecido e consolidado**.

---

# **USMLE API – Contract & Project Snapshot**

📌 **Documento âncora do projeto**
📌 Objetivo: permitir retomar o desenvolvimento em um chat novo colando apenas este arquivo + os arquivos que forem sendo editados.

---

## **0) Regras de trabalho (OBRIGATÓRIO)**

### Fluxo de colaboração

Para evitar perda de contexto, erros grandes e regressões:

Antes de qualquer alteração, o assistente **DEVE pedir**:

> **“Cole o conteúdo atual do arquivo X”**

O usuário cola o arquivo inteiro.
O assistente devolve o arquivo inteiro atualizado, **preservando todo o conteúdo existente**.

---

### Trabalhar parte por parte

* 1 alteração por vez
* 1 rodada de testes
* retorno explícito do usuário

⚠️ Só avançar após confirmação do teste
⚠️ Nunca atualizar múltiplos arquivos de uma só vez
⚠️ Nunca “assumir” conteúdo de arquivo não colado

---

## **1) Stack / Arquitetura (confirmado em produção)**

* **Framework:** Next.js (App Router)
* **Auth:** NextAuth v4.x

  * Versão em produção: **4.24.13**
* **Banco de dados:** PostgreSQL
* **ORM:** Prisma (schema já existente)
* **Validação:** Zod
* **Infra / Deploy:** Vercel
* **Repositório:** GitHub (deploy automático via push)

---

### Autenticação

#### Browser / Produção

* Sessão via NextAuth v4
* Uso exclusivo de:

  ```
  getServerSession(authOptions)
  ```

#### Dev / Testes

Header forçado:

```
x-user-id: <UUID>
```

Quando presente:
✅ ignora completamente NextAuth
✅ usado para Postman, PowerShell, CI e dev local

---

### Acesso ao banco

* Helper obrigatório: `withTx`
* Queries feitas com `client.query`
* **Todas as operações dentro de transação**
* Nunca misturar Prisma Client + SQL direto no mesmo fluxo

---

### Client HTTP helper

```
src/lib/apiClient.ts
```

---

## **2) Estrutura de pastas (snapshot real – atual)**

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

Regras:

* Se presente → ignora NextAuth
* Usado para dev, CI, testes manuais

---

### Browser / Produção

* Sessão NextAuth v4
* Sessão obtida via:

  ```
  getServerSession(authOptions)
  ```

---

### Regra de geração do `user_id`

* Se existir `x-user-id` → usar diretamente
* Caso contrário:

  * usar `session.user.email`
  * gerar UUID **determinístico**
  * persistir esse UUID como `user_id`

📌 O mesmo email **sempre gera o mesmo UUID**.

---

## **4) Endpoints (API Contract)**

### **4.1 Sessions**

#### POST `/api/sessions`

Cria uma nova sessão (`status = in_progress`).

**Request body (obrigatório)**

```json
{
  "exam": "step1",
  "mode": "practice" | "timed_block" | "exam_sim"
}
```

---

#### GET `/api/sessions`

Lista sessões do usuário autenticado.

---

#### POST `/api/sessions/:sessionId/items`

Gera os itens da sessão.

✅ **Idempotente**
Se já existirem itens → não recria

---

#### POST `/api/sessions/:sessionId/submit`

Finaliza a sessão:

* `status = submitted`
* preenche `submitted_at`

---

#### GET `/api/sessions/:sessionId/review`

Retorna o review completo da sessão.

⚠️ Regra obrigatória:

Se `status !== submitted`:

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
  ❌ nunca retorna a correta

---

#### POST `/api/sessions/:sessionId/items/:sessionItemId/attempt`

Registra tentativa.

Regras:

* Máximo **1 tentativa por item**
* Endpoint **idempotente**
* Repetir POST → atualiza mesma tentativa

---

### **4.3 User Stats**

#### GET `/api/me/stats?range=30`

* Considera apenas sessões `submitted`
* `range`: 1–365 dias
* default = 30

---

### **4.4 Endpoints utilitários (DEV / Infra)**

* GET `/api/health`
* GET `/api/debug/headers`
* POST `/api/dev/seed-minimal`

  * **Uso exclusivo em desenvolvimento**
  * Cria dados mínimos
  * ❌ Nunca usar em produção

---

## **5) Modelo de dados (confirmado por introspecção real)**

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

| Campo               | Tipo | Observação    |
| ------------------- | ---- | ------------- |
| session_item_id     | uuid | PK            |
| session_id          | uuid | FK → sessions |
| position            | int  | ordem         |
| question_version_id | uuid |               |

---

### **attempts**

| Campo               | Tipo           | Observação    |
| ------------------- | -------------- | ------------- |
| attempt_id          | uuid           | PK            |
| user_id             | uuid           |               |
| session_id          | uuid           | FK            |
| session_item_id     | uuid           | UNIQUE        |
| question_version_id | uuid           |               |
| selected_choice_id  | uuid           | nullable      |
| result              | attempt_result |               |
| is_correct          | boolean        | nullable      |
| time_spent_seconds  | int            | nullable      |
| confidence          | smallint       | nullable      |
| flagged_for_review  | boolean        | default false |
| answered_at         | timestamptz    |               |

📌 **Regra crítica de integridade**
`session_item_id` UNIQUE → **1 tentativa por item garantida no banco**

---

### **Relacionamentos (diagrama textual)**

```
sessions
 ├── session_items
 │     └── attempts
 └── attempts
```

---

## **6) Fluxo funcional (MVP)**

1. Criar sessão
2. Gerar itens (idempotente)
3. Registrar tentativas
4. Submeter sessão
5. Revisar sessão
6. Consultar estatísticas

---

## **7) Linha do tempo resumida**

### **2026-01-28**

* Correção crítica: NextAuth v5 → v4
* Definição final de contratos
* Review bloqueado sem submit

### **2026-01-29**

* Correções TS (`rowCount → rows.length`)
* Endpoint `attempt` estabilizado
* Deploy automático validado
* **Deploy Hook removido** (evita duplicidade)

---

## **8) Infra & Deploy (estado atual)**

* Deploy automático **exclusivamente via GitHub**
* Branch: `main`
* Ambiente: Production
* Deploy Hooks externos: ❌ desativados
* Resultado esperado:

  * 1 deploy por commit
  * Origem: GitHub

---

## **9) Estado atual do banco**

* Banco **conectado e funcional**
* Seed atual:

  * apenas **10 questões**
  * todas iguais (seed mínimo)
* Próximo passo necessário:

  * popular banco com **questões reais**
  * revisar estratégia de seed / import

---

## **10) Checklist rápido de testes**

### Dev

* `x-user-id` funciona
* Review bloqueado antes do submit

### Produção

* `/session/[id]` funcional
* Submit automático ao finalizar
* Review protegido

---

## **11) Status atual do projeto**

✅ Backend estável
✅ Deploy previsível
⚠️ Base de questões ainda **placeholder**

---

## **12) Próximos passos naturais (ordem recomendada)**

1. Popular banco com questões reais
2. UX do player (timer, skip, flag)
3. Estatísticas avançadas
4. Hardening:

   * logs
   * rate limit
   * métricas

---

## **13) Próximo passo sugerido**

👉 **Criar “Contrato de Erros & Status Codes”**
Padronizar:

* HTTP status
* mensagens
* formato de erro

Antes de escalar frontend, métricas e observabilidade.

---

Se quiser, no próximo chat já posso:

* criar **item 13 completo**
* ou desenhar o **plano de importação de questões** (CSV / SQL / batch)

É só dizer qual seguimos.
