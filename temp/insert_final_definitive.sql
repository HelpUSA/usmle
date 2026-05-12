-- Corresuo da questÃo órfão da tentativa anterior
DELETE FROM questions WHERE question_id = 'a5b77a90-d846-4582-8a2a-931aabca385d';

-- Insertar questão
-- question_id gerado automaticamente (gen_random_uuid())
WITH _ins_q AS (
    INSERT INTO questions (question_id, canonical_code, status, source)
    VALUES (DEFAULT, 'QME001', 'published', 'PMC12748819')
    RETURNING question_id
)
SELECT _ins_q.question_id INTO _qid;

-- Insertar versão da questÃo
-- question_version_id gerado automaticamente (gen_random_uuid())
WITH _ins_v AS (
    INSERT INTO question_versions (
        question_id, version, exam, language, difficulty,
        stem, explanation_short, explanation_long,
        is_active, prompt, bibliography
    )
    VALUES (
        _qid, 1, 'step1', 'en', 'hard',
        'A 58-year-old man with obesity (BMI 34 kg/m²), hypertension, and dyslipidemia presents to the emergency department with substernal chest pressure radiating to the left shoulder for 2 hours. He reports associated diaphoresis and dyspnea. Current medications include lisinopril and atorvastatin. Vital signs: BP 152/88 mmHg, HR 102 bpm, RR 20/min, O² sat 96% on room air. Physical exam reveals an S4 gallop and clear lung fields. ECG shows ST-segment depression in leads V3-V6. Initial high-sensitivity cardiac troponin T is elevated at 180 ng/L (normal <14 ng/L).

Given the patient's obesity, an investigational gene expression panel assessing obesity-linked biomarkers of myocardial injury is sent. Which of the following is most likely to be upregulated in this patient's myocardial tissue as a direct mediator of injury?',
        'NLRP3 inflammasome activation via free fatty acid-mediated TLR4 signaling is the key mediator of myocardial injury in this obese patient and explains the clinical findings.',
        'This patient presents with an acute myocardial infarction in the setting of obesity. The investigaational gene signature referenced in the source article (Liao et al., 2025) identifies NLRP3 inflammasome activation as a key mediator of myocardial injury in obese patients. Free fatty acids, elevated in obesity, bind to Toll-like receptor 4 (TLR4), triggering NLRP3 inflammasome assembly and subsequent IL-1² and IL-18 release, which directly exacerbates cardiomyocyte injury and adverse remodeling.',
        TRUE,
        'Which of the following is most likely to be upregulated in this patient's myocardial tissue as a direct mediator of injury?',
        '{"source": "Liao Z, Wang Y", "title": "Deciphering the clinical implication of an obesity-related gene signature as the novel biomarker for acute myocardial infarction diagnosis", "pmcid": "PMC12748819", "year": 2025}'::jsonb
    )
    RETURNING question_version_id
)
SELECT _ins_v.question_version_id INTO _vid;

-- Insertar choices
-- choice_id gerado automaticamente (gen_random_uuid())
INSERT INTO question_choices (question_version_id, label, choice_text, is_correct, explanation)
VALUES
  (_vid, 'A', 'Leptin-mediated JAK/STAT signaling pathway', FALSE, 'Leptin is elevated in obesity but primarily regulates appetite; its JAK/STAT signaling is not the direct mediator of acute myocardial injury.'),
  (_vid, 'B', 'Adiponectin-mediated AMPK cardioprotective pathway', FALSE, 'Adiponectin is cardioprotective and typically downregulated in obesity; its AMPK pathway would be suppressed, not upregulated.'),
  (_vid, 'C', 'FTO (fat mass and obesity-associated) gene demethylation', FALSE, 'FTO gene variants are associated with obesity risk via epigenetic mechanisms but do not mediate acute myocardial injury.'),
  (_vid, 'D', 'NLRP3 inflammasome activation via free fatty acid-mediated TLR4 signaling', TRUE, 'This patient presents with an acute myocardial infarction in the setting of obesity. The investigational gene signature referenced in the source article (Liao et al., 2025) identifies NLRP3 inflammasome activation as a key mediator of myocardial injury in obese patients. Free fatty acids, elevated in obesity, bind to Toll-like receptor 4 (TLR4), triggering NLRP3 inflammasome assembly and subsequent IL-1² and IL-18 release, which directly exacerbates cardiomyocyte injury and adverse remodeling.'),
  (_vid, 'E', 'PPAR-Σ nuclear receptor downregulation', FALSE, 'PPAR-Σ is a therapeutic target (thiazolidinediones) but its downregulation is not the primary injury mediator in the obesity-MI axis.');
