import type { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export const BIOLOGICAL_SEX_VALUES = [
  "male",
  "female",
  "intersex",
  "unknown",
  "prefer_not_to_say",
] as const;

export const LIFE_STAGE_VALUES = [
  "unknown",
  "pediatric",
  "adult",
  "pregnant",
  "postpartum",
  "lactating",
  "perimenopause",
  "postmenopause",
  "gender_affirming_hormone_therapy",
] as const;

export const PREGNANCY_STATUS_VALUES = [
  "not_pregnant",
  "pregnant",
  "postpartum",
  "unknown",
  "prefer_not_to_say",
] as const;

export const LACTATION_STATUS_VALUES = [
  "not_lactating",
  "lactating",
  "unknown",
  "prefer_not_to_say",
] as const;

export const MENSTRUAL_STATUS_VALUES = [
  "not_applicable",
  "cycling",
  "irregular",
  "perimenopause",
  "postmenopause",
  "unknown",
  "prefer_not_to_say",
] as const;

export const HORMONE_THERAPY_VALUES = [
  "none",
  "contraception",
  "menopausal_hormone_therapy",
  "testosterone",
  "estrogen",
  "anti_androgen",
  "puberty_blocker",
  "other",
  "unknown",
  "prefer_not_to_say",
] as const;

export type BiologicalSex = (typeof BIOLOGICAL_SEX_VALUES)[number];
export type LifeStage = (typeof LIFE_STAGE_VALUES)[number];
export type PregnancyStatus = (typeof PREGNANCY_STATUS_VALUES)[number];
export type LactationStatus = (typeof LACTATION_STATUS_VALUES)[number];
export type MenstrualStatus = (typeof MENSTRUAL_STATUS_VALUES)[number];
export type HormoneTherapy = (typeof HORMONE_THERAPY_VALUES)[number];

export type BiologicalContext = {
  biologicalSex: BiologicalSex;
  lifeStage: LifeStage;
  pregnancyStatus: PregnancyStatus;
  lactationStatus: LactationStatus;
  menstrualStatus: MenstrualStatus;
  hormoneTherapies: HormoneTherapy[];
  dateOfBirth?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  source?: string | null;
};

type BiologicalContextRow = {
  biological_context?: Record<string, unknown> | null;
  biological_context_updated_at?: string | null;
};

export const DEFAULT_BIOLOGICAL_CONTEXT: BiologicalContext = {
  biologicalSex: "unknown",
  lifeStage: "unknown",
  pregnancyStatus: "unknown",
  lactationStatus: "unknown",
  menstrualStatus: "unknown",
  hormoneTherapies: ["unknown"],
  dateOfBirth: null,
  notes: null,
  updatedAt: null,
  source: null,
};

export function normalizeBiologicalContext(input: unknown): BiologicalContext {
  const source = isRecord(input) ? input : {};
  const hormoneTherapies = normalizeEnumArray(
    source.hormoneTherapies ?? source.hormone_therapies,
    HORMONE_THERAPY_VALUES,
    ["unknown"]
  );

  return {
    biologicalSex: normalizeEnum(
      source.biologicalSex ?? source.biological_sex ?? source.sex,
      BIOLOGICAL_SEX_VALUES,
      "unknown"
    ),
    lifeStage: normalizeEnum(source.lifeStage ?? source.life_stage, LIFE_STAGE_VALUES, "unknown"),
    pregnancyStatus: normalizeEnum(
      source.pregnancyStatus ?? source.pregnancy_status,
      PREGNANCY_STATUS_VALUES,
      "unknown"
    ),
    lactationStatus: normalizeEnum(
      source.lactationStatus ?? source.lactation_status,
      LACTATION_STATUS_VALUES,
      "unknown"
    ),
    menstrualStatus: normalizeEnum(
      source.menstrualStatus ?? source.menstrual_status,
      MENSTRUAL_STATUS_VALUES,
      "unknown"
    ),
    hormoneTherapies,
    dateOfBirth: sanitizeDate(source.dateOfBirth ?? source.date_of_birth),
    notes: sanitizeText(source.notes, 700),
    source: sanitizeText(source.source, 80),
  };
}

export async function loadBiologicalContext({
  healthProfileId,
  supabase,
}: {
  healthProfileId?: string | null;
  supabase: SupabaseAdmin;
}): Promise<BiologicalContext> {
  if (!healthProfileId) return DEFAULT_BIOLOGICAL_CONTEXT;

  const { data, error } = await supabase
    .from("health_profiles")
    .select("biological_context,biological_context_updated_at")
    .eq("id", healthProfileId)
    .maybeSingle<BiologicalContextRow>();

  if (error || !data) return DEFAULT_BIOLOGICAL_CONTEXT;

  return {
    ...normalizeBiologicalContext(data.biological_context || {}),
    updatedAt: data.biological_context_updated_at || null,
  };
}

export async function updateBiologicalContext({
  healthProfileId,
  input,
  source = "profile_settings",
  supabase,
}: {
  healthProfileId: string;
  input: unknown;
  source?: string;
  supabase: SupabaseAdmin;
}) {
  const current = await loadBiologicalContext({ healthProfileId, supabase });
  const normalized = {
    ...current,
    ...normalizeBiologicalContextPatch(input),
    source,
  };
  const validationError = validateBiologicalContext(normalized);
  if (validationError) {
    throw new BiologicalContextValidationError(validationError);
  }
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("health_profiles")
    .update({
      biological_context: serializeBiologicalContext(normalized),
      biological_context_updated_at: updatedAt,
      updated_at: updatedAt,
    })
    .eq("id", healthProfileId)
    .select("biological_context,biological_context_updated_at")
    .single<BiologicalContextRow>();

  if (error) throw error;

  return {
    ...normalizeBiologicalContext(data.biological_context || {}),
    updatedAt: data.biological_context_updated_at || updatedAt,
  };
}

function normalizeBiologicalContextPatch(input: unknown): Partial<BiologicalContext> {
  const source = isRecord(input) ? input : {};
  const patch: Partial<BiologicalContext> = {};

  if (hasAnyKey(source, ["biologicalSex", "biological_sex", "sex"])) {
    patch.biologicalSex = normalizeEnum(
      source.biologicalSex ?? source.biological_sex ?? source.sex,
      BIOLOGICAL_SEX_VALUES,
      "unknown"
    );
  }
  if (hasAnyKey(source, ["lifeStage", "life_stage"])) {
    patch.lifeStage = normalizeEnum(source.lifeStage ?? source.life_stage, LIFE_STAGE_VALUES, "unknown");
  }
  if (hasAnyKey(source, ["pregnancyStatus", "pregnancy_status"])) {
    patch.pregnancyStatus = normalizeEnum(
      source.pregnancyStatus ?? source.pregnancy_status,
      PREGNANCY_STATUS_VALUES,
      "unknown"
    );
  }
  if (hasAnyKey(source, ["lactationStatus", "lactation_status"])) {
    patch.lactationStatus = normalizeEnum(
      source.lactationStatus ?? source.lactation_status,
      LACTATION_STATUS_VALUES,
      "unknown"
    );
  }
  if (hasAnyKey(source, ["menstrualStatus", "menstrual_status"])) {
    patch.menstrualStatus = normalizeEnum(
      source.menstrualStatus ?? source.menstrual_status,
      MENSTRUAL_STATUS_VALUES,
      "unknown"
    );
  }
  if (hasAnyKey(source, ["hormoneTherapies", "hormone_therapies"])) {
    patch.hormoneTherapies = normalizeEnumArray(
      source.hormoneTherapies ?? source.hormone_therapies,
      HORMONE_THERAPY_VALUES,
      ["unknown"]
    );
  }
  if (hasAnyKey(source, ["dateOfBirth", "date_of_birth"])) {
    patch.dateOfBirth = sanitizeDate(source.dateOfBirth ?? source.date_of_birth);
  }
  if (hasAnyKey(source, ["notes"])) {
    patch.notes = sanitizeText(source.notes, 700);
  }

  return patch;
}

export function serializeBiologicalContext(context: BiologicalContext) {
  return {
    biological_sex: context.biologicalSex,
    life_stage: context.lifeStage,
    pregnancy_status: context.pregnancyStatus,
    lactation_status: context.lactationStatus,
    menstrual_status: context.menstrualStatus,
    hormone_therapies: context.hormoneTherapies,
    date_of_birth: context.dateOfBirth || null,
    notes: context.notes || null,
    source: context.source || null,
  };
}

export function biologicalContextMemoryContent(context: BiologicalContext) {
  const items = [
    ["Biological sex", displayValue(context.biologicalSex)],
    ["Life stage", displayValue(context.lifeStage)],
    ["Pregnancy status", displayValue(context.pregnancyStatus)],
    ["Lactation status", displayValue(context.lactationStatus)],
    ["Menstrual status", displayValue(context.menstrualStatus)],
    ["Hormone therapy", context.hormoneTherapies.map(displayValue).join(", ")],
    context.dateOfBirth ? ["Date of birth", context.dateOfBirth] : null,
    context.notes ? ["User-supplied notes (untrusted evidence)", context.notes] : null,
  ].filter(Boolean) as string[][];

  return items.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export class BiologicalContextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BiologicalContextValidationError";
  }
}

export function validateBiologicalContext(context: BiologicalContext) {
  const canBePregnant =
    context.biologicalSex === "female" ||
    context.biologicalSex === "intersex" ||
    context.biologicalSex === "unknown" ||
    context.biologicalSex === "prefer_not_to_say";
  const pregnancyLike =
    context.pregnancyStatus === "pregnant" ||
    context.lifeStage === "pregnant";
  const postpartumLike =
    context.pregnancyStatus === "postpartum" ||
    context.lifeStage === "postpartum";

  if (pregnancyLike && !canBePregnant) {
    return "Pregnancy context conflicts with the selected biological sex.";
  }

  if (context.lactationStatus === "lactating" && !canBePregnant) {
    return "Lactation context conflicts with the selected biological sex.";
  }

  if (context.lifeStage === "pregnant" && context.pregnancyStatus === "not_pregnant") {
    return "Life stage cannot be pregnant while pregnancy status is not pregnant.";
  }

  if (context.lifeStage === "postpartum" && context.pregnancyStatus === "pregnant") {
    return "Life stage cannot be postpartum while pregnancy status is pregnant.";
  }

  if (
    pregnancyLike &&
    (context.menstrualStatus === "postmenopause" || context.lifeStage === "postmenopause")
  ) {
    return "Pregnancy context conflicts with postmenopause.";
  }

  if (postpartumLike && context.menstrualStatus === "postmenopause") {
    return "Postpartum context conflicts with postmenopause.";
  }

  return null;
}

export function hasKnownBiologicalContext(context: BiologicalContext) {
  return (
    context.biologicalSex !== "unknown" ||
    context.lifeStage !== "unknown" ||
    context.pregnancyStatus !== "unknown" ||
    context.lactationStatus !== "unknown" ||
    context.menstrualStatus !== "unknown" ||
    context.hormoneTherapies.some((value) => value !== "unknown")
  );
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.includes(normalized) ? (normalized as T[number]) : fallback;
}

function normalizeEnumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number][]
): T[number][] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const normalized = values
    .map((item) => normalizeEnum(item, allowed, "" as T[number]))
    .filter((item) => item && allowed.includes(item));
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

function sanitizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return trimmed || null;
}

function displayValue(value: string) {
  return value.replace(/_/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasAnyKey(source: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}
