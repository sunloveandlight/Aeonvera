export type ResourceCategorySlug =
  | "featured-articles"
  | "beginners-guides"
  | "longevity-library"
  | "biomarker-database"
  | "disease-prevention"
  | "nutrition"
  | "exercise"
  | "sleep"
  | "ai-medicine"
  | "research-reviews"
  | "news";

export type EvidenceLevel = "Strong" | "Moderate" | "Emerging";

export type ResourceCategory = {
  slug: ResourceCategorySlug;
  title: string;
  description: string;
};

export type BiomarkerEntry = {
  slug: string;
  name: string;
  category: string;
  whyItMatters: string;
  signals: string[];
  summary?: string;
  measuredBy?: string;
  usefulFor?: string[];
  interpretation?: Array<{
    label: string;
    body: string;
  }>;
  improveLevers?: string[];
  cautions?: string[];
  references?: Array<{
    label: string;
    url: string;
  }>;
  relatedSlugs?: string[];
};

export type Strategy = {
  title: string;
  evidence: EvidenceLevel;
  category: ResourceCategorySlug;
  body: string;
};

export type ResourceArticle = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: ResourceCategorySlug;
  categories: ResourceCategorySlug[];
  publishedAt: string;
  updatedAt: string;
  readingTime: string;
  author: string;
  reviewedBy?: string;
  heroImage: string;
  heroAlt: string;
  summary: string[];
  takeaways: string[];
  strategies: Strategy[];
  evidenceIntroTitle?: string;
  evidenceIntroBody?: string;
  strategySectionTitle?: string;
  biomarkerSectionTitle?: string;
  biomarkerSectionBody?: string[];
  biomarkerLinks?: string[];
  references: Array<{
    label: string;
    url: string;
  }>;
};

export const resourceCategories: ResourceCategory[] = [
  {
    slug: "featured-articles",
    title: "Featured Articles",
    description: "Flagship explainers for the core ideas behind longevity intelligence.",
  },
  {
    slug: "beginners-guides",
    title: "Beginner's Guides",
    description: "Clear first principles for people starting their healthspan work.",
  },
  {
    slug: "longevity-library",
    title: "Longevity Library",
    description: "Evergreen reference material across biomarkers, behavior, and prevention.",
  },
  {
    slug: "biomarker-database",
    title: "Biomarker Database",
    description: "Readable explanations of the signals that shape metabolic and biological age.",
  },
  {
    slug: "disease-prevention",
    title: "Disease Prevention",
    description: "Risk reduction, early signals, and practical prevention habits.",
  },
  {
    slug: "nutrition",
    title: "Nutrition",
    description: "Food patterns, metabolic health, and sustainable dietary systems.",
  },
  {
    slug: "exercise",
    title: "Exercise",
    description: "Cardiorespiratory fitness, strength, mobility, and recovery.",
  },
  {
    slug: "sleep",
    title: "Sleep",
    description: "Sleep duration, quality, timing, and recovery physiology.",
  },
  {
    slug: "ai-medicine",
    title: "AI & Medicine",
    description: "How clinical AI, personal data, and decision support are changing care.",
  },
  {
    slug: "research-reviews",
    title: "Research Reviews",
    description: "Plain-language reviews of important longevity and prevention studies.",
  },
  {
    slug: "news",
    title: "News",
    description: "Product notes, research updates, and changes in the longevity field.",
  },
];

export const biomarkerEntries: BiomarkerEntry[] = [
  {
    slug: "apob",
    name: "ApoB",
    category: "Cardiometabolic risk",
    whyItMatters:
      "ApoB approximates the number of atherogenic lipoprotein particles that can enter artery walls.",
    signals: ["LDL particle burden", "ASCVD risk context", "Nutrition and medication response"],
    summary:
      "Apolipoprotein B is a protein carried by the lipoprotein particles most involved in atherosclerosis. Because each atherogenic particle generally carries one ApoB molecule, ApoB can help estimate particle number rather than only cholesterol mass.",
    measuredBy: "Blood test, usually ordered alongside or after a standard lipid panel.",
    usefulFor: [
      "Understanding cardiovascular risk when LDL-C and triglycerides do not tell the whole story.",
      "Clarifying risk in people with insulin resistance, metabolic syndrome, obesity, diabetes, or family history.",
      "Tracking response to nutrition, weight change, lipid-lowering therapy, and other clinician-guided interventions.",
    ],
    interpretation: [
      {
        label: "Why particle number matters",
        body:
          "LDL-C measures the cholesterol carried inside LDL particles. ApoB gets closer to the number of atherogenic particles that can deposit cholesterol in artery walls.",
      },
      {
        label: "Discordance is the reason to care",
        body:
          "Some people have LDL-C that looks acceptable while ApoB remains high, especially when triglycerides, insulin resistance, or metabolic risk are present.",
      },
      {
        label: "Context changes the target",
        body:
          "ApoB goals depend on overall cardiovascular risk, prior events, family history, blood pressure, glucose status, and clinician judgment.",
      },
    ],
    improveLevers: [
      "Mediterranean-style eating pattern with fewer refined carbohydrates and ultra-processed foods.",
      "Weight loss when excess adiposity is present.",
      "Regular aerobic and resistance training.",
      "Clinician-guided lipid-lowering medication when risk is high enough.",
    ],
    cautions: [
      "ApoB is not a diagnosis by itself.",
      "Do not start or stop lipid medication based only on a single marker without clinician guidance.",
      "Interpret alongside LDL-C, non-HDL-C, triglycerides, blood pressure, glucose, family history, and risk calculators.",
    ],
    references: [
      {
        label: "American Heart Association: ApoB and heart disease risk",
        url: "https://www.heart.org/en/health-topics/cholesterol/how-to-get-your-cholesterol-tested/apolipoprotein-b",
      },
      {
        label: "Apolipoprotein B in cardiovascular risk assessment",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10462411/",
      },
      {
        label: "American College of Cardiology: excess ApoB and cardiovascular risk",
        url: "https://www.acc.org/latest-in-cardiology/journal-scans/2024/06/06/15/31/excess-apolipoprotein-b",
      },
    ],
    relatedSlugs: ["ldl-c", "hdl-c", "triglycerides"],
  },
  {
    slug: "hba1c",
    name: "HbA1c",
    category: "Glucose regulation",
    whyItMatters:
      "HbA1c reflects average blood glucose exposure over roughly two to three months.",
    signals: ["Insulin resistance context", "Diabetes risk", "Lifestyle response"],
    summary:
      "HbA1c measures the percentage of hemoglobin with glucose attached. It is commonly used to screen for prediabetes and diabetes and to monitor long-term glucose control.",
    measuredBy: "Blood test from a lab or clinical point-of-care setting.",
    usefulFor: [
      "Estimating average glucose exposure over the past two to three months.",
      "Screening for prediabetes or diabetes when clinically appropriate.",
      "Tracking response to nutrition, activity, medication, sleep, and weight changes.",
    ],
    interpretation: [
      {
        label: "Trend is more useful than one reading",
        body:
          "A single HbA1c result is a snapshot. Repeated values show whether glucose regulation is improving, stable, or drifting.",
      },
      {
        label: "It is average exposure, not variability",
        body:
          "Two people can have the same HbA1c with different glucose spikes and lows. Fasting glucose, CGM, or oral glucose testing may add context.",
      },
      {
        label: "Some conditions can distort it",
        body:
          "Pregnancy, blood loss, transfusion, anemia, kidney disease, and hemoglobin variants can make HbA1c less reliable for some people.",
      },
    ],
    improveLevers: [
      "Consistent physical activity, including post-meal walking and resistance training.",
      "Higher-fiber meals with adequate protein and fewer refined carbohydrates.",
      "Improved sleep regularity and treatment of sleep apnea when present.",
      "Clinician-guided medication when lifestyle alone is not enough.",
    ],
    cautions: [
      "Do not use HbA1c alone to self-diagnose diabetes.",
      "Ask a clinician whether alternate tests are needed if results do not match symptoms or home glucose readings.",
      "Very low values are not automatically better if they reflect hypoglycemia or another medical issue.",
    ],
    references: [
      {
        label: "CDC: A1C test for diabetes and prediabetes",
        url: "https://www.cdc.gov/diabetes/diabetes-testing/prediabetes-a1c-test.html",
      },
      {
        label: "MedlinePlus: Hemoglobin A1C test",
        url: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/",
      },
      {
        label: "American Diabetes Association: understanding A1C",
        url: "https://diabetes.org/about-diabetes/a1c",
      },
    ],
    relatedSlugs: ["fasting-glucose", "fasting-insulin", "triglycerides"],
  },
  {
    slug: "ldl-c",
    name: "LDL-C",
    category: "Cardiometabolic risk",
    whyItMatters:
      "LDL-C estimates the cholesterol carried by low-density lipoprotein particles, a central marker in cardiovascular risk assessment.",
    signals: ["Atherosclerotic risk", "Lipid response", "Medication context"],
    summary:
      "LDL cholesterol is often called low-density lipoprotein cholesterol. It estimates the amount of cholesterol carried in LDL particles, which can contribute to plaque buildup in arteries when risk is elevated over time.",
    measuredBy: "Blood lipid panel, often fasting or nonfasting depending on clinician preference and local practice.",
    usefulFor: [
      "Initial cardiovascular risk screening and follow-up.",
      "Tracking response to dietary changes, weight change, exercise, and lipid-lowering therapy.",
      "Supporting discussions about ApoB, non-HDL-C, triglycerides, and overall ASCVD risk.",
    ],
    interpretation: [
      {
        label: "LDL-C is important but incomplete",
        body:
          "LDL-C is a core risk marker, but it measures cholesterol mass rather than particle number. ApoB can add context when risk markers disagree.",
      },
      {
        label: "Risk determines the target",
        body:
          "People with prior cardiovascular disease, diabetes, high blood pressure, smoking history, or strong family history may need more aggressive targets.",
      },
      {
        label: "Look at the full lipid pattern",
        body:
          "LDL-C should be interpreted with HDL-C, triglycerides, non-HDL-C, ApoB, blood pressure, glucose status, and family history.",
      },
    ],
    improveLevers: [
      "Reduce saturated fat and replace it with unsaturated fats where appropriate.",
      "Increase soluble fiber from foods such as oats, beans, lentils, fruit, and psyllium.",
      "Maintain regular exercise and improve body composition when needed.",
      "Use clinician-guided medication when risk is high or lifestyle change is not enough.",
    ],
    cautions: [
      "Do not interpret LDL-C as the only cardiovascular risk factor.",
      "Very low or very high values should be discussed with a clinician in the context of personal risk.",
      "Medication decisions should be individualized rather than based on a single lab value.",
    ],
    references: [
      {
        label: "CDC: LDL and HDL cholesterol",
        url: "https://www.cdc.gov/cholesterol/about/ldl-and-hdl-cholesterol-and-triglycerides.html",
      },
      {
        label: "MedlinePlus: cholesterol levels",
        url: "https://medlineplus.gov/cholesterollevelswhatyouneedtoknow.html",
      },
      {
        label: "NHLBI: blood cholesterol",
        url: "https://www.nhlbi.nih.gov/health/blood-cholesterol",
      },
    ],
    relatedSlugs: ["apob", "hdl-c", "triglycerides"],
  },
  {
    slug: "hdl-c",
    name: "HDL-C",
    category: "Cardiometabolic risk",
    whyItMatters:
      "HDL-C estimates cholesterol carried by high-density lipoproteins, but higher is not automatically protective in every context.",
    signals: ["Lipid pattern", "Metabolic health context", "Exercise and lifestyle response"],
    summary:
      "HDL cholesterol is part of a standard lipid panel. It has historically been called good cholesterol, but modern interpretation is more nuanced: HDL-C is a risk marker, not a simple treatment target by itself.",
    measuredBy: "Blood lipid panel.",
    usefulFor: [
      "Understanding the broader lipid pattern alongside LDL-C, triglycerides, non-HDL-C, and ApoB.",
      "Adding metabolic context when HDL-C is low and triglycerides are high.",
      "Tracking broad lifestyle response, especially exercise, weight change, smoking cessation, and dietary quality.",
    ],
    interpretation: [
      {
        label: "Low HDL-C can signal metabolic risk",
        body:
          "Low HDL-C often appears with insulin resistance, high triglycerides, abdominal adiposity, smoking, and low physical activity.",
      },
      {
        label: "Raising HDL-C is not the main goal",
        body:
          "Interventions that simply raise HDL-C have not always reduced cardiovascular events. The broader risk pattern matters more.",
      },
      {
        label: "Very high is not always better",
        body:
          "Extremely high HDL-C can be complex and should not be assumed to cancel out ApoB, LDL-C, blood pressure, glucose, or smoking risk.",
      },
    ],
    improveLevers: [
      "Regular aerobic activity and resistance training.",
      "Smoking cessation.",
      "Improved body composition and insulin sensitivity.",
      "Mediterranean-style dietary pattern with unsaturated fats replacing refined carbohydrates and excess saturated fat.",
    ],
    cautions: [
      "Do not use HDL-C to excuse high ApoB or LDL-C.",
      "HDL-C is best interpreted as part of a lipid and metabolic pattern.",
      "Ask a clinician about unusual values or strong family history.",
    ],
    references: [
      {
        label: "CDC: LDL, HDL, and triglycerides",
        url: "https://www.cdc.gov/cholesterol/about/ldl-and-hdl-cholesterol-and-triglycerides.html",
      },
      {
        label: "MedlinePlus: cholesterol levels",
        url: "https://medlineplus.gov/cholesterollevelswhatyouneedtoknow.html",
      },
      {
        label: "Harvard Health: HDL cholesterol nuance",
        url: "https://www.health.harvard.edu/heart-health/hdl-the-good-but-complex-cholesterol",
      },
    ],
    relatedSlugs: ["ldl-c", "triglycerides", "apob"],
  },
  {
    slug: "triglycerides",
    name: "Triglycerides",
    category: "Metabolic health",
    whyItMatters:
      "Triglycerides reflect circulating blood fats and can signal insulin resistance, dietary patterns, alcohol exposure, and cardiovascular risk context.",
    signals: ["Insulin resistance context", "Lipid pattern", "Nutrition response"],
    summary:
      "Triglycerides are a type of fat in the blood. They rise after meals and can remain elevated with insulin resistance, excess alcohol, certain medications, hypothyroidism, kidney disease, or genetic lipid disorders.",
    measuredBy: "Blood lipid panel. Fasting measurement can be useful when values are high or when clinician interpretation requires it.",
    usefulFor: [
      "Understanding metabolic health alongside HDL-C, ApoB, LDL-C, waist circumference, glucose, and HbA1c.",
      "Tracking response to reduced alcohol intake, improved carbohydrate quality, weight change, and exercise.",
      "Identifying very high values that may require urgent clinician-guided treatment because of pancreatitis risk.",
    ],
    interpretation: [
      {
        label: "High values often travel with insulin resistance",
        body:
          "High triglycerides plus low HDL-C can be a useful pattern for spotting cardiometabolic stress.",
      },
      {
        label: "Fasting status matters",
        body:
          "Triglycerides rise after meals. Nonfasting results can still be useful, but high values may need a fasting repeat.",
      },
      {
        label: "Very high values are different",
        body:
          "Severely elevated triglycerides need prompt medical attention because they can increase pancreatitis risk.",
      },
    ],
    improveLevers: [
      "Reduce alcohol exposure, especially when triglycerides are elevated.",
      "Improve carbohydrate quality and reduce added sugars/refined grains.",
      "Weight loss when excess adiposity is present.",
      "Regular aerobic exercise and clinician-guided medication when values are high enough.",
    ],
    cautions: [
      "Do not ignore very high triglycerides.",
      "Interpret with fasting status, medications, thyroid/kidney context, and glucose markers.",
      "Supplements or medication should be discussed with a clinician, especially at high levels.",
    ],
    references: [
      {
        label: "CDC: triglycerides",
        url: "https://www.cdc.gov/cholesterol/about/ldl-and-hdl-cholesterol-and-triglycerides.html",
      },
      {
        label: "MedlinePlus: triglycerides test",
        url: "https://medlineplus.gov/lab-tests/triglycerides-test/",
      },
      {
        label: "NHLBI: blood triglycerides",
        url: "https://www.nhlbi.nih.gov/health/high-blood-triglycerides",
      },
    ],
    relatedSlugs: ["hdl-c", "ldl-c", "fasting-insulin", "hba1c"],
  },
  {
    slug: "fasting-glucose",
    name: "Fasting glucose",
    category: "Glucose regulation",
    whyItMatters:
      "Fasting glucose shows blood sugar after an overnight fast and is a core screening signal for prediabetes, diabetes, and metabolic drift.",
    signals: ["Glucose baseline", "Prediabetes screening", "Lifestyle response"],
    summary:
      "Fasting glucose measures blood sugar after not eating for a defined period, often overnight. It is widely used to screen for diabetes and prediabetes and to monitor glucose regulation.",
    measuredBy: "Blood glucose test after fasting, usually for at least eight hours when directed.",
    usefulFor: [
      "Screening for prediabetes and diabetes with clinician interpretation.",
      "Tracking lifestyle and medication response over time.",
      "Adding context to HbA1c, fasting insulin, triglycerides, waist circumference, and sleep quality.",
    ],
    interpretation: [
      {
        label: "It is a morning snapshot",
        body:
          "Fasting glucose can be affected by sleep, stress, illness, medications, exercise, and the dawn phenomenon.",
      },
      {
        label: "Pair it with HbA1c",
        body:
          "HbA1c estimates longer-term exposure, while fasting glucose shows a specific baseline moment. Together they are more useful than either alone.",
      },
      {
        label: "Normal does not rule out spikes",
        body:
          "Some people have normal fasting glucose but high post-meal glucose. A clinician may use additional testing when risk is suspected.",
      },
    ],
    improveLevers: [
      "Resistance training and regular aerobic activity.",
      "Weight loss when insulin resistance or excess adiposity is present.",
      "Higher-fiber meals with fewer refined carbohydrates and added sugars.",
      "Sleep consistency and treatment of sleep apnea when present.",
    ],
    cautions: [
      "Do not self-diagnose diabetes from one result.",
      "Symptoms such as excessive thirst, frequent urination, unexplained weight loss, or very high readings deserve prompt medical care.",
      "Medication changes require clinician guidance.",
    ],
    references: [
      {
        label: "MedlinePlus: glucose blood test",
        url: "https://medlineplus.gov/lab-tests/glucose-in-blood-test/",
      },
      {
        label: "CDC: diabetes testing",
        url: "https://www.cdc.gov/diabetes/diabetes-testing/index.html",
      },
      {
        label: "American Diabetes Association: diagnosis",
        url: "https://diabetes.org/about-diabetes/diagnosis",
      },
    ],
    relatedSlugs: ["hba1c", "fasting-insulin", "triglycerides"],
  },
  {
    slug: "fasting-insulin",
    name: "Fasting insulin",
    category: "Glucose regulation",
    whyItMatters:
      "Fasting insulin can add early context about insulin resistance before glucose markers become clearly abnormal.",
    signals: ["Insulin resistance context", "Metabolic compensation", "Nutrition response"],
    summary:
      "Insulin is a hormone that helps move glucose from the bloodstream into cells. Fasting insulin is not always part of routine screening, but it can help contextualize insulin resistance when interpreted carefully.",
    measuredBy: "Blood insulin test after fasting when ordered by a clinician.",
    usefulFor: [
      "Adding context when fasting glucose or HbA1c look normal but metabolic risk is suspected.",
      "Tracking insulin resistance patterns alongside triglycerides, HDL-C, waist circumference, blood pressure, and glucose.",
      "Understanding whether the body may be compensating with higher insulin before glucose rises.",
    ],
    interpretation: [
      {
        label: "It is context, not a universal target",
        body:
          "Fasting insulin ranges vary by assay and clinical setting. It is most useful when paired with other metabolic markers.",
      },
      {
        label: "High insulin can precede high glucose",
        body:
          "In early insulin resistance, the pancreas may produce more insulin to keep glucose normal. That compensation can hide risk if glucose is viewed alone.",
      },
      {
        label: "Patterns matter",
        body:
          "Fasting insulin, triglycerides, HDL-C, waist circumference, blood pressure, and HbA1c can form a stronger metabolic picture together.",
      },
    ],
    improveLevers: [
      "Regular resistance training and aerobic activity.",
      "Weight loss when excess adiposity is present.",
      "Higher protein and fiber, fewer refined carbohydrates, and better meal timing when appropriate.",
      "Sleep improvement and clinician-guided treatment for metabolic disease.",
    ],
    cautions: [
      "Fasting insulin is not a standalone diagnostic test for diabetes.",
      "Assays and reference intervals vary, so interpretation should be clinician-guided.",
      "People using insulin or glucose-lowering medication need medical supervision for changes in diet, exercise, or medication.",
    ],
    references: [
      {
        label: "MedlinePlus: insulin in blood test",
        url: "https://medlineplus.gov/lab-tests/insulin-in-blood/",
      },
      {
        label: "Cleveland Clinic: insulin resistance",
        url: "https://my.clevelandclinic.org/health/diseases/22206-insulin-resistance",
      },
      {
        label: "Endotext: insulin resistance",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK278954/",
      },
    ],
    relatedSlugs: ["fasting-glucose", "hba1c", "triglycerides"],
  },
  {
    slug: "hs-crp",
    name: "hs-CRP",
    category: "Inflammation",
    whyItMatters:
      "High-sensitivity CRP can indicate systemic inflammation when interpreted with clinical context.",
    signals: ["Inflammatory burden", "Recovery strain", "Cardiometabolic context"],
    summary:
      "C-reactive protein is made by the liver and rises with inflammation. The high-sensitivity version can detect lower levels used in cardiovascular risk context, but it does not identify the cause of inflammation.",
    measuredBy: "Blood test. hs-CRP is a more sensitive assay than standard CRP.",
    usefulFor: [
      "Adding inflammation context to cardiovascular risk assessment.",
      "Noticing persistent inflammatory burden that deserves clinical follow-up.",
      "Separating chronic trends from acute illness, injury, or infection.",
    ],
    interpretation: [
      {
        label: "It is nonspecific",
        body:
          "hs-CRP can rise from infection, injury, autoimmune activity, intense training, poor sleep, obesity, smoking, and many other causes.",
      },
      {
        label: "Repeat testing matters",
        body:
          "Because acute illness can spike CRP, clinicians often repeat an elevated result when someone is well before treating it as a chronic signal.",
      },
      {
        label: "Use it with risk context",
        body:
          "hs-CRP can support cardiovascular risk discussion, but it should not replace blood pressure, lipids, glucose markers, family history, or symptoms.",
      },
    ],
    improveLevers: [
      "Treat acute or chronic inflammatory conditions with clinician guidance.",
      "Stop smoking and reduce excess alcohol exposure.",
      "Improve sleep, body composition, cardiorespiratory fitness, and dietary quality.",
      "Avoid testing immediately after infection, injury, or unusually hard training unless directed.",
    ],
    cautions: [
      "hs-CRP does not show where inflammation is coming from.",
      "A high value should be interpreted with symptoms and medical history.",
      "Do not use hs-CRP alone to decide whether to take anti-inflammatory medication.",
    ],
    references: [
      {
        label: "MedlinePlus: C-reactive protein test",
        url: "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/",
      },
      {
        label: "MedlinePlus Medical Encyclopedia: CRP and hs-CRP",
        url: "https://medlineplus.gov/ency/article/003356.htm",
      },
      {
        label: "Kaiser Permanente: high-sensitivity CRP test",
        url: "https://healthy.kaiserpermanente.org/health-wellness/health-encyclopedia/he.high-sensitivity-c-reactive-protein-hs-crp-test.abq4481",
      },
    ],
  },
  {
    slug: "vo2-max",
    name: "VO2 max",
    category: "Cardiorespiratory fitness",
    whyItMatters:
      "VO2 max estimates the body's capacity to use oxygen during intense exercise.",
    signals: ["Aerobic capacity", "Training adaptation", "Functional reserve"],
    summary:
      "VO2 max estimates maximal oxygen uptake during intense exercise. It is one of the clearest markers of cardiorespiratory fitness and functional reserve.",
    measuredBy:
      "Best measured with cardiopulmonary exercise testing; commonly estimated by wearables, fitness tests, or submaximal protocols.",
    usefulFor: [
      "Tracking aerobic fitness and training response.",
      "Understanding functional reserve across aging, illness, and recovery.",
      "Guiding endurance training zones when measurement quality is reliable.",
    ],
    interpretation: [
      {
        label: "Higher usually means better reserve",
        body:
          "Higher cardiorespiratory fitness is consistently associated with better health outcomes, though individual interpretation depends on age, sex, health status, and test quality.",
      },
      {
        label: "Wearables estimate, labs measure",
        body:
          "Wearable VO2 max can be useful for trend tracking, but clinical cardiopulmonary exercise testing is more precise.",
      },
      {
        label: "Trainability is the opportunity",
        body:
          "Aerobic base training, intervals, weight management, and consistency can improve VO2 max for many people.",
      },
    ],
    improveLevers: [
      "Regular moderate-intensity aerobic training.",
      "Periodic higher-intensity intervals when medically appropriate.",
      "Resistance training to support movement economy and muscle function.",
      "Progressive training load with enough sleep and recovery.",
    ],
    cautions: [
      "People with chest pain, unexplained shortness of breath, fainting, or known heart disease should ask a clinician before intense testing or training.",
      "Wearable estimates can shift because of device algorithms, terrain, heat, fatigue, and sensor quality.",
      "Do not compare your number directly to someone with a different age, sex, sport background, or health context.",
    ],
    references: [
      {
        label: "American Heart Association: target heart rates and exercise intensity",
        url: "https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/target-heart-rates",
      },
      {
        label: "AHA journal: cardiorespiratory fitness reference standards",
        url: "https://www.ahajournals.org/doi/pdf/10.1161/JAHA.121.022336",
      },
      {
        label: "VO2 max in clinical cardiology review",
        url: "https://link.springer.com/content/pdf/10.1007/s11886-025-02289-6.pdf",
      },
    ],
  },
  {
    slug: "resting-hr",
    name: "Resting heart rate",
    category: "Recovery",
    whyItMatters:
      "Resting heart rate can reflect fitness, stress, recovery, illness, and medication effects.",
    signals: ["Recovery trend", "Fitness baseline", "Acute stress signal"],
  },
  {
    slug: "hrv",
    name: "HRV",
    category: "Autonomic balance",
    whyItMatters:
      "Heart-rate variability can help track recovery and autonomic strain, especially as a personal trend.",
    signals: ["Sleep recovery", "Stress response", "Training readiness"],
    summary:
      "Heart-rate variability measures variation in timing between heartbeats. It is influenced by the autonomic nervous system and is most useful as a personal recovery trend rather than a standalone diagnosis.",
    measuredBy:
      "ECG is the clinical reference; wearables and apps estimate HRV with optical or electrical sensors.",
    usefulFor: [
      "Tracking recovery, sleep strain, stress load, and training readiness.",
      "Seeing whether habits such as sleep consistency, alcohol reduction, or training changes affect physiology.",
      "Noticing unusual shifts that may reflect illness, overload, travel, or stress.",
    ],
    interpretation: [
      {
        label: "Personal baseline beats population comparison",
        body:
          "HRV varies widely by age, genetics, fitness, measurement method, and timing. Your own baseline is usually more useful than a generic range.",
      },
      {
        label: "Lower is not always a crisis",
        body:
          "Hard training, alcohol, poor sleep, illness, dehydration, and psychological stress can temporarily lower HRV.",
      },
      {
        label: "Higher is not always better",
        body:
          "Very unusual HRV changes can occur with arrhythmias or measurement artifacts, so symptoms or irregular readings deserve clinical attention.",
      },
    ],
    improveLevers: [
      "Consistent sleep and wake schedule.",
      "Appropriate training load with recovery days.",
      "Lower alcohol exposure and better hydration.",
      "Stress-management practices, social support, and treatment of underlying conditions.",
    ],
    cautions: [
      "HRV is not a diagnosis.",
      "Wearable HRV should be interpreted as a trend, not a precise medical measurement.",
      "Seek medical guidance for palpitations, fainting, chest pain, unexplained shortness of breath, or concerning heart-rate irregularity.",
    ],
    references: [
      {
        label: "Cleveland Clinic: heart rate variability",
        url: "https://my.clevelandclinic.org/health/symptoms/21773-heart-rate-variability-hrv",
      },
      {
        label: "Wearable HRV monitoring review",
        url: "https://europepmc.org/article/PMC/PMC10742885",
      },
      {
        label: "HRV and training adaptation review",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12787763/",
      },
    ],
  },
];

const strategies: Strategy[] = [
  {
    title: "Make cardiorespiratory fitness a primary vital sign",
    evidence: "Strong",
    category: "exercise",
    body:
      "Build a weekly aerobic base with moderate-intensity work and periodic higher-intensity training when appropriate. Better fitness is consistently associated with lower all-cause and cardiovascular mortality risk.",
  },
  {
    title: "Strength train at least two days per week",
    evidence: "Strong",
    category: "exercise",
    body:
      "Preserving muscle and strength supports glucose control, mobility, balance, and independence. Pair compound movement patterns with progressive loading and adequate recovery.",
  },
  {
    title: "Reduce long sedentary blocks",
    evidence: "Moderate",
    category: "exercise",
    body:
      "Even active people can accumulate metabolic risk from uninterrupted sitting. Short walking breaks, standing transitions, and post-meal movement can improve the daily signal.",
  },
  {
    title: "Use a Mediterranean-style dietary pattern as the default",
    evidence: "Strong",
    category: "nutrition",
    body:
      "A pattern rich in vegetables, legumes, whole grains, nuts, olive oil, fish, and minimally processed foods has strong cardiovascular prevention evidence and is easier to sustain than rigid short-term diets.",
  },
  {
    title: "Prioritize protein quality and distribution",
    evidence: "Moderate",
    category: "nutrition",
    body:
      "Protein supports lean mass, especially when combined with resistance training. Distribution across meals can help older adults and active people meet recovery needs.",
  },
  {
    title: "Make fiber a daily target",
    evidence: "Strong",
    category: "nutrition",
    body:
      "Fiber-rich foods support LDL cholesterol, glucose control, gut health, satiety, and cardiometabolic risk reduction. Beans, lentils, berries, oats, vegetables, nuts, and seeds are practical anchors.",
  },
  {
    title: "Treat ultra-processed food as a dose to manage",
    evidence: "Moderate",
    category: "nutrition",
    body:
      "Ultra-processed foods can make excess intake easier and may worsen cardiometabolic patterns. The goal is not purity; it is making minimally processed foods the default environment.",
  },
  {
    title: "Sleep seven or more hours when possible",
    evidence: "Strong",
    category: "sleep",
    body:
      "Most adults need at least seven hours. Short sleep is associated with worse metabolic, cardiovascular, immune, mood, and cognitive outcomes.",
  },
  {
    title: "Stabilize sleep timing",
    evidence: "Moderate",
    category: "sleep",
    body:
      "Regular sleep and wake times help circadian alignment. Consistency can improve energy, appetite regulation, and training recovery before any advanced intervention is needed.",
  },
  {
    title: "Screen for sleep apnea when signals point that way",
    evidence: "Strong",
    category: "sleep",
    body:
      "Snoring, witnessed breathing pauses, morning headaches, excessive daytime sleepiness, hypertension, or low overnight oxygen should trigger a clinician conversation.",
  },
  {
    title: "Do not smoke or vape nicotine",
    evidence: "Strong",
    category: "disease-prevention",
    body:
      "Smoking cessation remains one of the highest-leverage longevity interventions, reducing risks across cardiovascular disease, cancer, lung disease, and overall mortality.",
  },
  {
    title: "Keep alcohol exposure low",
    evidence: "Strong",
    category: "disease-prevention",
    body:
      "Alcohol raises risk for several cancers and can impair sleep, blood pressure, mood, and recovery. Lower exposure is generally safer than higher exposure.",
  },
  {
    title: "Know your blood pressure trend",
    evidence: "Strong",
    category: "biomarker-database",
    body:
      "Hypertension is common, often silent, and treatable. Home measurements can reveal patterns that occasional clinic readings miss.",
  },
  {
    title: "Track ApoB or an equivalent lipid-risk signal",
    evidence: "Strong",
    category: "biomarker-database",
    body:
      "LDL cholesterol is useful, but ApoB can better represent atherogenic particle number. Interpret it with a clinician alongside family history, blood pressure, glucose, and other risks.",
  },
  {
    title: "Watch glucose regulation before it becomes disease",
    evidence: "Strong",
    category: "biomarker-database",
    body:
      "Fasting glucose, HbA1c, insulin context, waist circumference, and post-meal responses can show metabolic drift early enough to act.",
  },
  {
    title: "Measure waist circumference, not just weight",
    evidence: "Moderate",
    category: "biomarker-database",
    body:
      "Central adiposity often tracks metabolic risk more clearly than body weight alone. Combine it with strength, fitness, and lab trends rather than treating it as a standalone identity metric.",
  },
  {
    title: "Build a clinician-guided screening calendar",
    evidence: "Strong",
    category: "disease-prevention",
    body:
      "Cancer, blood pressure, lipid, diabetes, dental, vision, and vaccination schedules should be personalized by age, sex, risk, family history, and local guidelines.",
  },
  {
    title: "Protect oral health",
    evidence: "Moderate",
    category: "disease-prevention",
    body:
      "Periodontal health is linked with systemic inflammation and cardiometabolic risk markers. Brushing, flossing, and dental follow-up are small habits with compounding value.",
  },
  {
    title: "Maintain strong social connection",
    evidence: "Strong",
    category: "disease-prevention",
    body:
      "Social isolation and loneliness are associated with higher mortality risk. Relationships are not a soft lifestyle bonus; they are part of the health system.",
  },
  {
    title: "Train balance and mobility",
    evidence: "Moderate",
    category: "exercise",
    body:
      "Falls, stiffness, and loss of range limit healthspan. Add simple mobility, balance, and loaded carries before you need them.",
  },
  {
    title: "Use sunlight and light timing deliberately",
    evidence: "Emerging",
    category: "sleep",
    body:
      "Morning light, dimmer evenings, and regular outdoor exposure can support circadian rhythm. The basics are low-risk and often improve sleep consistency.",
  },
  {
    title: "Manage chronic stress as physiology, not willpower",
    evidence: "Moderate",
    category: "disease-prevention",
    body:
      "Stress affects sleep, appetite, blood pressure, glucose, training recovery, and adherence. Breath work, therapy, workload design, and social support are legitimate interventions.",
  },
  {
    title: "Use medications and supplements with evidence, not vibes",
    evidence: "Moderate",
    category: "research-reviews",
    body:
      "Some therapies are powerful when matched to the right risk profile. Others are expensive noise. Use lab context, contraindication checks, and clinician review.",
  },
  {
    title: "Turn data into one next action",
    evidence: "Emerging",
    category: "ai-medicine",
    body:
      "Wearables and labs only matter if they change behavior or clinical decisions. The practical question is always: what should happen next, and how will we know it worked?",
  },
  {
    title: "Review your system every quarter",
    evidence: "Moderate",
    category: "longevity-library",
    body:
      "Healthspan work compounds when you revisit goals, lab trends, training load, sleep, medications, and life constraints. Quarterly review prevents drift without creating obsession.",
  },
];

export const resourceArticles: ResourceArticle[] = [
  {
    slug: "how-to-read-your-first-longevity-blood-panel",
    title: "How to Read Your First Longevity Blood Panel",
    subtitle:
      "A beginner's map for turning lab results into better questions, cleaner trends, and more useful clinician conversations.",
    description:
      "Learn how to read a longevity blood panel across lipids, glucose regulation, inflammation, kidney/liver context, and follow-up timing.",
    category: "beginners-guides",
    categories: ["beginners-guides", "longevity-library", "biomarker-database", "disease-prevention"],
    publishedAt: "2026-06-29",
    updatedAt: "2026-06-29",
    readingTime: "9 min read",
    author: "Aeonvera Editorial",
    reviewedBy: "Aeonvera Editorial Review",
    heroImage: "/marketing/rejuvenation-woman-top-extended.png",
    heroAlt: "Aeonvera lab and longevity intelligence portrait.",
    summary: [
      "A lab panel is not a grade. It is a snapshot of physiology, risk, and context.",
      "The most useful first pass is pattern recognition: lipids, glucose, inflammation, organ function, and blood counts.",
      "Trends and clinician interpretation matter more than one isolated value.",
    ],
    takeaways: [
      "Confirm whether the test was fasting and whether you were sick, stressed, or recovering from hard training.",
      "Look for clusters, not single numbers.",
      "Prioritize markers that change decisions.",
      "Retest after enough time for a real intervention to matter.",
    ],
    evidenceIntroTitle: "Start with patterns, not panic.",
    evidenceIntroBody:
      "Most out-of-range values need context: symptoms, medications, fasting status, recent infection, training load, menstrual status, hydration, and prior results. The goal is to identify what deserves action, retesting, or clinical follow-up.",
    strategySectionTitle: "Five steps for reading a blood panel",
    biomarkerSectionTitle: "Markers to understand first",
    biomarkerSectionBody: [
      "For a first longevity panel, the cardiometabolic cluster usually deserves early attention: ApoB, LDL-C, HDL-C, triglycerides, HbA1c, fasting glucose, and fasting insulin.",
      "Inflammation and recovery context can come from hs-CRP, sleep, resting heart rate, HRV, and symptoms. None of these should be interpreted alone.",
    ],
    biomarkerLinks: ["apob", "ldl-c", "hdl-c", "triglycerides", "hba1c", "fasting-glucose", "fasting-insulin", "hs-crp"],
    strategies: [
      {
        title: "Check the test context first",
        evidence: "Strong",
        category: "beginners-guides",
        body:
          "Before interpreting results, note fasting status, recent illness, heavy exercise, alcohol exposure, poor sleep, medications, supplements, and timing.",
      },
      {
        title: "Read the lipid cluster together",
        evidence: "Strong",
        category: "biomarker-database",
        body:
          "LDL-C, HDL-C, triglycerides, non-HDL-C, and ApoB answer related but different questions about cardiovascular risk.",
      },
      {
        title: "Read glucose markers as a system",
        evidence: "Strong",
        category: "biomarker-database",
        body:
          "HbA1c, fasting glucose, fasting insulin, triglycerides, waist circumference, and blood pressure can reveal metabolic patterns earlier than one marker alone.",
      },
      {
        title: "Separate acute noise from chronic trend",
        evidence: "Moderate",
        category: "research-reviews",
        body:
          "Inflammation markers, liver enzymes, glucose, and blood counts can move temporarily. Repeat testing may be more useful than overreacting to a single snapshot.",
      },
      {
        title: "Turn results into a next action",
        evidence: "Moderate",
        category: "ai-medicine",
        body:
          "Every meaningful lab review should end with one of four outcomes: watch, retest, change behavior, or discuss medical treatment with a clinician.",
      },
    ],
    references: [
      {
        label: "MedlinePlus: understanding laboratory tests",
        url: "https://medlineplus.gov/lab-tests/",
      },
      {
        label: "CDC: cholesterol testing and facts",
        url: "https://www.cdc.gov/cholesterol/testing/index.html",
      },
      {
        label: "CDC: diabetes testing",
        url: "https://www.cdc.gov/diabetes/diabetes-testing/index.html",
      },
      {
        label: "MedlinePlus: C-reactive protein test",
        url: "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/",
      },
    ],
  },
  {
    slug: "beginners-guide-apob-ldl-hdl-triglycerides",
    title: "A Beginner's Guide to ApoB, LDL-C, HDL-C, and Triglycerides",
    subtitle:
      "The lipid markers that explain cardiovascular risk better when they are read together.",
    description:
      "Understand ApoB, LDL-C, HDL-C, and triglycerides, how they differ, and why the full lipid pattern matters for prevention.",
    category: "beginners-guides",
    categories: ["beginners-guides", "biomarker-database", "disease-prevention", "research-reviews"],
    publishedAt: "2026-06-29",
    updatedAt: "2026-06-29",
    readingTime: "8 min read",
    author: "Aeonvera Editorial",
    reviewedBy: "Aeonvera Editorial Review",
    heroImage: "/marketing/rejuvenation-man.png",
    heroAlt: "Aeonvera cardiometabolic health portrait.",
    summary: [
      "LDL-C estimates cholesterol mass in LDL particles; ApoB approximates atherogenic particle number.",
      "HDL-C and triglycerides are metabolic context markers, not simple good-versus-bad labels.",
      "The best lipid interpretation depends on the whole risk picture.",
    ],
    takeaways: [
      "ApoB can clarify risk when LDL-C and triglycerides are discordant.",
      "Triglycerides and HDL-C often reflect metabolic health patterns.",
      "LDL-C remains a central marker, but it is not the only one.",
      "Treatment targets depend on overall risk and clinician judgment.",
    ],
    evidenceIntroTitle: "Lipids are a pattern, not a personality test.",
    evidenceIntroBody:
      "The old story of good cholesterol and bad cholesterol is too simple. Cardiovascular prevention works best when lipids are interpreted with blood pressure, glucose regulation, family history, smoking status, age, sex, and prior disease.",
    strategySectionTitle: "Four lipid markers, four different questions",
    biomarkerSectionTitle: "Open the lipid marker guides",
    biomarkerSectionBody: [
      "Start with LDL-C and ApoB for atherogenic risk, then use HDL-C and triglycerides to understand the broader metabolic context.",
    ],
    biomarkerLinks: ["apob", "ldl-c", "hdl-c", "triglycerides"],
    strategies: [
      {
        title: "LDL-C asks how much cholesterol is carried in LDL particles",
        evidence: "Strong",
        category: "biomarker-database",
        body:
          "LDL-C is central to cardiovascular risk assessment and is commonly used to guide prevention and treatment decisions.",
      },
      {
        title: "ApoB asks how many atherogenic particles are present",
        evidence: "Strong",
        category: "biomarker-database",
        body:
          "ApoB can be especially useful when particle number and cholesterol mass do not match, such as in insulin resistance or high triglycerides.",
      },
      {
        title: "HDL-C adds context, but raising it is not the goal",
        evidence: "Moderate",
        category: "biomarker-database",
        body:
          "Low HDL-C can travel with metabolic risk, but simply raising HDL-C has not reliably reduced events. The pattern matters.",
      },
      {
        title: "Triglycerides often reveal metabolic pressure",
        evidence: "Strong",
        category: "biomarker-database",
        body:
          "High triglycerides can reflect insulin resistance, alcohol exposure, refined carbohydrate intake, genetic factors, or medical conditions.",
      },
    ],
    references: [
      {
        label: "CDC: LDL, HDL, and triglycerides",
        url: "https://www.cdc.gov/cholesterol/about/ldl-and-hdl-cholesterol-and-triglycerides.html",
      },
      {
        label: "NHLBI: blood cholesterol",
        url: "https://www.nhlbi.nih.gov/health/blood-cholesterol",
      },
      {
        label: "American Heart Association: ApoB",
        url: "https://www.heart.org/en/health-topics/cholesterol/how-to-get-your-cholesterol-tested/apolipoprotein-b",
      },
      {
        label: "MedlinePlus: triglycerides test",
        url: "https://medlineplus.gov/lab-tests/triglycerides-test/",
      },
    ],
  },
  {
    slug: "healthspan-stack-sleep-strength-cardio-nutrition-prevention",
    title: "The Healthspan Stack: Sleep, Strength, Cardio, Nutrition, and Prevention",
    subtitle:
      "The five boring, powerful pillars that do more for longevity than most exotic interventions.",
    description:
      "A practical beginner's guide to the core healthspan stack: sleep, strength, cardio, nutrition, and prevention.",
    category: "beginners-guides",
    categories: ["beginners-guides", "longevity-library", "exercise", "sleep", "nutrition", "disease-prevention"],
    publishedAt: "2026-06-29",
    updatedAt: "2026-06-29",
    readingTime: "10 min read",
    author: "Aeonvera Editorial",
    reviewedBy: "Aeonvera Editorial Review",
    heroImage: "/marketing/rejuvenation-woman.png",
    heroAlt: "Aeonvera healthspan systems portrait.",
    summary: [
      "Most healthspan gains start with fundamentals that compound.",
      "The stack works because each pillar supports the others: sleep improves training, training improves glucose, nutrition supports body composition, and prevention catches risk early.",
      "The goal is not perfection; it is a system you can repeat.",
    ],
    takeaways: [
      "Anchor sleep before chasing advanced optimization.",
      "Train both strength and cardiorespiratory fitness.",
      "Use nutrition to support metabolic health, not short-term punishment.",
      "Build a screening and prevention calendar with a clinician.",
    ],
    evidenceIntroTitle: "The fundamentals are not basic. They are load-bearing.",
    evidenceIntroBody:
      "Healthspan work often fails when people skip repeatable basics for novelty. The highest-confidence system starts with behaviors and clinical prevention that are measurable, repeatable, and adaptable.",
    strategySectionTitle: "The five-part healthspan stack",
    biomarkerSectionTitle: "Markers that show whether the stack is working",
    biomarkerSectionBody: [
      "A useful healthspan stack should move signals over time: glucose regulation, lipid risk, inflammation, VO2 max, resting heart rate, HRV, blood pressure, waist circumference, and sleep quality.",
    ],
    biomarkerLinks: ["hba1c", "fasting-glucose", "fasting-insulin", "apob", "triglycerides", "hs-crp", "vo2-max", "hrv"],
    strategies: [
      {
        title: "Sleep is the recovery platform",
        evidence: "Strong",
        category: "sleep",
        body:
          "Most adults need at least seven hours. Sleep affects appetite, glucose regulation, blood pressure, mood, immune function, and training adaptation.",
      },
      {
        title: "Strength preserves capacity",
        evidence: "Strong",
        category: "exercise",
        body:
          "Resistance training supports muscle, bone, glucose disposal, mobility, and independence across aging.",
      },
      {
        title: "Cardio builds reserve",
        evidence: "Strong",
        category: "exercise",
        body:
          "Aerobic fitness and VO2 max are among the strongest functional signals for long-term health and resilience.",
      },
      {
        title: "Nutrition shapes metabolic direction",
        evidence: "Strong",
        category: "nutrition",
        body:
          "A Mediterranean-style, high-fiber, minimally processed dietary pattern supports lipids, glucose, body composition, and adherence.",
      },
      {
        title: "Prevention keeps small risks from becoming large ones",
        evidence: "Strong",
        category: "disease-prevention",
        body:
          "Blood pressure control, vaccination, cancer screening, dental care, and clinician-guided risk management are part of longevity, not separate from it.",
      },
    ],
    references: [
      {
        label: "U.S. physical activity guidelines",
        url: "https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines",
      },
      {
        label: "CDC: sleep and sleep disorders",
        url: "https://www.cdc.gov/sleep/about/index.html",
      },
      {
        label: "American Heart Association Life's Essential 8",
        url: "https://www.heart.org/en/healthy-living/healthy-lifestyle/lifes-essential-8",
      },
      {
        label: "National Institute on Aging: healthy aging",
        url: "https://www.nia.nih.gov/health/healthy-aging",
      },
    ],
  },
  {
    slug: "what-is-biological-age",
    title: "What Is Biological Age?",
    subtitle:
      "A clear guide to what biological age can measure, what it cannot prove, and how to use it without turning it into a vanity score.",
    description:
      "Learn what biological age means, how aging clocks work, which biomarkers matter, and how to use biological-age estimates as part of a practical healthspan system.",
    category: "featured-articles",
    categories: [
      "featured-articles",
      "beginners-guides",
      "longevity-library",
      "biomarker-database",
      "ai-medicine",
      "research-reviews",
    ],
    publishedAt: "2026-06-29",
    updatedAt: "2026-06-29",
    readingTime: "12 min read",
    author: "Aeonvera Editorial",
    heroImage: "/marketing/rejuvenation-man.png",
    heroAlt: "Aeonvera biological age and longevity portrait.",
    summary: [
      "Chronological age is the number of years you have lived; biological age tries to estimate how your body is aging compared with expected patterns.",
      "Biological-age clocks can use blood chemistry, physiology, epigenetics, imaging, wearable signals, or combinations of many inputs.",
      "A biological-age estimate is most useful when it points to a concrete action and can be retested over time.",
    ],
    takeaways: [
      "Treat biological age as a decision-support signal, not a verdict.",
      "Use multiple inputs: labs, fitness, sleep, body composition, blood pressure, and clinical history.",
      "Look for direction and confidence, not a single perfect number.",
      "The goal is better healthspan, not simply a younger-looking score.",
    ],
    evidenceIntroTitle: "Aging clocks are useful, but imperfect.",
    evidenceIntroBody:
      "Biological-age models are trained to capture patterns linked with aging, disease risk, mortality risk, or physiological decline. Different clocks can disagree because they measure different layers of biology. That is not a failure; it is a reminder to interpret the result as one signal inside a broader system.",
    strategySectionTitle: "Six principles for using biological age well",
    biomarkerSectionTitle: "Biomarkers that give biological age context",
    biomarkerSectionBody: [
      "The best biological-age systems do not depend on one clock alone. They combine cardiometabolic risk, inflammation, glucose regulation, fitness, recovery, and clinical history.",
      "ApoB, LDL-C, triglycerides, HbA1c, fasting glucose, fasting insulin, hs-CRP, VO2 max, and HRV can all help explain why an estimate is moving and what might be worth changing.",
    ],
    biomarkerLinks: [
      "apob",
      "ldl-c",
      "triglycerides",
      "hba1c",
      "fasting-glucose",
      "fasting-insulin",
      "hs-crp",
      "vo2-max",
      "hrv",
    ],
    strategies: [
      {
        title: "Separate chronological age from biological state",
        evidence: "Strong",
        category: "beginners-guides",
        body:
          "Chronological age is fixed. Biological state is influenced by genetics, disease history, fitness, sleep, nutrition, stress, medications, and environment. That is why two people of the same age can have different healthspan trajectories.",
      },
      {
        title: "Know what kind of clock you are using",
        evidence: "Moderate",
        category: "research-reviews",
        body:
          "Some clocks use blood markers, some use DNA methylation, some use wearable or physiological data, and some combine inputs. The output depends on the model's training data and purpose.",
      },
      {
        title: "Use biological age to ask better questions",
        evidence: "Moderate",
        category: "longevity-library",
        body:
          "A useful result should lead to questions such as: which systems are driving risk, what can change, when should we retest, and which clinical context is missing?",
      },
      {
        title: "Do not chase a single number",
        evidence: "Strong",
        category: "beginners-guides",
        body:
          "Small changes in a biological-age estimate may reflect noise, assay variation, model assumptions, or temporary physiology. Direction, confidence, and underlying drivers matter more than one point estimate.",
      },
      {
        title: "Pair clocks with actionable biomarkers",
        evidence: "Strong",
        category: "biomarker-database",
        body:
          "Cardiometabolic markers, blood pressure, fitness, sleep, body composition, inflammation, and recovery signals help translate a biological-age estimate into a practical plan.",
      },
      {
        title: "Retest after real interventions",
        evidence: "Moderate",
        category: "ai-medicine",
        body:
          "Biological age becomes more useful when it sits inside a feedback loop: baseline, intervention, retest, and refinement. Without follow-up, it is just an interesting snapshot.",
      },
    ],
    references: [
      {
        label: "National Institute on Aging: biomarkers of aging",
        url: "https://www.nia.nih.gov/research/dab/geroscience/biomarkers-aging",
      },
      {
        label: "Biological age and aging clocks review",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10784616/",
      },
      {
        label: "Epigenetic clocks and biological age review",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7615266/",
      },
      {
        label: "Nature Aging: biological age predictors and limitations",
        url: "https://www.nature.com/articles/s43587-022-00248-2",
      },
      {
        label: "National Institute on Aging: healthy aging",
        url: "https://www.nia.nih.gov/health/healthy-aging",
      },
    ],
  },
  {
    slug: "science-of-living-longer-25-evidence-based-strategies",
    title: "The Science of Living Longer: 25 Evidence-Based Strategies to Increase Your Healthspan",
    subtitle:
      "A practical, evidence-aware blueprint for adding more capable years to your life.",
    description:
      "Learn 25 evidence-based healthspan strategies across exercise, nutrition, sleep, disease prevention, biomarkers, and AI-supported longevity systems.",
    category: "featured-articles",
    categories: [
      "featured-articles",
      "beginners-guides",
      "longevity-library",
      "exercise",
      "nutrition",
      "sleep",
      "disease-prevention",
      "biomarker-database",
      "ai-medicine",
      "research-reviews",
    ],
    publishedAt: "2026-06-29",
    updatedAt: "2026-06-29",
    readingTime: "18 min read",
    author: "Aeonvera Editorial",
    heroImage: "/marketing/rejuvenation-woman-top-extended.png",
    heroAlt: "Aeonvera longevity intelligence portrait.",
    summary: [
      "Healthspan is the period of life spent physically capable, mentally clear, and metabolically resilient.",
      "The highest-leverage longevity work is not exotic: fitness, blood pressure, sleep, nutrition, smoking avoidance, screening, and social connection do most of the heavy lifting.",
      "Biomarkers and wearables are useful when they create a feedback loop: observe, act, retest, and refine.",
    ],
    takeaways: [
      "Start with the behaviors and clinical signals that have the strongest evidence.",
      "Track trends, not isolated readings.",
      "Use AI and health data to reduce friction around the next right action.",
      "Discuss medical decisions, screening, and medication changes with a qualified clinician.",
    ],
    biomarkerLinks: [
      "apob",
      "ldl-c",
      "triglycerides",
      "hba1c",
      "fasting-glucose",
      "fasting-insulin",
      "hs-crp",
      "vo2-max",
      "hrv",
    ],
    strategies,
    references: [
      {
        label: "U.S. physical activity guidelines for adults",
        url: "https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines",
      },
      {
        label: "CDC adult sleep duration guidance",
        url: "https://www.cdc.gov/sleep/about/index.html",
      },
      {
        label: "American Heart Association Life's Essential 8",
        url: "https://www.heart.org/en/healthy-living/healthy-lifestyle/lifes-essential-8",
      },
      {
        label: "National Institute on Aging healthy aging guidance",
        url: "https://www.nia.nih.gov/health/healthy-aging",
      },
      {
        label: "Mediterranean diet and cardiovascular prevention trial",
        url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1200303",
      },
      {
        label: "CDC benefits of quitting smoking",
        url: "https://www.cdc.gov/tobacco/about/benefits-of-quitting.html",
      },
      {
        label: "National Cancer Institute alcohol and cancer risk",
        url: "https://www.cancer.gov/about-cancer/causes-prevention/risk/alcohol/alcohol-fact-sheet",
      },
      {
        label: "Social relationships and mortality risk meta-analysis",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2910600/",
      },
    ],
  },
];

export function getCategory(slug: ResourceCategorySlug) {
  return resourceCategories.find((category) => category.slug === slug);
}

export function getArticle(slug: string) {
  return resourceArticles.find((article) => article.slug === slug);
}

export function getArticlesByCategory(slug: ResourceCategorySlug) {
  return resourceArticles.filter((article) => article.categories.includes(slug));
}

export function getFeaturedArticle() {
  return getArticle("science-of-living-longer-25-evidence-based-strategies") || resourceArticles[0];
}
