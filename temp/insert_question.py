import subprocess, sys, os

DBURL = "postgresql://postgres:mrBKqAIhBLFbHFRQrFefhIdySsxNuzSS@switchyard.proxy.rlwy.net:22270/railway"

STEM = r"""A 58-year-old man with obesity (BMI 34 kg/m²), hypertension, and dyslipidemia presents to the emergency department with substernal chest pressure radiating to the left shoulder for 2 hours. He reports associated diaphoresis and dyspnea. Current medications include lisinopril and atorvastatin. Vital signs: BP 152/88 mmHg, HR 102 bpm, RR 20/min, O² sat 96% on room air. Physical exam reveals an S4 gallop and clear lung fields. ECC shows ST-segment depression in leads V3-V6. Initial high-sensitivity cardiac troponin T is elevated at 180 ng/L (normal <14 ng/L).

Given the patient's obesity, an investigational gene expression panel assessing obesity-linked biomarkers of myocardial injury is sent. Which of the following is most likely to be upregulated in this patient's myocardial tissue as a direct mediator of injury?"""

REFERENCE = "Liao Z, Wang Y, Chen X, et al. Deciphering the clinical implication of an obesity-related gene signature as the novel biomarker for acute myocardial infarction diagnosis. PubMed Central. 2025. PMCID: PMC12748819."

CHOICES = [
    ("A", "Leptin-mediated JAK/STAT signaling pathway", False, "Leptin is elevated in obesity but primarily regulates appetite; its JAK/STAT signaling is not the direct mediator of acute myocardial injury identified in the gene signature."),
    ("B", "Adiponectin-mediated AMPK cardioprotective pathway", False, "Adiponectin is cardioprotective and typically downregulated in obesity; its AMPK pathway would be suppressed, not upregulated."),
    ("C", "FTO (fat mass and obesity-associated) gene demethylation", False, "FTO gene variants are associated with obesity risk via epigenetic mechanisms but do not mediate acute myocardial injury."),
    ("D", "NLRP3 inflammasome activation via free fatty acid-mediated TLR4 signaling", True, "This patient presents with an acute myocardial infarction in the setting of obesity. The investigaational gene signature referenced in the source article (Liao et al., 2025) identifies NLRP3 inflammasome activation as a key mediator of myocardial injury in obese patients. Free fatty acids, elevated in obesity, bind to Toll-like receptor 4 (TLR4), triggering NLRP3 inflammasome assembly and subsequent IL-1β and IL-18 release, which directly exacerbates cardiomyocyte injury and adverse remodeling."),
    ("E", "PPAR-Σ nuclear receptor downregulation", False, "PPAR-Σ is a therapeutic target (thiazolidinediones) but its downregulation is not the primary injury mediator in the obesity-MI axis described in the source.")
]

# Tentar importar psycopg2
try:
    import psycopg2
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2

conn = psycopg2.connect(DBURL, connect_timeout=10)
cur = conn.cursor()

# Inserir Questão
cur.execute("""
	INSERT INTO questions (stem, exam_type, discipline, source_reference, source_pmcid)
	VALUES (%s, 'step1', 'cardiology', %s, 'PMC12748819')
	RETURNING id
""", (STEM, REFERENCE))
question_id = cur.fetchone()[0]
print(f"Question ID: {question_id}")

# Inserir Choices
for label, text, is_correct, explanation in CHOICES:
    cur.execute("""
        INSERT INTO question_choices (question_id, label, text, is_correct, explanation)
        VALUES (%s, %s, %s, %s, %s)
    """, (question_id, label, text, is_correct, explanation))
    print(f"Choice {label} inserted")

conn.commit()
print("COMMIT done")
print(f"URL: https://usmle.helpusbr.com/session/{question_id}")
cur.close()
conn.close()