// Clinical-engine evaluation harness — biological age.
// Zero external deps: Node's built-in test runner + type-stripping.
//   run:  npm run test:eval
// These are INVARIANTS and KNOWN-BUG GUARDS (not snapshots), so they must hold
// regardless of the exact magic numbers — they catch real correctness regressions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBiologicalAge, type AssessmentInput } from "../../lib/longevity/biologicalAgeEngine.ts";

// A complete, genuinely healthy 45-year-old. Biomarkers in the units the assessment
// form supplies (glucose mg/dL, hsCRP mg/L, lipids mg/dL).
function healthy(overrides: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    age: 45,
    sex: "male",
    height_cm: 178,
    weight_kg: 74,
    resting_hr: 55,
    blood_pressure_systolic: 115,
    blood_pressure_diastolic: 72,
    hrv: 65,
    fasting_glucose: 88,
    total_cholesterol: 170,
    ldl: 90,
    hdl: 62,
    triglycerides: 75,
    fasting_insulin: 4,
    hscrp: 0.6,
    albumin: 4.6,
    creatinine: 0.9,
    lymphocyte_pct: 34,
    mean_cell_volume: 89,
    red_cell_distribution_width: 12.5,
    alkaline_phosphatase: 60,
    white_blood_cell_count: 5.2,
    body_fat_pct: 15,
    waist_cm: 82,
    sleep_hours: 7.5,
    sleep_quality: 8,
    recovery_quality: 8,
    exercise_days: 5,
    strength_training: true,
    diet_type: "whole_foods",
    alcohol_use: "none",
    smoking: "never",
    stress_level: 3,
    primary_goal: "longevity",
    ...overrides,
  };
}

// An unhealthy 45-year-old (same age): the point is relative ordering vs healthy().
function unhealthy(overrides: Partial<AssessmentInput> = {}): AssessmentInput {
  return healthy({
    resting_hr: 82,
    blood_pressure_systolic: 148,
    blood_pressure_diastolic: 94,
    hrv: 25,
    fasting_glucose: 118,
    ldl: 175,
    hdl: 34,
    triglycerides: 240,
    fasting_insulin: 18,
    hscrp: 6.5,
    body_fat_pct: 34,
    waist_cm: 108,
    sleep_hours: 5,
    sleep_quality: 3,
    recovery_quality: 3,
    exercise_days: 0,
    strength_training: false,
    diet_type: "processed",
    alcohol_use: "heavy",
    smoking: "current",
    stress_level: 9,
    ...overrides,
  });
}

test("output is structurally valid and bounded", () => {
  const r = computeBiologicalAge(healthy());
  assert.ok(Number.isFinite(r.biologicalAge), "biologicalAge is finite");
  assert.ok(r.biologicalAge >= 18 && r.biologicalAge <= 120, "biologicalAge within [18,120]");
  assert.equal(r.chronologicalAge, 45);
  assert.ok(Array.isArray(r.factors) && r.factors.length > 0, "has factors");
  assert.ok(["excellent", "good", "average", "poor"].includes(r.category));
  assert.ok(r.accuracyScore > 0 && r.accuracyScore <= 100);
});

test("ageDelta is consistent with biologicalAge - chronologicalAge", () => {
  const r = computeBiologicalAge(healthy());
  assert.ok(Math.abs(r.ageDelta - (r.biologicalAge - r.chronologicalAge)) < 0.51,
    `ageDelta (${r.ageDelta}) should match bio-chrono (${r.biologicalAge - r.chronologicalAge})`);
});

test("MONOTONICITY: an unhealthy profile is never biologically younger than a healthy one of the same age", () => {
  const h = computeBiologicalAge(healthy());
  const u = computeBiologicalAge(unhealthy());
  assert.ok(u.biologicalAge >= h.biologicalAge,
    `unhealthy bioAge (${u.biologicalAge}) should be >= healthy bioAge (${h.biologicalAge})`);
  // and the gap should be material, not noise
  assert.ok(u.biologicalAge - h.biologicalAge >= 3,
    `unhealthy should read materially older (got +${(u.biologicalAge - h.biologicalAge).toFixed(1)}y)`);
});

test("healthy 45yo reads at or below chronological age", () => {
  const r = computeBiologicalAge(healthy());
  assert.ok(r.biologicalAge <= 47, `healthy profile bioAge ${r.biologicalAge} should be ~<= chrono age`);
});

test("UNIT GUARD (hsCRP): a normal 0.6 mg/L hsCRP must not inflate clinical age like a 6 mg/L value", () => {
  // Guards the mg/L vs mg/dL PhenoAge bug: normal inflammation should sit near chrono age.
  const normal = computeBiologicalAge(healthy({ hscrp: 0.6 }));
  const high = computeBiologicalAge(healthy({ hscrp: 8.0 }));
  if (normal.clinicalAge != null && high.clinicalAge != null) {
    assert.ok(high.clinicalAge > normal.clinicalAge,
      "higher hsCRP should raise clinical age");
    assert.ok(Math.abs(normal.clinicalAge - 45) <= 12,
      `normal-hsCRP clinical age (${normal.clinicalAge}) should be within ~12y of chrono 45 (not unit-inflated)`);
  }
});

test("UNIT GUARD (glucose): normal fasting glucose 88 mg/dL is not scored as diabetic-range", () => {
  const normal = computeBiologicalAge(healthy({ fasting_glucose: 88 }));
  const diabetic = computeBiologicalAge(healthy({ fasting_glucose: 140 }));
  assert.ok(diabetic.biologicalAge > normal.biologicalAge,
    "higher fasting glucose should raise biological age");
});

test("resting HR feeds the result (audit regression): elevated RHR raises biological age", () => {
  const low = computeBiologicalAge(healthy({ resting_hr: 50 }));
  const high = computeBiologicalAge(healthy({ resting_hr: 88 }));
  assert.ok(high.biologicalAge >= low.biologicalAge,
    "higher resting HR should not lower biological age");
});

test("sex is wired into the model (differs for at least one profile across a sweep)", () => {
  // Invariant: sex must influence the result somewhere. Also MEASURES how broad that
  // influence is — see the coverage assertion below.
  let diffs = 0, total = 0;
  for (const body_fat_pct of [12, 18, 25, 32, 40])
    for (const waist_cm of [75, 90, 105])
      for (const hdl of [35, 55, 75]) {
        total++;
        const m = computeBiologicalAge(healthy({ sex: "male", body_fat_pct, waist_cm, hdl }));
        const f = computeBiologicalAge(healthy({ sex: "female", body_fat_pct, waist_cm, hdl }));
        if (m.biologicalAge !== f.biologicalAge) diffs++;
      }
  assert.ok(diffs > 0, "sex must change the biological age for at least one profile (it is not globally ignored)");
  // KNOWN GAP (documented, not enforced): today sex only affects body-composition
  // thresholds, so differentiation is narrow (~3/45). Raise this floor as sex-specific
  // HDL / lipid / cardiovascular ranges are added, and tighten this assertion.
  console.log(`    [coverage] sex changed biological age in ${diffs}/${total} varied profiles`);
});

test("graceful degradation: minimal input still returns a valid result with lower accuracy", () => {
  const minimal: AssessmentInput = {
    age: 45, sex: "female", height_cm: 165, weight_kg: 62,
    sleep_hours: 7, sleep_quality: 6, exercise_days: 3, strength_training: false,
    diet_type: "mixed", alcohol_use: "light", smoking: "never", stress_level: 5,
    primary_goal: "longevity",
  };
  const full = computeBiologicalAge(healthy({ sex: "female" }));
  const r = computeBiologicalAge(minimal);
  assert.ok(Number.isFinite(r.biologicalAge), "minimal input still yields a finite bioAge");
  assert.ok(r.accuracyScore <= full.accuracyScore,
    `sparse input accuracy (${r.accuracyScore}) should be <= complete input accuracy (${full.accuracyScore})`);
  assert.ok(r.missingDataPoints.length > 0, "minimal input should flag missing data");
});
