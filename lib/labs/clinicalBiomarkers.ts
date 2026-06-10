export type ClinicalBiomarkerKey =
  | "albumin"
  | "creatinine"
  | "fasting_glucose"
  | "hscrp"
  | "lymphocyte_pct"
  | "mean_cell_volume"
  | "red_cell_distribution_width"
  | "alkaline_phosphatase"
  | "white_blood_cell_count";

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
    key: "hscrp",
    labels: ["hscrp", "hs-crp", "c-reactive protein", "crp"],
    units: ["mg/L", "mg/dL"],
  },
  {
    key: "lymphocyte_pct",
    labels: ["lymphocyte %", "lymphocytes %", "lymphocyte percent", "lymphocytes"],
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
];

const KEY_ALIASES = new Map<string, ClinicalBiomarkerKey>(
  CLINICAL_BIOMARKERS.flatMap((biomarker) => [
    [biomarker.key, biomarker.key] as const,
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
