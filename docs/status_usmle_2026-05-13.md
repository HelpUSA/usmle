`D:\dev\usmle\docs\status_usmle_2026-05-13.md`. A validação final da sessão nova mostra `source = pilot_curated_v1`, `question_status = published` e 10 itens na sessão. 

# USMLE Platform — Status Operacional, Base de Questões e Plano de Expansão

**Data:** 2026-05-13
**Projeto:** USMLE Platform
**Repositório GitHub:** `https://github.com/HelpUSA/usmle`
**Branch principal:** `main`
**Último commit validado:** `b4658e2 Add curated pilot question batch`
**Ambiente local:** `D:\dev\usmle`
**Domínio online correto:** `https://usmle.helpusbr.com`
**Banco de dados:** PostgreSQL no Railway
**Objetivo deste documento:** servir como handoff completo para que outros chats/agentes continuem o trabalho sem perder contexto.

---

## 1. Resumo executivo

O projeto USMLE Platform está funcional localmente e online no domínio correto:

```text
https://usmle.helpusbr.com
```

O banco PostgreSQL está hospedado no Railway e está ativo. A aplicação Next.js está hospedada na Vercel e conectada ao banco Railway.

A base de questões foi corrigida. O lote genérico anterior foi retirado do pool ativo e substituído por um lote curado de 10 questões Step 1.

Estado final validado:

```text
pilot_curated_v1 | published | 10 questões boas
pilot_import     | draft     | 10 questões antigas/genéricas
PMC12748819      | draft     | 2 questões problemáticas
```

Uma sessão nova foi criada após a importação do lote curado e validada com:

```text
session_id = c70d5e0d-cfc9-4343-9f50-85f6dea73e18
status = in_progress
mode = practice
exam = step1
total_items = 10
source = pilot_curated_v1
question_status = published
```

Distribuição do lote/sessão:

```text
easy   = 2
medium = 5
hard   = 3
```

O site online correto está funcionando até as 10 questões atuais. A próxima fase é criar novos lotes de questões com o mesmo padrão editorial e técnico.

---

## 2. Stack técnico atual

### 2.1. Aplicação

* Next.js 14.2.5.
* App Router.
* TypeScript.
* React 18.
* NextAuth v4 com Google.
* PostgreSQL via pacote `pg`.
* Validação de payloads com `zod`.
* API routes em `src/app/api`.

### 2.2. Banco de dados

* PostgreSQL hospedado no Railway.
* A conexão é feita por `DATABASE_URL`.
* O banco é usado tanto localmente quanto em produção.
* A aplicação local em `http://localhost:3000` usa o mesmo banco Railway quando `.env.local` aponta para o `DATABASE_URL` de produção.

### 2.3. Deploy online

Domínio correto:

```text
https://usmle.helpusbr.com
```

Deploys/domínios observados na Vercel:

```text
usmle.helpusbr.com
usmle-two.vercel.app
usmle-cihkwjnp2-help-us.vercel.app
```

Commit de produção observado:

```text
b4658e2 Add curated pilot question batch
```

Domínio incorreto/não operacional para este projeto:

```text
https://usmle.vercel.app
```

Esse domínio retornava HTML 404 com `nextExport=true` e não deve ser usado como referência operacional.

---

## 3. Estado validado dos ambientes

### 3.1. Local

Endpoint:

```text
http://localhost:3000/api/health
```

Resultado validado:

```text
status = ok
db = up
```

Comando usado:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/api/health"
```

### 3.2. Produção

Endpoint correto:

```text
https://usmle.helpusbr.com/api/health
```

Resultado validado:

```text
status = ok
db = up
```

Comando usado:

```powershell
$baseUrl = "https://usmle.helpusbr.com"
Invoke-RestMethod -Method GET -Uri "$baseUrl/api/health"
```

### 3.3. Rota de importação em produção

Endpoint:

```text
POST https://usmle.helpusbr.com/api/dev/seed-minimal
```

Resultado observado com chave falsa:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Not found"
  }
}
```

Interpretação:

* A API existe.
* O deploy correto está respondendo JSON.
* A rota de importação está bloqueada em produção por segurança.
* Isso é esperado quando `ADMIN_SEED_ALLOW_PRODUCTION` não está `true`.

---

## 4. Estrutura principal do projeto

Raiz local:

```text
D:\dev\usmle
```

Arquivos/pastas relevantes:

```text
src/
  app/
    api/
      auth/[...nextauth]/route.ts
      debug/headers/route.ts
      dev/seed-minimal/route.ts
      health/route.ts
      me/stats/route.ts
      session-items/[sessionItemId]/question/route.ts
      sessions/route.ts
      sessions/[sessionId]/items/route.ts
      sessions/[sessionId]/items/[sessionItemId]/attempt/route.ts
      sessions/[sessionId]/review/route.ts
      sessions/[sessionId]/submit/route.ts
    page.tsx
    study/page.tsx
    results/page.tsx
    progress/page.tsx
    settings/page.tsx
    session/[sessionId]/page.tsx
    session/[sessionId]/review/page.tsx
  lib/
    apiClient.ts
    auth.ts
    db.ts
  auth.ts

seed/
  pilot_curated_v1_seed_minimal.json

docs/
  status_usmle_2026-05-13.md  # este documento

package.json
next.config.mjs
.env.local                    # não versionar
```

---

## 5. Principais scripts NPM

No `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

Comandos usuais:

```powershell
cd D:\dev\usmle
npm run dev
```

```powershell
cd D:\dev\usmle
npm run build
npm run start
```

```powershell
cd D:\dev\usmle
npm run build
npm run lint
```

---

## 6. Variáveis de ambiente importantes

### 6.1. Local `.env.local`

Variáveis relevantes:

```env
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
ADMIN_SEED_KEY=...
ADMIN_SEED_ALLOW_PRODUCTION=true
```

Observações:

* `DATABASE_URL` aponta para o PostgreSQL do Railway.
* `.env.local` não deve ser versionado.
* `ADMIN_SEED_ALLOW_PRODUCTION=true` foi usado localmente para permitir importação via `npm run start`, porque `next start` roda em modo production.
* Em produção, manter `ADMIN_SEED_ALLOW_PRODUCTION` desativado, salvo em janela controlada de importação.

### 6.2. Produção Vercel

Variáveis esperadas:

```env
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://usmle.helpusbr.com
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
ADMIN_SEED_KEY=...
ADMIN_SEED_ALLOW_PRODUCTION=false ou ausente
```

### 6.3. Segurança de chave

A chave antiga abaixo apareceu em conversa/log e deve ser considerada exposta:

```text
seed-dev-2026-usmle
```

Ações recomendadas:

1. Não reutilizar essa chave.
2. Usar uma chave forte de pelo menos 32 caracteres.
3. Atualizar `.env.local`.
4. Atualizar Vercel se essa chave estiver lá.
5. Manter importação em produção bloqueada por padrão.

Exemplo para gerar chave forte no PowerShell:

```powershell
$keyBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($keyBytes)
$newKey = -join ($keyBytes | ForEach-Object { $_.ToString("x2") })
$newKey
```

---

## 7. Modelo de dados relevante

Tabelas principais observadas/usadas:

```text
questions
question_versions
question_choices
sessions
session_items
attempts
users_profile
```

### 7.1. `questions`

Campos relevantes:

```text
question_id
canonical_code
status
source
created_at
```

Status usados:

```text
published
draft
```

Observação: o enum `question_status` não aceitava `retired`. Tentativa de usar `retired` gerou erro:

```text
ERROR: invalid input value for enum question_status: "retired"
```

Portanto, para retirar questão do pool, usar:

```sql
UPDATE questions
SET status = 'draft'
WHERE source = '...';
```

### 7.2. `question_versions`

Campos relevantes:

```text
question_version_id
question_id
version
exam
language
difficulty
stem
prompt
explanation_short
explanation_long
bibliography
is_active
```

Critério para entrar no pool:

```sql
q.status = 'published'
AND qv.is_active = true
```

### 7.3. `question_choices`

Campos relevantes:

```text
choice_id
question_version_id
label
choice_text
is_correct
explanation
```

Regras desejadas:

* 4 alternativas por questão, por enquanto.
* Labels sequenciais: A, B, C, D.
* Exatamente 1 correta.
* Cada alternativa com explicação.

### 7.4. `sessions`

Campos relevantes:

```text
session_id
user_id
mode
exam
status
started_at
submitted_at
settings_json
```

Status usados:

```text
in_progress
submitted
abandoned
```

### 7.5. `session_items`

Campos relevantes:

```text
session_item_id
session_id
question_version_id
position
presented_at
```

Importante:

* Sessões antigas continuam apontando para o `question_version_id` usado no momento em que foram criadas.
* Se uma questão depois virar `draft`, a sessão antiga ainda preserva o histórico.
* Isso é esperado.

---

## 8. Rotas da API

### 8.1. Healthcheck

```text
GET /api/health
```

Uso:

```powershell
$baseUrl = "https://usmle.helpusbr.com"
Invoke-RestMethod -Method GET -Uri "$baseUrl/api/health"
```

Resultado esperado:

```text
status = ok
db = up
```

### 8.2. Auth

```text
GET/POST /api/auth/[...nextauth]
```

Usa NextAuth v4 e Google.

### 8.3. Criar/listar sessões

```text
GET /api/sessions
POST /api/sessions
```

Usada pela página `/study`.

### 8.4. Criar/listar itens da sessão

```text
GET /api/sessions/[sessionId]/items
POST /api/sessions/[sessionId]/items
```

Responsável por selecionar questões publicadas/ativas e gerar `session_items`.

### 8.5. Carregar questão

```text
GET /api/session-items/[sessionItemId]/question
```

Carrega a questão atual sem revelar resposta antes da tentativa.

### 8.6. Registrar tentativa

```text
POST /api/sessions/[sessionId]/items/[sessionItemId]/attempt
```

Registra resposta, tempo e confiança.

### 8.7. Submeter sessão

```text
POST /api/sessions/[sessionId]/submit
```

Finaliza a sessão.

### 8.8. Review

```text
GET /api/sessions/[sessionId]/review
```

Carrega revisão completa da sessão.

### 8.9. Importação de questões

```text
POST /api/dev/seed-minimal
```

Arquivo:

```text
src/app/api/dev/seed-minimal/route.ts
```

Requer header:

```text
x-admin-key: <ADMIN_SEED_KEY>
```

Em produção, só funciona se:

```env
ADMIN_SEED_ALLOW_PRODUCTION=true
```

Caso contrário, retorna JSON:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Not found"
  }
}
```

---

## 9. Correções aplicadas recentemente

### 9.1. Questões ruins `PMC12748819`

Problemas:

* Uma questão exibia `TBD`.
* Uma questão era curta demais e não seguia o padrão.

Ação:

```sql
UPDATE questions
SET status = 'draft'
WHERE source = 'PMC12748819';
```

Resultado:

```text
PMC12748819 | draft | 2 questões
```

### 9.2. Lote genérico `pilot_import`

Diagnóstico:

* 10 questões ativas eram tecnicamente válidas, mas editorialmente fracas.
* Todas tinham padrão genérico.
* Todas eram `medium`.
* Explicações curtas eram repetitivas/genéricas.
* Não deveriam servir como padrão para expansão.

Consulta usada para confirmar:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE qv.stem ILIKE '%Recent literature on%'
  ) AS generic_recent_literature_count,
  COUNT(*) FILTER (
    WHERE qv.explanation_short ILIKE '%Use core pathophysiology%'
  ) AS generic_explanation_count
FROM questions q
JOIN question_versions qv ON qv.question_id = q.question_id
WHERE q.source = 'pilot_import'
  AND q.status = 'published'
  AND qv.is_active = true;
```

Resultado observado:

```text
total = 10
generic_recent_literature_count = 10
generic_explanation_count = 10
```

Ação:

```sql
UPDATE questions
SET status = 'draft'
WHERE source = 'pilot_import';
```

Resultado:

```text
pilot_import | draft | 10 questões
```

### 9.3. Importação do lote curado `pilot_curated_v1`

Arquivo usado:

```text
seed/pilot_curated_v1_seed_minimal.json
```

Source:

```text
pilot_curated_v1
```

Importação feita via servidor local, conectado ao banco Railway.

Comando final que funcionou:

```powershell
$baseUrl = "http://localhost:3000"
$adminKey = Read-Host "ADMIN_SEED_KEY"

curl.exe -i `
  -X POST "$baseUrl/api/dev/seed-minimal" `
  -H "Content-Type: application/json" `
  -H "x-admin-key: $adminKey" `
  --data-binary "@D:/dev/usmle/seed/pilot_curated_v1_seed_minimal.json"
```

Resultado:

```text
HTTP/1.1 201 Created
source = pilot_curated_v1
requested = 10
created = 10
quality_gate = enabled
```

### 9.4. Problema de BOM no JSON

Durante a importação, houve erro:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request failed schema validation",
    "details": {
      "issues": [
        {
          "path": ["questions"],
          "message": "Required"
        }
      ]
    }
  }
}
```

O arquivo aparentemente tinha `questions`, mas a API recebia como se não tivesse. A causa provável foi encoding/BOM ou envio do body pelo PowerShell.

Correção aplicada:

```powershell
cd D:\dev\usmle

$path = "D:\dev\usmle\seed\pilot_curated_v1_seed_minimal.json"

$raw = Get-Content $path -Raw
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
  $path,
  $raw,
  $utf8NoBom
)
```

Depois foi usado `curl.exe --data-binary`, que funcionou corretamente.

### 9.5. Sessões antigas abandonadas

Foram abandonadas 23 sessões `in_progress` antigas:

```sql
UPDATE sessions
SET status = 'abandoned'
WHERE status = 'in_progress';
```

Resultado:

```text
abandoned_sessions = 23
```

Objetivo:

* Evitar que o site retomasse sessões antigas com questões ruins/genéricas.
* Forçar novas sessões a usar o pool atual.

---

## 10. Estado atual das questões

Consulta para verificar questões publicadas:

```sql
SELECT
  q.source,
  q.status,
  qv.exam,
  qv.language,
  qv.difficulty,
  COUNT(*) AS total
FROM questions q
JOIN question_versions qv ON qv.question_id = q.question_id
WHERE q.status = 'published'
  AND qv.is_active = true
GROUP BY q.source, q.status, qv.exam, qv.language, qv.difficulty
ORDER BY q.source, qv.difficulty;
```

Resultado validado:

```text
pilot_curated_v1 | published | step1 | en | easy   | 2
pilot_curated_v1 | published | step1 | en | medium | 5
pilot_curated_v1 | published | step1 | en | hard   | 3
```

Consulta geral por source/status:

```sql
SELECT
  q.source,
  q.status,
  COUNT(*) AS total
FROM questions q
GROUP BY q.source, q.status
ORDER BY q.source, q.status;
```

Estado esperado:

```text
PMC12748819      | draft     | 2
pilot_import     | draft     | 10
pilot_curated_v1 | published | 10
```

---

## 11. Validação de sessão nova

Sessão nova criada após importação:

```text
session_id = c70d5e0d-cfc9-4343-9f50-85f6dea73e18
status = in_progress
mode = practice
exam = step1
started_at = 2026-05-13T12:03:51.922Z
total_items = 10
```

Todos os itens:

```text
source = pilot_curated_v1
question_status = published
```

Dificuldades na sessão:

```text
easy   = 2
medium = 5
hard   = 3
```

Previews mostraram vinhetas clínicas reais, por exemplo:

```text
A 35-year-old woman with a history of asthma is started on a new medication for migraine prophylaxis...
A 46-year-old man presents to the emergency department 5 hours after onset of crushing substernal chest pain...
A 6-hour-old term male newborn develops progressive cyanosis and tachypnea...
A 27-year-old woman comes to the clinic because of episodic palpitations, tremor, diaphoresis...
```

Isso confirmou que o lote genérico foi substituído pelo lote curado.

---

## 12. Arquivos de seed analisados

Foi analisada uma pasta `seed.zip` com vários arquivos. Diagnóstico:

### 12.1. Arquivos intermediários ou fracos

```text
seed/pilot_batch_10.json
seed/seed_pilot_10_enriched.json
seed/seed_pilot_10_enriched.json.bak
seed/seed_pilot_10_step1stems.json
```

Problemas encontrados:

```text
[PLACEHOLDER]
short_stem
short_long_exp
short_choice_exp
```

Não usar esses arquivos para importação direta.

### 12.2. Arquivo provavelmente usado no lote genérico antigo

```text
seed/seed_pilot_10_seed_minimal.json
```

Problemas:

* 10 questões.
* Todas `medium`.
* 5 alternativas.
* Muitas respostas corretas repetidas na mesma letra.
* Explicações genéricas.
* Stems com padrão artificial.
* Parecia mecanicamente válido, mas editorialmente fraco.

Não usar como padrão.

### 12.3. Melhor arquivo encontrado

```text
seed/seed_pilot_10.json
```

Características:

* 10 questões.
* Dificuldades variadas.
* 4 alternativas.
* Respostas corretas variando.
* Stems clínicos mais coerentes.
* Melhor padrão educacional.

Foi usado como base para gerar:

```text
seed/pilot_curated_v1_seed_minimal.json
```

### 12.4. Segundo melhor arquivo

```text
seed/seed_batch_10.json
```

Características:

* Razoável, mas inferior ao `seed_pilot_10.json`.
* Algumas questões tinham stem curto.
* Algumas respostas corretas repetiam letra.
* Pode ser aproveitado depois com revisão.

---

## 13. Pipeline antigo de geração de questões

Foi analisado `scripts.zip`. O pipeline antigo tinha a seguinte lógica:

```text
ingest_pilot.py
→ descobre PMCIDs e gera estrutura inicial ainda com placeholders

build_step1_stems.py
→ cria stems estilo Step 1 a partir dos textos/âncoras PMC

build_choices_and_explanations.py
→ preenche alternativas e explicações com pools genéricos por disciplina

convert_ready_to_seed_minimal.py
→ converte para o contrato do endpoint /api/dev/seed-minimal
```

Problema do pipeline antigo:

* Ele podia gerar conteúdo tecnicamente estruturado, mas editorialmente genérico.
* O uso de pools genéricos de alternativas/explicações criou questões fracas.
* Algumas etapas deixavam placeholders ou conteúdo curto.
* O resultado precisava de revisão editorial/médica antes de importar.

Conclusão:

* O pipeline pode ser reaproveitado como apoio.
* Não deve publicar diretamente sem quality gate e revisão.
* Novos lotes precisam ser gerados com padrão editorial explícito e validador local.

---

## 14. Importador atual de questões

Arquivo:

```text
src/app/api/dev/seed-minimal/route.ts
```

Versão/identificador do retorno:

```text
import_only_v3_quality_source_control
```

Responsabilidades:

* Importar questões externas em JSON.
* Não gerar questões dentro do código.
* Inserir dados em:

  * `questions`
  * `question_versions`
  * `question_choices`
* Controlar `source`.
* Validar qualidade antes de inserir.
* Bloquear importação insegura em produção.

### 14.1. Contrato esperado do JSON

Formato:

```json
{
  "source": "step1_curated_batch_002",
  "questions": [
    {
      "stem": "Clinical vignette...",
      "difficulty": "easy",
      "explanation_short": "Short explanation...",
      "explanation_long": "Long didactic explanation...",
      "bibliography": [
        {
          "title": "Reference title",
          "source": "Source name",
          "year": 2026,
          "url": "https://...",
          "note": "Why this source supports the item"
        }
      ],
      "prompt": "Which of the following is the most likely mechanism?",
      "choices": [
        {
          "label": "A",
          "text": "Choice A",
          "correct": false,
          "explanation": "Why A is wrong."
        },
        {
          "label": "B",
          "text": "Choice B",
          "correct": true,
          "explanation": "Why B is correct."
        },
        {
          "label": "C",
          "text": "Choice C",
          "correct": false,
          "explanation": "Why C is wrong."
        },
        {
          "label": "D",
          "text": "Choice D",
          "correct": false,
          "explanation": "Why D is wrong."
        }
      ]
    }
  ],
  "chunkSize": 10,
  "requireExactlyTen": true,
  "requireBibliography": false,
  "allowSeedDevSource": false
}
```

### 14.2. Campos obrigatórios por questão

```text
stem
difficulty
explanation_short
explanation_long
choices
```

### 14.3. Dificuldades aceitas

```text
easy
medium
hard
```

### 14.4. Labels aceitas

```text
A
B
C
D
E
```

Para o padrão atual, usar apenas:

```text
A
B
C
D
```

### 14.5. Regras do quality gate

O importador bloqueia:

```text
TBD
to be determined
placeholder
lorem ipsum
coming soon
fixme
todo
n/a
not available
```

Também bloqueia:

```text
stem muito curto
explanation_short curta
explanation_long curta
explicação de alternativa curta
menos de 4 alternativas
mais de 5 alternativas
zero corretas
mais de uma correta
labels duplicadas
labels fora de ordem
source = seed_dev, salvo se allowSeedDevSource=true
```

### 14.6. Source

Padrão atual:

```text
pilot_curated_v1
```

Próximos lotes devem usar nomes novos:

```text
step1_curated_batch_002
step1_curated_batch_003
step1_curated_batch_004
```

Evitar:

```text
seed_dev
pilot_import
PMC sem revisão
```

---

## 15. Como importar um novo lote

### 15.1. Preparar arquivo

Exemplo:

```text
D:\dev\usmle\seed\step1_curated_batch_002.json
```

O arquivo deve conter:

```json
{
  "source": "step1_curated_batch_002",
  "questions": [...],
  "chunkSize": 10,
  "requireExactlyTen": true,
  "requireBibliography": false,
  "allowSeedDevSource": false
}
```

### 15.2. Garantir UTF-8 sem BOM

PowerShell:

```powershell
cd D:\dev\usmle

$path = "D:\dev\usmle\seed\step1_curated_batch_002.json"

$raw = Get-Content $path -Raw
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
  $path,
  $raw,
  $utf8NoBom
)
```

### 15.3. Rodar servidor local conectado ao banco Railway

Janela 1:

```powershell
cd D:\dev\usmle
npm run build
npm run start
```

Testar:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/api/health"
```

Esperado:

```text
status = ok
db = up
```

### 15.4. Importar via localhost

Janela 2:

```powershell
cd D:\dev\usmle

$baseUrl = "http://localhost:3000"
$adminKey = Read-Host "ADMIN_SEED_KEY"

curl.exe -i `
  -X POST "$baseUrl/api/dev/seed-minimal" `
  -H "Content-Type: application/json" `
  -H "x-admin-key: $adminKey" `
  --data-binary "@D:/dev/usmle/seed/step1_curated_batch_002.json"
```

Resultado esperado:

```text
HTTP/1.1 201 Created
"ok": true
"source": "step1_curated_batch_002"
"created": 10
"quality_gate": "enabled"
```

### 15.5. Confirmar no banco

Script Node ou SQL:

```sql
SELECT
  q.source,
  q.status,
  qv.exam,
  qv.language,
  qv.difficulty,
  COUNT(*) AS total
FROM questions q
JOIN question_versions qv ON qv.question_id = q.question_id
WHERE q.status = 'published'
  AND qv.is_active = true
GROUP BY q.source, q.status, qv.exam, qv.language, qv.difficulty
ORDER BY q.source, qv.difficulty;
```

Esperado após próximo lote:

```text
pilot_curated_v1        | published | step1 | en | easy   | 2
pilot_curated_v1        | published | step1 | en | medium | 5
pilot_curated_v1        | published | step1 | en | hard   | 3
step1_curated_batch_002 | published | step1 | en | easy   | 2
step1_curated_batch_002 | published | step1 | en | medium | 5
step1_curated_batch_002 | published | step1 | en | hard   | 3
```

### 15.6. Criar sessão nova e testar

No site:

```text
https://usmle.helpusbr.com/study
```

ou local:

```text
http://localhost:3000/study
```

Criar nova sessão Practice e verificar que há 10 itens.

---

## 16. Como pesquisar questões boas externamente

Objetivo: criar questões originais, estilo USMLE Step 1, baseadas em fontes confiáveis e abertas, sem copiar questão protegida por copyright.

### 16.1. Fontes preferenciais

Usar fontes abertas e verificáveis:

```text
PubMed Central / PMC open-access full text
PubMed abstracts como apoio, quando texto completo não for necessário
NCBI Bookshelf
CDC
WHO
NIH
MedlinePlus
Merck Manual Professional, quando permitido para referência conceitual
OpenStax Anatomy & Physiology / Biology / Microbiology, quando útil
Diretrizes clínicas abertas, quando o conceito Step 1 exigir atualização
Artigos open-access de revisão ou estudos com boa didática
```

Evitar:

```text
UWorld
AMBOSS
NBME
USMLE-Rx
Boards & Beyond
Pathoma
First Aid texto copiado
Questões de bancos comerciais
Qualquer questão pronta protegida por copyright
```

Pode usar esses materiais apenas como inspiração geral de estilo, sem copiar texto, estrutura específica, vinheta ou alternativas.

### 16.2. Critério de escolha de tema

Priorizar tópicos de alto rendimento Step 1:

```text
Cardiovascular physiology/pathology/pharmacology
Renal physiology and acid-base
Pulmonary physiology
Endocrinology
Hematology
Immunology
Microbiology
Pharmacology mechanisms and adverse effects
Neurology
Gastrointestinal
Biochemistry/metabolism
Genetics
Behavioral science/biostatistics, em fase posterior
```

### 16.3. Como escolher fontes externas

Para cada questão candidata:

1. Escolher um conceito Step 1.
2. Buscar uma fonte aberta confiável.
3. Confirmar que a fonte sustenta o mecanismo.
4. Extrair apenas o conceito, não copiar frases longas.
5. Criar uma vinheta clínica original.
6. Criar alternativas plausíveis.
7. Escrever explicações próprias.
8. Registrar bibliografia no JSON.

### 16.4. Estratégia de busca em PubMed/PMC

Usar termos combinando:

```text
disease + mechanism
disease + pathophysiology
drug + mechanism adverse effect
syndrome + laboratory findings
microorganism + virulence factor
immunology + complement/opsonization/hypersensitivity
physiology + renal/pulmonary/cardiac mechanism
```

Exemplos de buscas:

```text
"pheochromocytoma alpha blockade beta blockade mechanism"
"transposition great arteries prostaglandin E1 ductus arteriosus"
"prerenal acute kidney injury fractional excretion sodium"
"encapsulated bacteria opsonization spleen"
"propranolol asthma bronchospasm beta 2 receptor"
"primary hyperparathyroidism bone pain constipation calcium"
"troponin I myocardial infarction biomarker"
"iron deficiency anemia ferritin TIBC"
"type II hypersensitivity hemolytic anemia"
"streptococcus pneumoniae capsule spleen clearance"
```

### 16.5. Critério para usar um artigo

Uma fonte é boa se:

```text
1. É aberta ou tem resumo suficiente para confirmar o conceito.
2. O conceito é estável e aceito.
3. O conceito é testável em Step 1.
4. Dá para transformar em vinheta clínica.
5. Permite criar distratores plausíveis.
6. Não depende de uma estatística obscura ou achado muito específico de um único estudo.
```

Evitar fontes:

```text
Estudo muito pequeno e isolado.
Artigo sobre achado raro sem relevância Step 1.
Conteúdo de opinião.
Conteúdo sem mecanismo claro.
Conteúdo que exige guideline local muito recente e instável.
```

### 16.6. Como transformar fonte em questão

Fluxo:

```text
Fonte externa
→ conceito testável
→ objetivo educacional
→ vinheta clínica original
→ pergunta final
→ alternativa correta
→ 3 distratores plausíveis
→ explicação curta
→ explicação longa
→ explicação por alternativa
→ bibliografia
→ validação
→ importação
```

Exemplo conceitual:

```text
Fonte: mecanismo de broncoespasmo por beta-bloqueador não seletivo.
Conceito testável: bloqueio beta-2 em músculo liso brônquico piora asma.
Vinheta: paciente asmática inicia propranolol para profilaxia de enxaqueca e desenvolve sibilância.
Pergunta: qual mecanismo explica os sintomas?
Resposta correta: antagonismo beta-2 brônquico.
Distratores: bloqueio muscarínico, agonismo beta-1, inibição COX, bloqueio H1.
```

---

## 17. Padrão editorial das próximas questões

As próximas questões devem seguir o padrão do `pilot_curated_v1`.

### 17.1. Estrutura da questão

Cada questão deve ter:

```text
1. Vinheta clínica realista.
2. Dados suficientes para resolver.
3. Dados irrelevantes mínimos, mas plausíveis.
4. Pergunta final clara.
5. 4 alternativas.
6. 1 correta.
7. 3 distratores plausíveis.
8. Explicação curta.
9. Explicação longa.
10. Explicação por alternativa.
11. Bibliografia.
```

### 17.2. Tamanho recomendado

Stem:

```text
120 a 900 caracteres
ideal: 250 a 700 caracteres
```

Prompt:

```text
curto e direto
exemplo: "Which of the following mechanisms best explains this patient's symptoms?"
```

Explicação curta:

```text
40 a 250 caracteres
```

Explicação longa:

```text
120 a 1200 caracteres
```

Explicação por alternativa:

```text
mínimo 30 caracteres
ideal 80 a 300 caracteres
```

### 17.3. Dificuldade

Por lote de 10:

```text
easy   = 2
medium = 5
hard   = 3
```

Easy:

```text
Conceito direto, apresentação clássica, sem muitos passos inferenciais.
```

Medium:

```text
Exige ligar vinheta a mecanismo, laboratório, farmacologia ou fisiopatologia.
```

Hard:

```text
Integra 2 ou 3 conceitos, tem distratores fortes e exige raciocínio mais específico.
```

### 17.4. Distribuição de respostas corretas

Não deixar todas corretas na mesma letra.

Para lote de 10, usar distribuição aproximada:

```text
A = 2 ou 3
B = 2 ou 3
C = 2 ou 3
D = 2 ou 3
```

Exemplo:

```text
A: 3
B: 2
C: 3
D: 2
```

### 17.5. Distratores

Distratores bons devem ser:

```text
plausíveis
relacionados ao mesmo domínio
claramente errados por um motivo didático
úteis para ensinar
```

Distratores ruins:

```text
obviamente absurdos
de outro assunto sem relação
muito curtos
repetitivos
todos começando com a mesma estrutura
```

### 17.6. Linguagem

Por enquanto:

```text
exam = step1
language = en
```

As questões devem ser em inglês.

---

## 18. Qualidade mínima antes de importar

Checklist obrigatório:

```text
[ ] O source está correto e novo.
[ ] O lote tem exatamente 10 questões.
[ ] A distribuição é 2 easy / 5 medium / 3 hard.
[ ] Cada questão tem 4 alternativas.
[ ] Labels são A, B, C, D.
[ ] Exatamente 1 alternativa correta.
[ ] A correta varia entre A/B/C/D no lote.
[ ] Não há TBD.
[ ] Não há placeholder.
[ ] Não há lorem ipsum.
[ ] Não há explanation genérica repetida.
[ ] Não há stem genérico ou artificial.
[ ] Cada alternativa tem explicação própria.
[ ] Cada questão tem bibliography.
[ ] O JSON é UTF-8 sem BOM.
[ ] O arquivo passa no quality gate.
[ ] O lote foi testado em sessão nova.
```

---

## 19. Próxima expansão planejada

Meta imediata:

```text
10 questões publicadas → 30 questões publicadas
```

Criar dois novos lotes:

```text
step1_curated_batch_002
step1_curated_batch_003
```

Cada lote com 10 questões.

### 19.1. Matriz sugerida para `step1_curated_batch_002`

```text
1. Cardiovascular — medium
2. Renal — medium
3. Pulmonary — medium
4. Endocrine — hard
5. Hematology — easy
6. Immunology — medium
7. Microbiology — hard
8. Pharmacology — easy
9. Neurology — hard
10. Gastrointestinal/Biochemistry — medium
```

Distribuição:

```text
easy   = 2
medium = 5
hard   = 3
```

### 19.2. Matriz sugerida para `step1_curated_batch_003`

```text
1. Cell biology — easy
2. Genetics — medium
3. Biochemistry metabolism — hard
4. Microbiology antibiotics — medium
5. Immunology hypersensitivity — medium
6. Endocrine diabetes — easy
7. Renal acid-base — hard
8. Cardio pharmacology — medium
9. Neuro lesion localization — hard
10. Hematology coagulation — medium
```

---

## 20. Próximos arquivos recomendados

### 20.1. `docs/question_authoring_standard.md`

Criar antes de gerar novas questões.

Conteúdo esperado:

```text
- padrão editorial
- estrutura de JSON
- critérios de dificuldade
- fontes permitidas
- fontes proibidas
- checklist
- exemplos bons
- exemplos ruins
```

### 20.2. `scripts/validate-question-batch.mjs`

Criar para validar lote localmente antes da importação.

Deve verificar:

```text
source presente
questions[] presente
exatamente 10 questões, salvo override
2 easy / 5 medium / 3 hard
4 alternativas
1 correta
labels A-D
correta distribuída
TBD/placeholder/lorem ipsum/todo
stem curto
explanation curta
choice explanation curta
bibliography ausente
duplicação de stems
duplicação de alternativas
```

### 20.3. `scripts/import-question-batch.mjs`

Criar para importar sem comandos manuais longos.

Parâmetros desejados:

```text
--file seed/step1_curated_batch_002.json
--base-url http://localhost:3000
--admin-key-env ADMIN_SEED_KEY
```

Ou ler `ADMIN_SEED_KEY` do ambiente.

### 20.4. `seed/step1_curated_batch_002.json`

Próximo lote de 10 questões.

---

## 21. Fluxo recomendado para cada novo lote

```text
1. Definir matriz de temas e dificuldades.
2. Pesquisar fontes externas abertas.
3. Criar 10 questões em inglês.
4. Preencher JSON com source novo.
5. Rodar validador local.
6. Corrigir falhas.
7. Regravar UTF-8 sem BOM.
8. Subir servidor local conectado ao Railway.
9. Importar via localhost.
10. Confirmar no banco.
11. Criar sessão nova.
12. Testar visualmente.
13. Conferir review.
14. Commitar seed e docs/scripts.
15. Só então criar próximo lote.
```

---

## 22. Comandos úteis para verificação por Node

Como SQL direto no PowerShell não funciona, usar scripts Node temporários ou psql.

### 22.1. Verificar questões publicadas

Criar script temporário:

```powershell
cd D:\dev\usmle

@'
import fs from "node:fs";
import pg from "pg";

function loadEnvLocal() {
  const raw = fs.readFileSync(".env.local", "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvLocal();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL_DISABLE === "true"
      ? false
      : { rejectUnauthorized: false },
});

try {
  const result = await pool.query(`
    SELECT
      q.source,
      q.status,
      qv.exam,
      qv.language,
      qv.difficulty,
      COUNT(*) AS total
    FROM questions q
    JOIN question_versions qv ON qv.question_id = q.question_id
    WHERE q.status = 'published'
      AND qv.is_active = true
    GROUP BY q.source, q.status, qv.exam, qv.language, qv.difficulty
    ORDER BY q.source, qv.difficulty;
  `);

  console.table(result.rows);
} finally {
  await pool.end();
}
'@ | Set-Content ".\temp_check_published_questions.mjs" -Encoding UTF8

node .\temp_check_published_questions.mjs
```

### 22.2. Verificar sessões recentes e fontes da última sessão

```powershell
cd D:\dev\usmle

@'
import fs from "node:fs";
import pg from "pg";

function loadEnvLocal() {
  const raw = fs.readFileSync(".env.local", "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvLocal();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL_DISABLE === "true"
      ? false
      : { rejectUnauthorized: false },
});

try {
  console.log("\n=== RECENT SESSIONS ===");

  const recent = await pool.query(`
    SELECT
      s.session_id,
      s.status,
      s.mode,
      s.exam,
      s.started_at,
      s.submitted_at,
      COUNT(si.session_item_id) AS total_items
    FROM sessions s
    LEFT JOIN session_items si ON si.session_id = s.session_id
    GROUP BY
      s.session_id,
      s.status,
      s.mode,
      s.exam,
      s.started_at,
      s.submitted_at
    ORDER BY s.started_at DESC
    LIMIT 10;
  `);

  console.table(recent.rows);

  console.log("\n=== LATEST SESSION QUESTION SOURCES ===");

  const latestSources = await pool.query(`
    SELECT
      s.session_id,
      s.status,
      s.mode,
      s.started_at,
      si.position,
      q.source,
      q.status AS question_status,
      qv.difficulty,
      LEFT(qv.stem, 120) AS stem_preview
    FROM sessions s
    JOIN session_items si ON si.session_id = s.session_id
    JOIN question_versions qv ON qv.question_version_id = si.question_version_id
    JOIN questions q ON q.question_id = qv.question_id
    WHERE s.session_id = (
      SELECT session_id
      FROM sessions
      ORDER BY started_at DESC
      LIMIT 1
    )
    ORDER BY si.position;
  `);

  console.table(latestSources.rows);
} finally {
  await pool.end();
}
'@ | Set-Content ".\temp_validate_latest_session_after_import.mjs" -Encoding UTF8

node .\temp_validate_latest_session_after_import.mjs
```

Limpar temporários:

```powershell
Remove-Item `
  .\temp_check_published_questions.mjs, `
  .\temp_validate_latest_session_after_import.mjs `
  -ErrorAction SilentlyContinue
```

---

## 23. Git e versionamento

Estado final validado:

```text
b4658e2 Add curated pilot question batch
```

Comandos úteis:

```powershell
cd D:\dev\usmle
git status --short
git log -3 --oneline
```

Commit do lote curado:

```powershell
git add seed/pilot_curated_v1_seed_minimal.json
git commit -m "Add curated pilot question batch"
git push origin main
```

Ao adicionar novos lotes:

```powershell
git add docs/question_authoring_standard.md
git add scripts/validate-question-batch.mjs
git add scripts/import-question-batch.mjs
git add seed/step1_curated_batch_002.json

git commit -m "Add curated Step 1 question batch tooling and batch 002"
git push origin main
```

---

## 24. Pendências atuais

### 24.1. Criar documentação editorial

Próximo arquivo recomendado:

```text
docs/question_authoring_standard.md
```

### 24.2. Criar validador local

Próximo arquivo técnico:

```text
scripts/validate-question-batch.mjs
```

### 24.3. Criar script de importação

Arquivo:

```text
scripts/import-question-batch.mjs
```

### 24.4. Criar próximo lote

Arquivo:

```text
seed/step1_curated_batch_002.json
```

### 24.5. Testar sessão online após cada novo lote

Domínio:

```text
https://usmle.helpusbr.com/study
```

---

## 25. Regras operacionais para próximos chats/agentes

1. Não inserir questão diretamente no banco sem passar pelo contrato JSON e importador.
2. Não usar `source = seed_dev` para conteúdo real.
3. Não reativar `pilot_import` ou `PMC12748819` sem revisão manual.
4. Não usar `https://usmle.vercel.app` como domínio operacional.
5. Usar `https://usmle.helpusbr.com`.
6. Antes de importar, validar JSON e encoding.
7. Preferir importação via localhost conectado ao Railway.
8. Manter importação de produção bloqueada, salvo janela controlada.
9. Cada lote novo deve ter source único.
10. Cada lote novo deve ser testado em sessão real.
11. Cada lote novo deve ser versionado no Git.
12. A expansão deve ser incremental: 10 questões por vez.
13. A qualidade editorial é mais importante que volume.

---

## 26. Próxima ação imediata recomendada

Criar o arquivo:

```text
D:\dev\usmle\docs\question_authoring_standard.md
```

Conteúdo desse arquivo deve consolidar o padrão editorial das questões.

Depois criar:

```text
D:\dev\usmle\scripts\validate-question-batch.mjs
```

Só depois gerar:

```text
D:\dev\usmle\seed\step1_curated_batch_002.json
```

---

## 27. Estado final deste handoff

O projeto está pronto para continuar a expansão de questões.

Resumo final:

```text
Aplicação local: OK
Aplicação online correta: https://usmle.helpusbr.com
API online /api/health: OK
Banco Railway: OK
Lote ativo: pilot_curated_v1
Questões ativas: 10
Sessão nova com lote ativo: validada
Lotes ruins: retirados para draft
Importador: com quality gate
Git: commit b4658e2 no main/origin
Próxima etapa: documentação editorial + validador + batch 002
```
