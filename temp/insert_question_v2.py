import psycopg2

DBURL = "postgresql://postgres:mrBKqAIhBLFbHFRQrFefhIdySsxNuzSS@switchyard.proxy.rlwy.net:22270/railway"

STEM = r"""A 58-year-old man with obesity (BMI 34 kg/m²), hypertension, and dyslipidemia presents to the emergency department with substernal chest pressure radiating to the left shoulder for 2 hours. He reports associated diaphoresis and dyspnea. Current medications include lisinopril and atorvastatin. Vital signs: BP 152/88 mmHg, HR 102 bpm, RR 20/min, O² sat 96% on room air. Physical exam reveals an S4 gallop and clear lung fields. ECC shows ST-segment depression in leads V3-V6. Initial high-sensitivity cardiac troponin T is elevated at 180 ng/L (normal <14 ng/L).

Given the patient's obesity, an investigational gene expression panel assessing obesity-linked biomarkers of myocardial injury is sent. Which of the following is most likely to be upregulated in this patient's myocardial tissue as a direct mediator of injury?"""

REFERENCE = "Liao Z, Wang Y, Chen X, et al. Deciphering the clinical implication of an obesity-related gene signature as the novel biomarker for acute myocardial infarction diagnosis. PubMed Central. 2025. PMCID: PMC12748819."

CHOICES = [
    ("A", "Leptin-mediated JAK/STAT signaling pathway", False, "Leptin is elevated in obesity but primarily regulates appetite; its JAK/STAT signaling is not the direct mediator of acute myocardial injury identified in the gene signature."),
    ("B", "Adiponectin-mediated AMPK cardioprotective pathway", False, "Adiponectin is cardioprotective and typically downregulated in obesity; its AMPK pathway would be suppressed, not upregulated."),
    ("C", "FTO (fat mass and obesity-associated) gene demethylation", False, "FTO gene variants are associated with obesity risk via epigenetic mechanisms but do not mediate acute myocardial injury."),
    ("D", "NLRP3 inflammasome activation via free fatty acid-mediated TLR4 signaling", True, "This patient presents with an acute myocardial infarction in the setting of obesity. The investigational gene signature referenced in the source article (Liao et al., 2025) identifies NLRP3 inflammasome activation as a key mediator of myocardial injury in obese patients. Free fatty acids, elevated in obesity, bind to Toll-like receptor 4 (TLR4), triggering NLRP3 inflammasome assembly and subsequent IL-1β and IL-18 release, which directly exacerbates cardiomyocyte injury and adverse remodeling."),
    ("E", "PPAR-Σ nuclear receptor downregulation", False, "PPAR-Σ is a therapeutic target (thiazolidinediones) but its downregulation is not the primary injury mediator in the obesity-MI axis described in the source.")
]

conn = psycopg2.connect(DBURL, connect_timeout=10)
cur = conn.cursor()

# Passo 1: Inserir question (registro base)
cur.execute("""
    INSERT INTO questions (canonical_code, status, source)
    VALUES ('Q1000', 'published', 'programmatic')
    RETURNING question_id
""")
question_id = cur.fetchone()[0]
print(f"Question id: {question_id}")

# Passo 2: Inserir question_version (conteúdo completo)
cur.execute("""
    INSERT INTO question_versions (question_id, stem, exam_type, discipline, version_number, source_pmcid, source_reference)
    VALUES (%s, %s, 'step1', 'cardiology', 1, 'PMC12748819', %s)
    RETURNING question_version_id
""", (question_id, STEM, REFERENCE))
version_id = cur.fetchone()[0]
print(f"Version id: {version_id}")

# Passo 3: Inserir choices
for label, text, is_correct, explanation in CHOICES:
    cur.execute("""
        INSERT INTO question_choices (question_version_id, label, choice_text, is_correct, explanation)
        VALUES (%s, %s, %s, %s, %s)
    """, (version_id, label, text, is_correct, explanation))
    print(f"Choice {label} inserted")

conn.commit()
print("COMMIT done")
print(f"New question online: https://usmle.helpusbr.com/session")
cur.close()
conn.close()