import type { ClinicalBiomarkerKey } from "@/lib/labs/clinicalBiomarkers";

export type LabTrendStatus = "improving" | "worsening" | "stable" | "baseline";

export type LabTrend = {
  canonicalKey: ClinicalBiomarkerKey;
  label: string;
  latestValue: number;
  previousValue: number | null;
  unit: string | null;
  measuredAt: string;
  delta: number | null;
  percentChange: number | null;
  status: LabTrendStatus;
  interpretation: string;
  target: string;
};

export type LabTrendRow = {
  canonical_key: ClinicalBiomarkerKey;
  value: number | string;
  unit?: string | null;
  measured_at: string;
};

type TrendDefinition = {
  label: string;
  target: string;
  lowerIsBetter?: boolean;
  higherIsBetter?: boolean;
  optimalMin?: number;
  optimalMax?: number;
};

const TREND_DEFINITIONS: Record<ClinicalBiomarkerKey, TrendDefinition> = {
  albumin: {
    label: "Albumin",
    target: "roughly 4.0-5.0 g/dL",
    optimalMin: 4,
    optimalMax: 5,
  },
  creatinine: {
    label: "Creatinine",
    target: "stable kidney marker",
    lowerIsBetter: true,
  },
  fasting_glucose: {
    label: "Fasting Glucose",
    target: "near 70-90 mg/dL",
    lowerIsBetter: true,
  },
  hscrp: {
    label: "hsCRP",
    target: "below 1.0 mg/L",
    lowerIsBetter: true,
  },
  lymphocyte_pct: {
    label: "Lymphocyte %",
    target: "roughly 20-40%",
    optimalMin: 20,
    optimalMax: 40,
  },
  mean_cell_volume: {
    label: "MCV",
    target: "roughly 80-100 fL",
    optimalMin: 80,
    optimalMax: 100,
  },
  red_cell_distribution_width: {
    label: "RDW",
    target: "lower and stable",
    lowerIsBetter: true,
  },
  alkaline_phosphatase: {
    label: "Alkaline Phosphatase",
    target: "stable within range",
    lowerIsBetter: true,
  },
  white_blood_cell_count: {
    label: "WBC",
    target: "roughly 4.0-10.0 K/uL",
    optimalMin: 4,
    optimalMax: 10,
  },
};

export function buildLabTrends(rows: LabTrendRow[]) {
  const grouped = rows.reduce<Map<ClinicalBiomarkerKey, LabTrendRow[]>>(
    (map, row) => {
      if (!map.has(row.canonical_key)) map.set(row.canonical_key, []);
      map.get(row.canonical_key)?.push(row);
      return map;
    },
    new Map()
  );

  return Array.from(grouped.entries())
    .map(([canonicalKey, values]) => buildLabTrend(canonicalKey, values))
    .filter((trend): trend is LabTrend => Boolean(trend))
    .sort((a, b) => priorityScore(a.status) - priorityScore(b.status));
}

function buildLabTrend(
  canonicalKey: ClinicalBiomarkerKey,
  values: LabTrendRow[]
): LabTrend | null {
  const sorted = values
    .map((row) => ({
      ...row,
      value: Number(row.value),
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort(
      (a, b) =>
        new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
    );
  const latest = sorted[0];
  const previous = sorted[1];

  if (!latest) return null;

  const definition = TREND_DEFINITIONS[canonicalKey];
  const previousValue = previous?.value ?? null;
  const delta =
    previousValue == null ? null : Number((latest.value - previousValue).toFixed(2));
  const percentChange =
    previousValue == null || previousValue === 0
      ? null
      : Number(((delta! / previousValue) * 100).toFixed(1));
  const status = classifyTrend({
    latest: latest.value,
    delta,
    definition,
  });

  return {
    canonicalKey,
    label: definition.label,
    latestValue: latest.value,
    previousValue,
    unit: latest.unit || previous?.unit || null,
    measuredAt: latest.measured_at,
    delta,
    percentChange,
    status,
    target: definition.target,
    interpretation: buildInterpretation({
      label: definition.label,
      latest: latest.value,
      delta,
      percentChange,
      status,
    }),
  };
}

function classifyTrend({
  latest,
  delta,
  definition,
}: {
  latest: number;
  delta: number | null;
  definition: TrendDefinition;
}): LabTrendStatus {
  if (delta == null) return "baseline";
  if (Math.abs(delta) < 0.01) return "stable";

  if (definition.lowerIsBetter) {
    return delta < 0 ? "improving" : "worsening";
  }

  if (definition.higherIsBetter) {
    return delta > 0 ? "improving" : "worsening";
  }

  if (definition.optimalMin != null && definition.optimalMax != null) {
    const latestDistance = distanceFromRange(
      latest,
      definition.optimalMin,
      definition.optimalMax
    );
    const previousDistance = distanceFromRange(
      latest - delta,
      definition.optimalMin,
      definition.optimalMax
    );

    if (latestDistance < previousDistance) return "improving";
    if (latestDistance > previousDistance) return "worsening";
  }

  return "stable";
}

function distanceFromRange(value: number, min: number, max: number) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function buildInterpretation({
  label,
  latest,
  delta,
  percentChange,
  status,
}: {
  label: string;
  latest: number;
  delta: number | null;
  percentChange: number | null;
  status: LabTrendStatus;
}) {
  if (status === "baseline") {
    return `${label} baseline is now tracked at ${latest}.`;
  }

  const movement =
    delta == null
      ? ""
      : `${Math.abs(delta)}${percentChange == null ? "" : ` (${Math.abs(percentChange)}%)`}`;

  if (status === "improving") {
    return `${label} is moving in a favorable direction by ${movement}.`;
  }

  if (status === "worsening") {
    return `${label} moved away from target by ${movement}.`;
  }

  return `${label} is stable from the previous import.`;
}

function priorityScore(status: LabTrendStatus) {
  return {
    worsening: 0,
    improving: 1,
    baseline: 2,
    stable: 3,
  }[status];
}
