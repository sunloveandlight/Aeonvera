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
  heroImage: string;
  heroAlt: string;
  summary: string[];
  takeaways: string[];
  strategies: Strategy[];
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
  },
  {
    slug: "hba1c",
    name: "HbA1c",
    category: "Glucose regulation",
    whyItMatters:
      "HbA1c reflects average blood glucose exposure over roughly two to three months.",
    signals: ["Insulin resistance context", "Diabetes risk", "Lifestyle response"],
  },
  {
    slug: "hs-crp",
    name: "hs-CRP",
    category: "Inflammation",
    whyItMatters:
      "High-sensitivity CRP can indicate systemic inflammation when interpreted with clinical context.",
    signals: ["Inflammatory burden", "Recovery strain", "Cardiometabolic context"],
  },
  {
    slug: "vo2-max",
    name: "VO2 max",
    category: "Cardiorespiratory fitness",
    whyItMatters:
      "VO2 max estimates the body's capacity to use oxygen during intense exercise.",
    signals: ["Aerobic capacity", "Training adaptation", "Functional reserve"],
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
  return resourceArticles[0];
}
