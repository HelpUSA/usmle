import psycopg2
def insert_questions():
    data = [
        {
            "code": "QME001",
            "source": "PMC12748819",
            "stem": "A 58-year-old man with obesity (BMI 34 kg/m²), hypertension, and dyslipidemia presents to the emergency department with substernal chest pressure radiating to the left shoulder for 2 hours. He reports associated diaphoresis and dyspnea. Current medications include lisinopril and atorvastatin. Vital signs: BP 152/88, HR 102, RR 20, O² sat 96% on room air. Physical exam reveals an S4 gallop and clear lung fields. ECG shows ST depression in V3-V6. Initial high-sensitivity cardiac troponin T is elevated at 180 ng/L (normal <14 ng/L).\n\nGiven the patient's obesity, an investigational gene expression panel assessing obesity-linked biomarkers of myocardial injury is sent. Which of the following is most likely to be upregulated in this patient's myocardial tissue as a direct mediator of injury?",
            "explanation_short": "NLRP3 inflammasome activation via free fatty acid-mediated TLR4 signaling is the key mediator of myocardial injury in this obese patient and explains the clinical findings.",
            "explanation_long": "This patient presents with an acute myocardial infarction in the setting of obesity. The investigational gene signature referenced in the source article (Liao et al., 2025) identifies NLRP3 inflammasome activation as a key mediator of myocardial injury in obese patients. Free fatty acids, elevated in obesity, bind to Toll-like receptor 4 (TLR4), triggering NLRP3 inflammasome assembly and subsequent IL-1β and IL-18 release, which directly exacerbates cardiomyocyte injury and adverse remodeling.",
            "prompt": "Which of the following is most likely to be upregulated in this patient's myocardial tissue as a direct mediator of injury?",
            "choices": [
                {"label": "A", "text": "Leptin-mediated JAK/STAT signaling pathway", "is_correct": false, "explanation": "Leptin is elevated in obesity but primarily regulates appetite; its JAK/STAT signaling is not the direct mediator of acute myocardial injury."},
                {"label": "B", "text": "Adiponectin-mediated AMPK cardioprotective pathway", "is_correct": false, "explanation": "Adiponectin is cardioprotective and typically downregulated in obesity; its AMPK pathway would be suppressed, not upregulated."},
                {"label": "C", "text": "FTO (fat mass and obesity-associated) gene demethylation", "is_correct": false, "explanation": "FTO gene variants are associated with obesity risk via epigenetic mechanisms but do not mediate acute myocardial injury."},
                {"label": "D", "text": "NLRP3 inflammasome activation via free fatty acid-mediated TLR4 signaling", "is_correct": true, "explanation": "This patient presents with an acute myocardial infarction in the setting of obesity. The investigational gene signature referenced in the source article (Liao et al., 2025) identifies NLRP3 inflammasome activation as a key mediator of myocardial injury in obese patients. Free fatty acids, elevated in obesity, bind to Toll-like receptor 4 (TLR4), triggering NLRP3 inflammasome assembly and subsequent IL-1² and IL-18 release, which directly exacerbates cardiomyocyte injury and adverse remodeling."},
                {"label": "E", "text": "PPAR-Σ nuclear receptor downregulation", "is_correct": false, "explanation": "PPAR-Σ is a therapeutic target (thiazolidinediones) but its downregulation is not the primary injury mediator in the obesity-MI axis."}
            ],
            "bibliography": {
                "source": "Liao Z, Wang Y",
                "title": "Deciphering the clinical implication of an obesity-related gene signature as the novel biomarker for acute myocardial infarction diagnosis",
                "pmcid": "PMC12748819",
                "year": 2025
            }
        },
        {
            "code": "QME002",
            "source": "ADA 2024",
            "stem": "A 52-year-old woman with a 6-year history of type 2 diabetes mellitus presents for routine follow-up. Current medications: metformin 1000 mg BID, atorvastatin 20 mg daily. HbA1c 3 months ago was 8.2%. Today's point-of-care HbA1c is 8.4%. She reports adherence to medications but admits difficulty with diet and exercise. BMI 31 kg/m², BP 134/82. Urine albumin-to-creatinine ratio (UACR) is 42 mg/g (normal <30). eGFR 78 mL/min/1.73m²,n\n\nWhich additional pharmacologic intervention is most strongly supported by current ADA guidelines to reduce both cardiovascular and renal risk in this patient?",
            "explanation_short": "Empagliflozin (SGLT2 inhibitor) reduz morte cardiovascular, hospitalização por insuficiência cardíaca e progressão da doença renal crônica; indicado com HbA1c >8% e elevação de UACR.",
            "explanation_long": "Esta paciente apresenta diabetes tipo 2 com controle glicêmico inadequado (IbA1c 8.4%) e doença renal em estágio inicial (UACR 42 mg/g). De acordo com as diretrizes da ADA 2024, os inibidores do SGLT2 são recomendados para pacientes com doença renal ou albuminúria, independentemente do controle glicêmico, pois reduzem tanto o risco cardiovascular quanto a progressão da doença renal. DPI-4 inibidores e sulfoniluréias não tem benefício renal e cardiovascular comprovado. GLP-1 RA é preferido em pacientes com doença cardiovascular atherosclerótica estabelecida, o que não é o caso.",
            "prompt": "Which additional pharmacologic intervention is most strongly supported by current ADA guidelines to reduce both cardiovascular and renal risk in this patient?",
            "choices": [
                {"label": "A", "text": "Add sitagliptin (DPI-4 inhibitor)", "is_correct": false, "explanation": "Neutra em risco cardiovascular e renal; não recomendada como segunda linha prioritária nas diretrizes ADA."},
                {"label": "B", "text": "Add empagliflozin (SGLT2 inhibitor)", "is_correct": true, "explanation": "Reduz morte cardiovascular, hospitalização por insuficiência cardíaca e progressão de doença renal crônica; indicado com HbA1c >8% e elevação de UACR."},
                {"label": "C", "text": "Add glimepiride (sulfonylurea)", "is_correct": false, "explanation": "Reduz glicose, mas sem benefício cardiovascular/u renal; pode causar hipoglicemia e ganho de peso."},
                {"label": "D", "text": "Add liraglutide (GLP-1 RA)", "is_correct": false, "explanation": "Benefício cardiovascular comprovado, mas menor proteção renal que SGLT2 i; preferivel se houver ASCVD estabelecida."},
                {"label": "E", "text": "Add pioglitazone (Trazolidenedione daily)", "is_correct": false, "explanation": "Melhora sensibilidade à insulina, mas sem benefício renal e com risco de retenção hídrica e ganho de peso."}
            ],
            "bibliography": {
                "author": "American Diabetes Association",
                "title": "Standards of Care in Diabetes\u20142024",
                "journal": "Diabetes Care",
                "year": 2024,
                "volume": 47,
                "supplement": 1
            }
        }
    ]
    
    try:
        conn = psycopg2.connect(
            host="switchyard.proxy.rlwy.net",
            port="22270",
            user="postgres",
            password="mrBKqAIhBLFbHFRQrFefhIdySsxNuzSS",
            db="railway"
        )
        cur = conn.cursor()
        
        for group in data:
            # Insert question
            cur.execute("INSERT INTO questions (canonical_code, status, source) VALUES (%s, 'published', %s) RETURNING question_id", (group["code"], group["source"]))
            question_id = cur.fetchone()[0]
            
            # Insert version
            cur.execute("INSERT INTO question_versions (question_id, version, exam, language, difficulty, stem, explanation_short, explanation_long, is_active, prompt, bibliography) VALUES (%s, 1, 'step1', 'en', 'hard', %s, %s, %s, TRUE, %s, %s::jsonb) RETURNING question_version_id", (question_id, group["stem"], group["explanation_short"], group["explanation_long"], group["prompt"], group["bibliography"]))
            version_id = cur.fetchone()[0]
            
            # Insert choices
            for choice in group["choices"]:
                cur.execute("INSERT INTO question_choices (question_version_id, label, choice_text, is_correct, explanation) VALUES (%s, %s, %s, %s, %s)", (version_id, choice["label"], choice["text"], choice["is_correct"], choice["explanation"]))
            
            print(f"Questão {group['code']} inserida com sucesso. ID: {question_id}")
        
        conn.commit()
        print("Todas as questões foram inseridas com sucesso!")
        
    except Exception as e:
        print(f"ERRO: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    insert_questions()