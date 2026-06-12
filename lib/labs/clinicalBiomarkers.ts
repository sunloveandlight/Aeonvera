export type ClinicalBiomarkerKey =
  | "albumin"
  | "creatinine"
  | "fasting_glucose"
  | "fasting_insulin"
  | "hba1c"
  | "triglycerides"
  | "hdl_cholesterol"
  | "ldl_cholesterol"
  | "total_cholesterol"
  | "apob"
  | "blood_pressure_systolic"
  | "blood_pressure_diastolic"
  | "hscrp"
  | "homocysteine"
  | "ferritin"
  | "esr"
  | "fibrinogen"
  | "lymphocyte_pct"
  | "mean_cell_volume"
  | "red_cell_distribution_width"
  | "alkaline_phosphatase"
  | "white_blood_cell_count"
  | "tsh"
  | "free_t3"
  | "free_t4"
  | "morning_cortisol"
  | "total_testosterone"
  | "free_testosterone"
  | "shbg"
  | "estradiol"
  | "progesterone"
  | "lh"
  | "fsh"
  | "vitamin_d";

export type ParsedClinicalBiomarker = {
  canonicalKey: ClinicalBiomarkerKey;
  value: number;
  unit?: string;
  rawLabel?: string;
  referenceRange?: string;
};

type BiomarkerDefinition = {
  key: ClinicalBiomarkerKey;
  labels: string[];
  units: string[];
};

export const CLINICAL_BIOMARKERS: BiomarkerDefinition[] = [
  {
    key: "albumin",
    labels: ["albumin"],
    units: ["g/dL", "g/L"],
  },
  {
    key: "creatinine",
    labels: ["creatinine", "serum creatinine"],
    units: ["mg/dL", "umol/L", "µmol/L"],
  },
  {
    key: "fasting_glucose",
    labels: ["fasting glucose", "glucose", "serum glucose"],
    units: ["mg/dL", "mmol/L"],
  },
  {
    key: "fasting_insulin",
    labels: ["fasting insulin", "insulin"],
    units: ["uIU/mL", "µIU/mL", "pmol/L"],
  },
  {
    key: "hba1c",
    labels: ["hba1c", "hemoglobin a1c", "a1c"],
    units: ["%"],
  },
  {
    key: "triglycerides",
    labels: ["triglycerides", "tg"],
    units: ["mg/dL", "mmol/L"],
  },
  {
    key: "hdl_cholesterol",
    labels: ["hdl cholesterol", "hdl-c", "hdl"],
    units: ["mg/dL", "mmol/L"],
  },
  {
    key: "ldl_cholesterol",
    labels: ["ldl cholesterol", "ldl-c", "ldl"],
    units: ["mg/dL", "mmol/L"],
  },
  {
    key: "total_cholesterol",
    labels: ["total cholesterol", "cholesterol total", "cholesterol"],
    units: ["mg/dL", "mmol/L"],
  },
  {
    key: "apob",
    labels: ["apob", "apo b", "apolipoprotein b"],
    units: ["mg/dL", "g/L"],
  },
  {
    key: "blood_pressure_systolic",
    labels: ["systolic blood pressure", "systolic bp", "sbp"],
    units: ["mmHg"],
  },
  {
    key: "blood_pressure_diastolic",
    labels: ["diastolic blood pressure", "diastolic bp", "dbp"],
    units: ["mmHg"],
  },
  {
    key: "hscrp",
    labels: ["hscrp", "hs-crp", "c-reactive protein", "crp"],
    units: ["mg/L", "mg/dL"],
  },
  {
    key: "homocysteine",
    labels: ["homocysteine"],
    units: ["umol/L", "µmol/L"],
  },
  {
    key: "ferritin",
    labels: ["ferritin"],
    units: ["ng/mL", "ug/L", "µg/L"],
  },
  {
    key: "esr",
    labels: ["esr", "erythrocyte sedimentation rate", "sed rate"],
    units: ["mm/hr", "mm/h"],
  },
  {
    key: "fibrinogen",
    labels: ["fibrinogen"],
    units: ["mg/dL", "g/L"],
  },
  {
    key: "lymphocyte_pct",
    labels: ["lymphocyte %", "lymphocytes %", "lymphocyte percent", "lymphocyte pct", "lymphocytes"],
    units: ["%"],
  },
  {
    key: "mean_cell_volume",
    labels: ["mean cell volume", "mcv"],
    units: ["fL"],
  },
  {
    key: "red_cell_distribution_width",
    labels: ["red cell distribution width", "rdw", "rdw-cv"],
    units: ["%"],
  },
  {
    key: "alkaline_phosphatase",
    labels: ["alkaline phosphatase", "alk phos", "alp"],
    units: ["U/L", "IU/L"],
  },
  {
    key: "white_blood_cell_count",
    labels: ["white blood cell count", "wbc", "white blood cells"],
    units: ["10^3/uL", "K/uL", "x10E3/uL", "1000 cells/uL"],
  },
  {
    key: "tsh",
    labels: ["tsh", "thyroid stimulating hormone"],
    units: ["mIU/L", "uIU/mL", "µIU/mL"],
  },
  {
    key: "free_t3",
    labels: ["free t3", "ft3"],
    units: ["pg/mL", "pmol/L"],
  },
  {
    key: "free_t4",
    labels: ["free t4", "ft4"],
    units: ["ng/dL", "pmol/L"],
  },
  {
    key: "morning_cortisol",
    labels: ["morning cortisol", "cortisol am", "am cortisol", "cortisol"],
    units: ["ug/dL", "µg/dL", "nmol/L"],
  },
  {
    key: "total_testosterone",
    labels: ["total testosterone", "testosterone total", "testosterone"],
    units: ["ng/dL", "nmol/L"],
  },
  {
    key: "free_testosterone",
    labels: ["free testosterone"],
    units: ["pg/mL", "ng/dL"],
  },
  {
    key: "shbg",
    labels: ["shbg", "sex hormone binding globulin"],
    units: ["nmol/L"],
  },
  {
    key: "estradiol",
    labels: ["estradiol", "e2"],
    units: ["pg/mL", "pmol/L"],
  },
  {
    key: "progesterone",
    labels: ["progesterone"],
    units: ["ng/mL", "nmol/L"],
  },
  {
    key: "lh",
    labels: ["lh", "luteinizing hormone"],
    units: ["IU/L", "mIU/mL"],
  },
  {
    key: "fsh",
    labels: ["fsh", "follicle stimulating hormone"],
    units: ["IU/L", "mIU/mL"],
  },
  {
    key: "vitamin_d",
    labels: ["vitamin d", "25-oh vitamin d", "25 hydroxy vitamin d"],
    units: ["ng/mL", "nmol/L"],
  },
];

const KEY_ALIASES = new Map<string, ClinicalBiomarkerKey>(
  CLINICAL_BIOMARKERS.flatMap((biomarker) => [
    [biomarker.key, biomarker.key] as const,
    [normalizeLabel(biomarker.key), biomarker.key] as const,
    ...biomarker.labels.map((label) => [normalizeLabel(label), biomarker.key] as const),
  ])
);

export function parseClinicalBiomarkerText(text: string): ParsedClinicalBiomarker[] {
  const found = new Map<ClinicalBiomarkerKey, ParsedClinicalBiomarker>();
  const lines = text
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalizedLine = normalizeLabel(line);
    const definition = CLINICAL_BIOMARKERS.find((biomarker) =>
      biomarker.labels.some((label) => normalizedLine.includes(normalizeLabel(label)))
    );

    if (!definition || found.has(definition.key)) continue;

    const valueMatch = line.match(/(-?\d+(?:\.\d+)?)/);
    if (!valueMatch) continue;

    const value = Number(valueMatch[1]);
    if (!Number.isFinite(value)) continue;

    const unit = definition.units.find((candidate) =>
      line.toLowerCase().includes(candidate.toLowerCase())
    );

    found.set(definition.key, {
      canonicalKey: definition.key,
      value,
      unit,
      rawLabel: line.slice(0, 180),
    });
  }

  return Array.from(found.values());
}

export function normalizeClinicalBiomarkers(value: unknown): ParsedClinicalBiomarker[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { records?: unknown }).records)
    ? (value as { records: unknown[] }).records
    : [];

  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const candidate = record as Record<string, unknown>;
    const label = String(
      candidate.canonicalKey ||
        candidate.key ||
        candidate.metric ||
        candidate.name ||
        candidate.label ||
        ""
    );
    const canonicalKey = canonicalizeBiomarkerKey(label);
    const valueNumber = Number(candidate.value);

    if (!canonicalKey || !Number.isFinite(valueNumber)) return [];

    return {
      canonicalKey,
      value: valueNumber,
      unit: typeof candidate.unit === "string" ? candidate.unit : undefined,
      rawLabel: typeof candidate.rawLabel === "string" ? candidate.rawLabel : label,
      referenceRange:
        typeof candidate.referenceRange === "string"
          ? candidate.referenceRange
          : undefined,
    };
  });
}

export function canonicalizeBiomarkerKey(value: string) {
  return KEY_ALIASES.get(normalizeLabel(value));
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}
