# USMLE Platform — Plano de Adequação ao Novo Formato USMLE 2026

**Arquivo sugerido no repositório:** `docs/USMLE_2026_FORMAT_ADAPTATION_PLAN.md`
**Projeto local:** `D:/dev/usmle`
**Domínio:** `https://usmle.helpusbr.com`
**Data de criação:** 2026-05-14
**Status:** planejamento técnico/funcional, ainda não implementado
**Escopo:** frontend, backend/API, banco de dados, schema de conteúdo, analytics e estratégia de produto

---

## 1. Resumo executivo

O USMLE mudou o padrão operacional de entrega dos exames em 2026. Para a plataforma HelpUS USMLE, a consequência principal é que o produto não deve mais tratar sessões apenas como "listas genéricas de questões". Ele deve passar a representar e treinar o usuário no **formato real de blocos curtos**, com foco em:

- blocos cronometrados de 20 questões / 30 minutos;
- simulação oficial com múltiplos blocos;
- planejamento de breaks;
- disciplina de flags;
- analytics por bloco;
- rastreamento de prontidão com NBME/Free 120;
- metadados de formato nos conteúdos;
- tag transversal de `nutrition_science`;
- possíveis mudanças de banco para armazenar bloco, tempo, flags, breaks e scores externos.

A plataforma já possui uma base funcional: Dashboard, Study, Results, Progress, Settings, modos Practice, Timed block e Exam simulation, histórico de sessões, filtros por áreas e defaults de estudo. O trabalho agora é **adequar o comportamento e os dados** para o novo padrão oficial.

---

## 2. Fontes consideradas

### 2.1 Fontes oficiais

1. USMLE — Step 1 Exam Content
   `https://www.usmle.org/step-exams/step-1/step-1-exam-content`

2. USMLE — Test Delivery Software Updates for Step 2 CK and Step 1 Coming in May 2026
   `https://www.usmle.org/test-delivery-software-updates-step-2-ck-and-step-1-coming-may-2026`

3. USMLE — Step 2 CK Exam Content
   `https://www.usmle.org/step-exams/step-2-ck/step-2-ck-exam-content`

4. USMLE — Step 3 Exam Content
   `https://www.usmle.org/step-exams/step-3/step-3-exam-content`

5. USMLE — Enhancements to Nutrition Content on USMLE Step Exams Coming in June 2026
   `https://www.usmle.org/enhancements-nutrition-content-usmle-step-exams-coming-june-2026`

6. USMLE — Step 1 Sample Test Questions / interactive testing experience
   `https://www.usmle.org/exam-resources/step-1-materials/step-1-sample-test-questions`

### 2.2 Fonte comunitária / curadoria

- **The Step Gazette — Edição Especial Abril–Maio 2026**
  Curadoria de 905 posts do r/step1, 01/Abr/2026 a 14/Mai/2026.
  Deve ser usada como insumo de produto/mentoria, não como fonte normativa oficial.

---

## 3. Mudança oficial de formato

### 3.1 Step 1 — formato novo a partir de 14/05/2026

Formato novo oficial:

| Item | Valor |
|---|---:|
| Duração total | 8 horas |
| Número de blocos | 14 |
| Duração por bloco | 30 minutos |
| Questões por bloco | até 20 |
| Total máximo de questões | até 280 |
| Break mínimo | 55 minutos |
| Tutorial opcional | 5 minutos |

Formato anterior:

| Item | Valor |
|---|---:|
| Número de blocos | 7 |
| Duração por bloco | 60 minutos |
| Questões por bloco | até 40 |
| Break mínimo | 45 minutos |
| Tutorial opcional | 15 minutos |

### 3.2 Step 2 CK — formato novo a partir de 07/05/2026

Formato novo oficial:

| Item | Valor |
|---|---:|
| Duração total | 9 horas |
| Número de blocos | 16 |
| Duração por bloco | 30 minutos |
| Questões por bloco | até 20 |
| Total máximo de questões | até 318 |
| Break mínimo | 55 minutos |
| Tutorial opcional | 5 minutos |

Observação: na prática, algumas comunicações resumem como blocos de 18–20 questões, mas o site oficial fala em até 20 questões por bloco.

### 3.3 Step 3 — formato oficial atual

Step 3 já segue blocos curtos.

Day 1:

| Item | Valor |
|---|---:|
| MCQs | 232 |
| Blocos | 12 |
| Questões por bloco | 18–20 |
| Duração por bloco | 30 minutos |
| Sessão | cerca de 7 horas |
| Break | 55 minutos |
| Tutorial | 5 minutos |

Day 2:

| Item | Valor |
|---|---:|
| MCQs | 180 |
| Blocos MCQ | 9 |
| Questões por bloco | 20 |
| Duração por bloco | 30 minutos |
| CCS cases | 13–14 casos |

---

## 4. Ponto de atenção: conteúdo de nutrição

A curadoria comunitária descreve a mudança de nutrição como algo que muitos candidatos interpretaram como recategorização de score report. Contudo, a fonte oficial USMLE informa que haverá **enhanced nutrition science content** em todos os Step exams a partir de junho de 2026.

Interpretação operacional para a plataforma:

- não tratar nutrição como mera recategorização;
- criar uma tag transversal `nutrition_science`;
- não transformar nutrição em área isolada demais se isso prejudicar integração por sistema;
- associar nutrição a sistemas e contextos clínicos.

Exemplos de temas para conteúdo futuro:

- diabetes e aconselhamento nutricional;
- CKD, sódio, potássio, proteína e fósforo;
- gravidez, folato, ferro, iodo e suplementação;
- obesidade, risco cardiometabólico e estilo de vida;
- enteral/parenteral nutrition;
- deficiências vitamínicas;
- failure to thrive;
- malnutrição, cachexia, refeeding syndrome;
- dislipidemia e intervenção dietética;
- saúde pública e prevenção.

---

## 5. Estado atual observado no frontend

Com base nas telas atuais do site, o frontend possui:

### 5.1 Navegação principal

- Dashboard
- Study
- Results
- Progress
- Settings
- WhatsApp

### 5.2 Dashboard atual

Elementos observados:

- Total sessions
- Completion rate
- Most used mode
- Open sessions
- Activity chart
- Mode mix
- Status mix
- Study hub
- Quick navigation

Diagnóstico:

- Bom para visão geral.
- Ainda não mostra prontidão USMLE por formato oficial.
- Ainda não mostra métricas de bloco curto, pacing, flags ou fadiga.

### 5.3 Study atual

Elementos observados:

- Use my defaults
- Default exam
- Default mode
- Default count
- Difficulty
- Difficulty order
- Area order
- Excluded areas
- Continue current session
- Recent completed
- Start a new session:
  - Practice
  - Timed block
  - Exam simulation

Diagnóstico:

- A tela já tem os modos certos.
- O problema é que os presets ainda parecem genéricos.
- `Practice` com 20 questões está adequado.
- `Timed block` precisa refletir 20 questões / 30 minutos para o formato novo.
- `Exam simulation` precisa representar o perfil oficial do exame escolhido, não apenas uma sessão de 40 questões.

### 5.4 Results atual

Elementos observados:

- Total sessions
- Completed
- In progress
- Abandoned
- Quick actions
- Filters por mode/status
- Session history
- Open review
- Resume session
- New study session

Diagnóstico:

- Bom para navegação.
- Precisa mostrar metadados de bloco e performance:
  - exam;
  - mode;
  - block size;
  - time limit;
  - accuracy;
  - flags;
  - unanswered;
  - time used;
  - block index.

### 5.5 Progress atual

Elementos observados:

- Total sessions
- Completion rate
- Active days
- Most used mode
- Activity chart
- Mode mix
- Status mix
- Practice share
- Timed share
- Exam sim share
- Open sessions
- Recent activity

Diagnóstico:

- Excelente base para coaching.
- Atualmente mostra `Practice share` como métrica, mas deve incentivar transição para `Timed block` e `Exam simulation`.
- Precisa incorporar readiness, pacing e fadiga.

### 5.6 Settings atual

Elementos observados:

- Default exam
- Default mode
- Practice question count
- Default difficulty
- Difficulty order
- Area order
- Medical areas
- Open review automatically after session submit
- Confirm before leaving an active session
- Show timer in highlighted mode during timed sessions

Diagnóstico:

- Boa base para defaults.
- Precisa separar:
  - practice count;
  - timed block count;
  - timed block duration;
  - exam simulation profile;
  - break plan;
  - pacing/flag warnings.

---

## 6. Adequações funcionais necessárias

### 6.1 Novo conceito: Exam Format Profile

Criar perfis explícitos de formato por exame.

Exemplo conceitual:

```ts
type ExamFormatProfile = {
  id: string;
  exam: "step1" | "step2ck" | "step3";
  label: string;
  effectiveFrom: string | null;
  totalItemsMax?: number;
  totalBlocks?: number;
  itemsPerBlockMin?: number;
  itemsPerBlockMax?: number;
  minutesPerBlock?: number;
  totalSessionMinutes?: number;
  minimumBreakMinutes?: number;
  tutorialMinutes?: number;
  dayNumber?: 1 | 2;
  includesCcs?: boolean;
  isDefault: boolean;
};
```

Perfis mínimos:

```text
step1_2026_official
step1_legacy
step2ck_2026_official
step2ck_legacy
step3_day1_2026_official
step3_day2_2026_official
custom_practice
```

### 6.2 Ajuste do modo Practice

Practice deve continuar existindo como modo livre.

Proposta:

```text
Practice
- default: 20 questões
- feedback imediato
- sem pressão total
- ideal para aprendizado
```

Campos necessários:

- `mode = practice`
- `question_count`
- `feedback_policy = immediate`
- `timed = false` ou opcional

### 6.3 Ajuste do modo Timed block

Timed block deve passar a representar o bloco oficial curto.

Para Step 1:

```text
Timed block
- 20 questões
- 30 minutos
- feedback ao final
- review somente após finalizar
- alerta de pacing
- alerta de flags
```

Para Step 2 CK:

```text
Timed block
- até 20 questões
- 30 minutos
```

Para Step 3:

```text
Timed block
- Day 1: 18–20 questões / 30 minutos
- Day 2 MCQ: 20 questões / 30 minutos
```

### 6.4 Ajuste do modo Exam simulation

Exam simulation deve deixar de ser apenas "40 questions" e passar a ser um perfil oficial.

Para Step 1:

```text
Step 1 Official 2026 Simulation
14 blocos × 20 questões
30 minutos por bloco
até 280 questões
55 minutos de break mínimo
```

Versões úteis:

```text
Full simulation: 14×20
Half simulation: 7×20
Quarter simulation: 3–4×20
Custom simulation
```

### 6.5 Break planner

Criar um planejador de breaks para simulado.

Campos:

- `planned_break_after_blocks`: array de inteiros;
- `planned_break_minutes_by_block`: JSON;
- `actual_break_minutes_by_block`: JSON;
- `break_time_used_minutes`;
- `break_time_remaining_minutes`.

Presets:

```text
Conservative:
after blocks 4, 8, 10, 12

Every 3 blocks:
after blocks 3, 6, 9, 12

Fatigue-protective:
after blocks 4, 7, 10, 12, 13
```

### 6.6 Flag discipline

Implementar alerta de flags por bloco.

Regra inicial:

```text
0–4 flags: normal
5–7 flags: warning
8+ flags: critical
```

Campos necessários:

- `session_items.flagged`;
- `session_items.flagged_at`;
- `flag_count_by_block`;
- `flag_warning_level`.

### 6.7 Pacing

Para 20 questões / 30 minutos:

```text
90 segundos por questão
```

Pontos de checagem:

| Questão | Tempo restante esperado |
|---:|---:|
| 5 | ~22:30 |
| 10 | ~15:00 |
| 15 | ~7:30 |
| 20 | 0:00 |

Campos:

- `time_limit_seconds`;
- `started_at`;
- `submitted_at`;
- `time_spent_seconds`;
- `avg_seconds_per_item`;
- `pacing_status`.

### 6.8 Review por bloco

O aluno deve revisar dentro do bloco antes de fechar. Depois de fechado, não deve poder voltar ao bloco anterior em modo simulado.

Comportamentos:

```text
Practice:
review livre/imediato.

Timed block:
review ao final do bloco.

Exam simulation:
review só dentro do bloco atual; bloco fechado fica bloqueado até o review final pós-submit.
```

Campos:

- `review_policy`;
- `block_closed_at`;
- `can_return_to_previous_blocks`.

---

## 7. Adequações de banco de dados

Este é o ponto que provavelmente exigirá migrações. Antes de implementar, inventariar o schema real. O projeto usa PostgreSQL via `pg`; o estado conhecido inclui tabelas como `questions`, `question_versions`, `question_choices`, `sessions`, `session_items` e `attempts`.

### 7.1 Princípio de migração

Não fazer alteração direta sem:

1. inventário do schema atual;
2. script SQL versionado;
3. teste local/preview;
4. rollback simples quando possível;
5. build após alteração;
6. commit isolado para schema/API antes de alterar frontend pesado.

### 7.2 Possível tabela: `exam_format_profiles`

Objetivo: armazenar perfis oficiais e customizados.

Campos sugeridos:

```sql
CREATE TABLE exam_format_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key TEXT NOT NULL UNIQUE,
  exam TEXT NOT NULL,
  label TEXT NOT NULL,
  effective_from DATE,
  total_items_max INTEGER,
  total_blocks INTEGER,
  items_per_block_min INTEGER,
  items_per_block_max INTEGER,
  minutes_per_block INTEGER,
  total_session_minutes INTEGER,
  minimum_break_minutes INTEGER,
  tutorial_minutes INTEGER,
  day_number INTEGER,
  includes_ccs BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seeds iniciais:

```text
step1_2026_official
step1_legacy
step2ck_2026_official
step2ck_legacy
step3_day1_2026_official
step3_day2_2026_official
```

### 7.3 Alterações em `sessions`

Adicionar metadados de modo e formato.

Campos sugeridos:

```sql
ALTER TABLE sessions
  ADD COLUMN exam_format_profile_id UUID REFERENCES exam_format_profiles(id),
  ADD COLUMN exam_format_version TEXT,
  ADD COLUMN block_size INTEGER,
  ADD COLUMN block_minutes INTEGER,
  ADD COLUMN total_blocks INTEGER,
  ADD COLUMN current_block_index INTEGER,
  ADD COLUMN timed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN review_policy TEXT,
  ADD COLUMN break_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN submitted_at TIMESTAMPTZ,
  ADD COLUMN total_time_spent_seconds INTEGER,
  ADD COLUMN total_break_used_seconds INTEGER;
```

Observação: se `sessions` já tiver parte desses campos, adaptar em vez de duplicar.

### 7.4 Alterações em `session_items`

Adicionar metadados por item/bloco.

Campos sugeridos:

```sql
ALTER TABLE session_items
  ADD COLUMN block_index INTEGER,
  ADD COLUMN position_in_block INTEGER,
  ADD COLUMN time_limit_seconds INTEGER,
  ADD COLUMN time_spent_seconds INTEGER,
  ADD COLUMN first_seen_at TIMESTAMPTZ,
  ADD COLUMN answered_at TIMESTAMPTZ,
  ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN flagged_at TIMESTAMPTZ,
  ADD COLUMN answer_changed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN is_unanswered BOOLEAN NOT NULL DEFAULT FALSE;
```

Índices úteis:

```sql
CREATE INDEX idx_session_items_session_block
  ON session_items(session_id, block_index, position_in_block);

CREATE INDEX idx_session_items_session_flagged
  ON session_items(session_id, flagged);
```

### 7.5 Alterações em `attempts`

A depender do schema atual, adicionar:

```sql
ALTER TABLE attempts
  ADD COLUMN time_spent_seconds INTEGER,
  ADD COLUMN was_flagged BOOLEAN,
  ADD COLUMN block_index INTEGER,
  ADD COLUMN changed_from_choice_id UUID,
  ADD COLUMN changed_answer BOOLEAN;
```

Se `attempts` já armazena múltiplas respostas, avaliar se `changed_answer` pode ser derivado sem coluna.

### 7.6 Nova tabela opcional: `session_blocks`

Recomendado se quisermos analytics robusto por bloco.

```sql
CREATE TABLE session_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  block_index INTEGER NOT NULL,
  planned_item_count INTEGER NOT NULL,
  actual_item_count INTEGER NOT NULL,
  time_limit_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  time_spent_seconds INTEGER,
  correct_count INTEGER,
  incorrect_count INTEGER,
  unanswered_count INTEGER,
  flagged_count INTEGER,
  changed_answer_count INTEGER,
  accuracy_pct NUMERIC(5,2),
  avg_seconds_per_item NUMERIC(8,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, block_index)
);
```

Benefícios:

- facilita Progress;
- facilita Results;
- permite simulado multi-bloco;
- evita queries pesadas sobre `session_items` em toda tela.

### 7.7 Nova tabela opcional: `external_assessments`

Para readiness tracker de NBME/Free 120.

```sql
CREATE TABLE external_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exam TEXT NOT NULL,
  assessment_type TEXT NOT NULL, -- nbme, free120, cbse, cbssa, uwsa, other
  form_name TEXT,
  score_pct NUMERIC(5,2),
  score_reported TEXT,
  taken_at DATE,
  platform TEXT, -- official, offline_pdf, screenshot_pdf, other
  timed BOOLEAN,
  interrupted BOOLEAN,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 7.8 Conteúdo e tags

Hoje as questões provavelmente têm bibliografia e campos centrais, mas precisamos confirmar o schema de `question_versions`.

Campos ou metadata sugeridos:

```text
exam_format_version
item_format
estimated_time_seconds
primary_area
secondary_areas
systems
processes
task
nutrition_science
has_chart
has_table
has_image
is_sequential_set
set_id
```

Se o importador rejeitar campos novos, usar `metadata JSONB` ou criar tabelas auxiliares.

Tabela opcional:

```sql
CREATE TABLE question_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_version_id UUID NOT NULL REFERENCES question_versions(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_version_id, tag_type, tag_value)
);
```

Tags mínimas:

```text
area:cardiology
area:pulmonology
area:renal
area:gastroenterology
area:endocrinology
area:hematology
area:immunology
area:microbiology
area:pharmacology
area:neurology
area:biochemistry_genetics
area:pediatrics
area:reproductive_gynecology
area:pathology
area:physiology
area:psychiatry_behavioral
area:biostatistics_ethics
cross:nutrition_science
format:chart
format:abstract
format:sequential_item_set
format:patient_scenario
```

---

## 8. Adequações de API/backend

### 8.1 Endpoint de criação de sessão

Provável endpoint atual:

```text
POST /api/sessions
```

Adequar para aceitar:

```json
{
  "exam": "step1",
  "mode": "timed",
  "examFormatProfileKey": "step1_2026_official",
  "questionCount": 20,
  "blockSize": 20,
  "blockMinutes": 30,
  "difficulty": "mixed",
  "areas": ["cardiology", "renal"],
  "breakPlan": {
    "afterBlocks": [4, 8, 10, 12]
  }
}
```

### 8.2 Geração de sessão

A lógica de sessão deve:

1. selecionar questões elegíveis;
2. dividir em blocos;
3. atribuir `block_index`;
4. atribuir `position_in_block`;
5. definir `time_limit_seconds`;
6. respeitar `review_policy`.

### 8.3 Endpoint de submit/review

Prováveis endpoints:

```text
POST /api/sessions/[sessionId]/submit
GET /api/sessions/[sessionId]/review
POST /api/sessions/[sessionId]/items/[sessionItemId]/attempt
```

Adequar para:

- registrar tempo por item;
- registrar flags;
- registrar troca de resposta;
- fechar bloco;
- impedir retorno a bloco fechado em simulado;
- calcular block summary.

### 8.4 Endpoint de Progress

Adicionar agregados:

```text
GET /api/me/stats
```

ou novo:

```text
GET /api/me/progress
```

Campos esperados:

```json
{
  "timedBlockCount": 12,
  "examSimulationCount": 2,
  "avgTimedBlockAccuracy": 68.5,
  "avgSecondsPerItem": 84,
  "avgFlagsPerBlock": 3.2,
  "lateBlockFatigueDrop": -8.4,
  "readiness": {
    "status": "borderline",
    "officialNbmeCount": 2,
    "latestFree120": 66
  }
}
```

### 8.5 Endpoint de readiness

Novo endpoint possível:

```text
GET /api/readiness
POST /api/readiness/external-assessments
```

---

## 9. Adequações no frontend

### 9.1 Study page

#### Current issue

Cards atuais incluem `Practice`, `Timed block`, `Exam simulation`, mas `Timed block` e `Exam simulation` ainda parecem genéricos.

#### Novo card Practice

```text
Practice
20 questions
Immediate feedback after each question.
Best for learning.
```

#### Novo card Timed block

Para Step 1:

```text
Timed block
20 questions · 30 min
New USMLE 2026 block format.
Best for pacing and flag discipline.
```

Para Step 2 CK:

```text
Timed block
Up to 20 questions · 30 min
Official 2026 short-block format.
```

#### Novo card Exam simulation

Para Step 1:

```text
Exam simulation
14 blocks × 20 questions
Official 2026 Step 1 format.
Break planner included.
```

### 9.2 Study setup screen

Antes de iniciar simulado, exibir:

```text
Exam: Step 1
Format: Official 2026
Blocks: 14
Questions/block: 20
Minutes/block: 30
Total: up to 280 questions
Break: 55 min minimum
Review: current block only
```

Adicionar seletor:

```text
Simulation length:
- Full 14×20
- Half 7×20
- Mini 3×20
- Custom
```

### 9.3 In-session UI

Adicionar:

- block number: `Block 3 of 14`;
- question number within block: `Q12/20`;
- timer per block;
- flag count;
- pacing indicator;
- close block button;
- warning before closing block;
- review flagged within current block.

### 9.4 Results page

Card de sessão deve mostrar:

```text
Step 1 · Timed block
20q · 30min
Accuracy: 70%
Time used: 27:40
Avg/q: 83 sec
Flags: 3
Unanswered: 0
```

Para simulado:

```text
Step 1 Full Simulation
Blocks completed: 14/14
Overall accuracy: 68%
Weakest block: 12
Fatigue drop after block 10: -9%
```

### 9.5 Progress page

Adicionar seções:

#### USMLE format readiness

```text
20q timed blocks completed
Full simulations completed
Average timed accuracy
Average flags/block
Average seconds/question
```

#### Readiness tracker

```text
NBME official scores
Free 120
Offline scores marked as weaker evidence
Trend
```

#### Coaching target

Exemplo:

```text
Next target:
Complete 3 timed blocks of 20 questions this week.
```

### 9.6 Settings page

Adicionar seção:

```text
Exam format
[Official 2026 format]
```

Campos:

```text
Default exam
Default mode
Practice question count
Timed block question count
Timed block minutes
Exam simulation profile
Break strategy
Show pacing warnings
Show flag warnings
Show timer highlighted
Open review automatically
Confirm before leaving active session
```

### 9.7 Medical areas

Adicionar ou destacar:

```text
Nutrition Science
```

Opções:

1. Área própria visível.
2. Tag transversal aplicada em múltiplas áreas.

Recomendação: usar tag transversal internamente e talvez exibir filtro visível "Nutrition Science" em "Special topics".

---

## 10. Adequações no padrão de geração de questões

### 10.1 Padrão atual mantido

Continuar com:

- batches incrementais de 10;
- inglês;
- stems clínicos ricos;
- 5 alternativas;
- explicação por alternativa;
- `explanation_short`;
- `explanation_long`;
- bibliografia como array;
- difficulty `easy=2`, `medium=5`, `hard=3`;
- respostas A/B/C/D/E balanceadas.

### 10.2 Novos metadados desejáveis

Adicionar quando o importador/schema permitir:

```json
{
  "exam_format_version": "2026_official",
  "recommended_block_size": 20,
  "estimated_time_seconds": 90,
  "item_format": "single_best_answer",
  "has_chart": false,
  "has_table": false,
  "has_image": false,
  "is_sequential_set": false,
  "primary_area": "cardiology",
  "secondary_areas": ["pathology"],
  "cross_tags": ["nutrition_science"]
}
```

### 10.3 Step 2 CK futuro

Para Step 2 CK, aumentar presença de:

- chart/tabular stems;
- management;
- diagnosis;
- screening/prevention;
- ethics/communication;
- abstracts/drug ads quando aplicável;
- nutrition science em contexto clínico.

### 10.4 Step 3 futuro

Para Step 3:

- next best step;
- hospital management;
- outpatient follow-up;
- patient safety;
- preventive care;
- ethics/legal;
- CCS awareness;
- Day 1 vs Day 2 tagging.

---

## 11. Analytics necessários

### 11.1 Por sessão

- total questions;
- accuracy;
- completion status;
- mode;
- exam;
- format profile;
- total time;
- average time per question;
- flags total;
- unanswered total.

### 11.2 Por bloco

- block index;
- question count;
- correct count;
- incorrect count;
- unanswered count;
- accuracy;
- time used;
- average seconds per item;
- flags;
- changed answers;
- pacing status.

### 11.3 Por usuário

- completed timed blocks;
- completed exam simulations;
- active days;
- mode mix;
- status mix;
- areas weak/strong;
- fatigue index;
- readiness status;
- NBME/Free 120 trend.

### 11.4 Fatigue index

Métrica simples inicial:

```text
fatigue_drop = average_accuracy_last_third - average_accuracy_first_third
```

Para Step 1 full simulation:

```text
first_third = blocks 1–4
middle = blocks 5–9
last_third = blocks 10–14
```

### 11.5 Flag discipline score

Métrica inicial:

```text
flag_rate = flags / questions
```

Para 20 questions:

```text
0–4 flags: OK
5–7 flags: watch
8+ flags: high risk
```

---

## 12. Roadmap de implementação

### Fase 0 — Inventário técnico

Antes de editar:

1. `git status`;
2. listar `src/app` routes;
3. listar componentes Study/Results/Progress/Settings;
4. inspecionar schema real do banco;
5. inspecionar `POST /api/sessions`;
6. inspecionar `POST /api/dev/seed-minimal`;
7. inspecionar tipos TypeScript existentes;
8. inspecionar se `question_versions` tem `metadata`.

Comandos sugeridos:

```powershell
Set-Location D:/dev/usmle
git status --short
Get-ChildItem src/app -Recurse -File | Select-Object FullName
Get-ChildItem src -Recurse -File -Include *.ts,*.tsx | Select-String -Pattern "sessions|session_items|attempts|question_versions|Practice|Timed block|Exam simulation"
```

### Fase 1 — Quick win frontend/config

Objetivo: adequar UX sem migração pesada.

Tarefas:

- corrigir textos dos cards em Study;
- mudar Timed block default para 20q/30min;
- mudar Exam simulation label para Official 2026 format;
- adicionar bloco explicativo no Study;
- adicionar `exam format` como configuração estática em código;
- manter compatibilidade com sessões existentes.

Validação:

```powershell
cmd.exe /c npm run build
```

### Fase 2 — Exam Format Profiles em código

Objetivo: criar fonte única em TypeScript.

Arquivo possível:

```text
src/lib/exam-format-profiles.ts
```

Conteúdo:

```ts
export const EXAM_FORMAT_PROFILES = {
  step1_2026_official: { ... },
  step2ck_2026_official: { ... },
  step3_day1_2026_official: { ... },
  step3_day2_2026_official: { ... }
}
```

Sem DB ainda, se quisermos risco menor.

### Fase 3 — DB migration mínima

Objetivo: persistir blocos e timed session.

Possíveis alterações mínimas:

- `sessions.exam_format_version`;
- `sessions.block_size`;
- `sessions.block_minutes`;
- `sessions.total_blocks`;
- `session_items.block_index`;
- `session_items.position_in_block`;
- `session_items.flagged`;
- `session_items.time_spent_seconds`.

Critério: só depois de confirmar schema real.

### Fase 4 — Session generation por bloco

Objetivo: ao criar Timed block ou Exam simulation, distribuir questões em blocos.

Tarefas:

- update `POST /api/sessions`;
- update session item ordering;
- add block metadata;
- ensure old sessions still work.

### Fase 5 — Timer/flag/pacing UI

Tarefas:

- timer por bloco;
- flag button;
- flag count;
- pacing warnings;
- close block behavior.

### Fase 6 — Results/Progress analytics

Tarefas:

- aggregate por bloco;
- cards no Results;
- Progress com timed block readiness;
- fatigue index;
- mode mix mais acionável.

### Fase 7 — Readiness tracker

Tarefas:

- criar tabela `external_assessments`;
- UI para inserir NBME/Free 120;
- distinguir official vs offline;
- calcular readiness.

### Fase 8 — Nutrition content enhancement

Tarefas:

- adicionar tag `nutrition_science`;
- revisar filtros UI;
- gerar 1–2 questões de nutrição por batch quando aplicável;
- implementar analytics por tag.

---

## 13. Ordem recomendada dos commits

### Commit 1 — documentação

```text
Add USMLE 2026 format adaptation plan
```

Arquivo:

```text
docs/USMLE_2026_FORMAT_ADAPTATION_PLAN.md
```

### Commit 2 — frontend quick labels/config

```text
Update study mode labels for USMLE 2026 format
```

### Commit 3 — exam format profiles

```text
Add official USMLE 2026 exam format profiles
```

### Commit 4 — DB migration mínima

```text
Add block metadata for timed USMLE sessions
```

### Commit 5 — session generation

```text
Support block-based timed session generation
```

### Commit 6 — UI timer/flags

```text
Add block pacing and flag indicators
```

### Commit 7 — analytics

```text
Add block-level progress analytics
```

### Commit 8 — readiness tracker

```text
Add NBME and Free 120 readiness tracker
```

### Commit 9 — nutrition tags

```text
Add nutrition science tagging support
```

---

## 14. Riscos e cuidados

### 14.1 Compatibilidade com sessões antigas

Sessões antigas podem não ter:

- block size;
- block index;
- exam format profile;
- time spent;
- flags.

A UI deve tratar `null` de forma segura.

### 14.2 Importador de seed

O importador atual pode rejeitar campos novos. Antes de adicionar metadados nos JSONs:

1. inspecionar schema zod da rota;
2. testar em arquivo pequeno;
3. se rejeitar, manter metadados fora do JSON até adaptar importador;
4. não quebrar batches já publicados.

### 14.3 DB Railway

Qualquer migração em Railway deve ser feita com:

- backup ou reversibilidade;
- script claro;
- validação local quando possível;
- build depois;
- commit separado.

### 14.4 Não confundir oficial com comunitário

- Formato de blocos: oficial.
- Nutrition enhanced content: oficial.
- Estratégias de 65% NBME / Free 120 / flags: comunitárias e úteis, mas devem aparecer como coaching, não como garantia.

### 14.5 Evitar overengineering inicial

Priorizar:

1. labels/presets corretos;
2. profile config;
3. block metadata mínimo;
4. analytics simples.

---

## 15. Checklist de implementação

### Produto/UX

- [ ] Atualizar texto de Study cards.
- [ ] Mostrar Step 1 Official 2026 format.
- [ ] Mostrar Step 2 CK Official 2026 format.
- [ ] Mostrar Step 3 Day 1/Day 2 format.
- [ ] Separar Practice count de Timed block count.
- [ ] Adicionar break planner.
- [ ] Adicionar flag warning.
- [ ] Adicionar pacing warning.
- [ ] Adicionar readiness tracker.
- [ ] Adicionar Nutrition Science como tag/filtro.

### Backend/API

- [ ] Inventariar schema atual.
- [ ] Criar profiles em TypeScript.
- [ ] Adaptar session creation.
- [ ] Adaptar session items para block index.
- [ ] Adaptar attempt submit para time/flag.
- [ ] Adaptar review endpoint.
- [ ] Adaptar stats/progress endpoint.

### Banco

- [ ] Decidir se `exam_format_profiles` será tabela ou config em código.
- [ ] Adicionar campos de bloco em `sessions`.
- [ ] Adicionar campos de bloco/tempo/flag em `session_items`.
- [ ] Avaliar `session_blocks`.
- [ ] Avaliar `external_assessments`.
- [ ] Avaliar `question_tags`.
- [ ] Rodar migração com validação.

### Conteúdo

- [ ] Atualizar standard de autoria.
- [ ] Incluir `nutrition_science` nos próximos batches quando aplicável.
- [ ] Incluir item_format quando schema permitir.
- [ ] Incluir estimated_time_seconds quando schema permitir.
- [ ] Planejar Step 2 CK batch003 já no novo padrão.

### QA

- [ ] Build passa.
- [ ] Sessões antigas continuam abrindo.
- [ ] Practice continua funcionando.
- [ ] Timed block cria 20q/30min.
- [ ] Exam simulation cria blocos esperados.
- [ ] Review respeita bloco.
- [ ] Results mostra status correto.
- [ ] Progress calcula sem quebrar dados antigos.
- [ ] Nenhum arquivo temporário/log entra no commit.

---

## 16. Próximo passo seguro

Executar somente inventário, sem modificar:

```powershell
Set-Location D:/dev/usmle

Write-Output '=== GIT ==='
git status --short
git log -1 --oneline

Write-Output '=== PACKAGE ==='
Get-Content package.json -Raw

Write-Output '=== ROUTES ==='
Get-ChildItem src/app -Recurse -File |
  Select-Object FullName |
  Sort-Object FullName

Write-Output '=== SESSION REFERENCES ==='
Get-ChildItem src -Recurse -File -Include *.ts,*.tsx |
  Select-String -Pattern 'sessions|session_items|attempts|Practice|Timed block|Exam simulation|questionCount|mode|difficulty' |
  Select-Object Path, LineNumber, Line |
  Format-Table -AutoSize
```

Depois do inventário, decidir se o primeiro commit será apenas documentação ou se já faremos quick-win de frontend.

---

## 17. Decisão recomendada

Salvar este arquivo em:

```text
D:/dev/usmle/docs/USMLE_2026_FORMAT_ADAPTATION_PLAN.md
```

Depois commitar apenas a documentação:

```powershell
Set-Location D:/dev/usmle
git add -- docs/USMLE_2026_FORMAT_ADAPTATION_PLAN.md
git commit -m "Add USMLE 2026 format adaptation plan"
```

Não implementar DB/frontend no mesmo commit da documentação.
