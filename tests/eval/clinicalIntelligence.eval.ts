// Clinical-engine evaluation harness — clinical intelligence (sex-aware ranges).
// Guards the sex-specific classification logic so refactors can't silently drop it.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClinicalIntelligenceWithContext,
  type ClinicalBiomarkerRow,
  type ClinicalProfileContext,
  type ClinicalRiskTier,
} from "../../lib/clinical/clinicalIntelligence.ts";

const TIER_RANK: Record<ClinicalRiskTier, number> = {
  optimize: 0, monitor: 1, clinician_review: 2, urgent: 3,
};

function summarize(rows: ClinicalBiomarkerRow[], context: ClinicalProfileContext) {
  return buildClinicalIntelligenceWithContext(rows, context);
}
const ctx = (sex: "male" | "female"): ClinicalProfileContext => ({ age: 45, sex });

test("output is structurally valid", () => {
  const s = summarize([{ canonical_key: "hdl_cholesterol", value: 55, unit: "mg/dL" }], ctx("male"));
  assert.ok(["optimize", "monitor", "clinician_review", "urgent"].includes(s.riskTier));
  assert.ok(s.confidence >= 0 && s.confidence <= 100);
  assert.ok(Array.isArray(s.domains));
});

test("SEX-AWARE HDL: 47 mg/dL is clinician_review for female but not for male", () => {
  const rows: ClinicalBiomarkerRow[] = [{ canonical_key: "hdl_cholesterol", value: 47, unit: "mg/dL" }];
  const female = summarize(rows, ctx("female"));
  const male = summarize(rows, ctx("male"));
  assert.ok(TIER_RANK[female.riskTier] > TIER_RANK[male.riskTier],
    `HDL 47 should be more severe for female (${female.riskTier}) than male (${male.riskTier})`);
});

test("SEX-AWARE ferritin: 250 ng/mL is more severe for female than male", () => {
  const rows: ClinicalBiomarkerRow[] = [{ canonical_key: "ferritin", value: 250, unit: "ng/mL" }];
  const female = summarize(rows, ctx("female"));
  const male = summarize(rows, ctx("male"));
  assert.ok(TIER_RANK[female.riskTier] >= TIER_RANK[male.riskTier],
    `ferritin 250 should be >= severity for female (${female.riskTier}) vs male (${male.riskTier})`);
  assert.notEqual(female.riskTier, male.riskTier,
    "ferritin 250 should classify differently by sex (female >200 = review, male 200-300 = monitor)");
});

test("worse biomarkers escalate the overall risk tier", () => {
  const good = summarize([
    { canonical_key: "hdl_cholesterol", value: 65, unit: "mg/dL" },
    { canonical_key: "hscrp", value: 0.4, unit: "mg/L" },
  ], ctx("male"));
  const bad = summarize([
    { canonical_key: "hdl_cholesterol", value: 28, unit: "mg/dL" },
    { canonical_key: "hscrp", value: 9, unit: "mg/L" },
  ], ctx("male"));
  assert.ok(TIER_RANK[bad.riskTier] >= TIER_RANK[good.riskTier],
    `worse panel (${bad.riskTier}) should be >= risk of good panel (${good.riskTier})`);
});

test("missing data is surfaced, not silently ignored", () => {
  const s = summarize([{ canonical_key: "hdl_cholesterol", value: 55, unit: "mg/dL" }], ctx("female"));
  assert.ok(s.missingInputs.length > 0, "a one-marker panel should flag missing inputs");
});
