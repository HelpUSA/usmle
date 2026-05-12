BEGIN;

INSERT INTO questions (question_id, canonical_code, status, source)
VALUES (DEFAULT, 'QME002', 'published', 'ADA 2024');

INSERT INTO question_versions (
    question_id, version, exam, language, difficulty,
    stem, explanation_short, explanation_long,
    is_active, prompt, bibliography
) VALUES (
    CURRVAL( 'questions', 'question_id' ),
    1, 'step1', 'en', 'hard',
    'A 52-year-old woman with a 6-year history of type 2 diabetes mellitus presents for routine follow-up. Current medications: metformin 1000 mg BID, atorvastatin 20 mg daily. HbA1c 3 months ago was 8.2%. Today's point-of-care HbA1c is 8.4%. She reports adherence to medications but admits difficulty with diet and exercise. BMI 31 kg/m², BP 134/82 mmHg. Urine albumin-to-creatinine ratio (UACR) is 42 mg/g (normal <30). eGFR 78 mL/min/1.73m².

Which additional pharmacologic intervention is most strongly supported by current ADA guidelines to reduce both cardiovascular and renal risk in this patient?',
    'Empagliflozin (SGLT2 inhibitor) reduz morte cardiovascular, hospitalização por insuficiência cardíaca e progressão da doença renal crônica; indicado com HbA1c >8% e UACR elevada.',
    'Esta paciente apresenta diabetes tipo 2 com controle glicêmico inadequado (IbA1c 8.4%) e doença renal em estágio inicial (UACR 42 mg/g). De acordo com as diretrizes da ADA 2024, os inibidores do SGLT2 são recomendados para pacientes com doença renal ou albuminúria, independentemente do controle glicêmico, pois reduzem tanto o risco cardiovascular quanto a progressão da doença renal. DPKM4 inibidores e sulfoniluréais não tem benefício renal e cardiovascular comprovado. GLP-1 RA é preferido em pacientes com doença cardiovascular atherosclerótica estabelecida, o que não é o caso.',
    TRUE, 'Which additional pharmacologic intervention is most strongly supported by current ADA guidelines to reduce both cardiovascular and renal risk in this patient?',
    '{"author": "American Diabetes Association", "title": "Standards of Care in Diabetes\u20142024", "journal": "Diabetes Care", "year": 2024, "volume": 47, "supplement": 1, "doi": "10.2337/dc24-S006"}'::jsonn
);

INSERT INTO question_choices (question_version_id, label, choice_text, is_correct, explanation) VALUES
  (CURRVAL('public.question_versions', 'question_version_id'), 'A', 'Add sitagliptin (DP1-4 inhibitor)', FALSE, 'Neutra em risco cardiovascular e renal; não recomendada como segunda linha prioritária nas diretrizes ADA.'),
  (CURRVAL('public.question_versions', 'question_version_id'), 'B', 'Add empagliflozin (SGLT2 inhibitor)', TRUE, 'Reduz morte cardiovascular, hospitalização por insuficiência cardíaca e progressão de doença renal crônica; indicado com HbA1c >8% e elevação de UACR.'),
  (CURRVAL('public.question_versions', 'question_version_id'), 'C', 'Add glimepiride (sulfonylurea)', FALSE, 'Reduz glicose, mas sem benefício cardiovascular/u renal; pode causar hipoglicemia e ganho de peso.'),
  (CURRVAL('public.question_versions', 'question_version_id'), 'D', 'Add liraglutide (GLP-1 RA)', FALSE, 'Benefício cardiovascular comprovado, mas menor proteção renal que SGLT2 i; preferível se houver ASCVD estabelecida.'),
  (CURRVAL('public.question_versions', 'question_version_id'), 'E', 'Add pioglitazone (Trazolidenedione daily)', FALSE, 'Melhora sensibilidade à insulina, mas sem benefício renal e com risco de retenção hídrica e ganho de peso.');

COMMIT;

SELECT 'Outra Questão inserida: ' || q.question_id,
       'Versão: ' || vv.version,
       'Choices: ' || COUNT(qc.choice_id)
FROM questions q
LEFT JOIN question_versions vv ON vv.question_id = q.question_id
LEFT JOIN question_choices qc ON qc.question_version_id = vv.question_version_id
WHERE questions.canonical_code = 'QME002';