import { expect, test } from "@playwright/test";

import { parseClinicalBiomarkerText } from "@/lib/labs/clinicalBiomarkers";
import { buildLabTrends } from "@/lib/labs/labTrends";
import { normalizeBiologicalAgeInputValue } from "@/lib/labs/latestLabInputs";
import { normalizeHealthMetrics } from "@/lib/metrics/normalizeHealthMetrics";
import { sanitizeCareRole } from "@/lib/care-network/rolePermissions";
import {
  createShareAccessCode,
  hashShareAccessCode,
  verifyShareAccessCode,
} from "@/lib/security/shareAccess";
import { decryptToken, encryptToken } from "@/lib/security/tokenCrypto";
import { fetchOuraMetrics } from "@/lib/wearables/oura";
import { fetchWhoopMetrics } from "@/lib/wearables/whoop";

test.describe("high-impact launch fixes", () => {
  test("encrypts OAuth tokens without breaking legacy plaintext reads", () => {
    const encrypted = encryptToken("secret-access-token");

    expect(encrypted).not.toBe("secret-access-token");
    expect(encrypted.startsWith("av1:")).toBe(true);
    expect(decryptToken(encrypted)).toBe("secret-access-token");
    expect(decryptToken("legacy-plaintext-token")).toBe("legacy-plaintext-token");
  });

  test("requires a dedicated production OAuth token encryption key", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken("secret-access-token")).toThrow(
        "Production OAuth token encryption requires OAUTH_TOKEN_ENCRYPTION_KEY."
      );
    } finally {
      Object.assign(process.env, { NODE_ENV: originalNodeEnv });
      if (originalKey) {
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY = originalKey;
      } else {
        delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
      }
    }
  });

  test("fails closed for ambiguous care roles and missing PHI share hashes", () => {
    expect(sanitizeCareRole("coach")).toBe("coach");
    expect(sanitizeCareRole("unexpected")).toBe("family");

    const code = createShareAccessCode();
    const hash = hashShareAccessCode(code);

    expect(verifyShareAccessCode(code, hash)).toBe(true);
    expect(verifyShareAccessCode(code, null)).toBe(false);
  });

  test("parses biomarker values after label digits and normalizes clinical units", () => {
    const parsed = parseClinicalBiomarkerText([
      "25-OH vitamin D 100 nmol/L",
      "Fasting glucose 90 mg/dL",
      "hs-CRP 0.8 mg/L",
      "ApoB 0.9 g/L",
    ].join("\n"));
    const byKey = new Map(parsed.map((item) => [item.canonicalKey, item.value]));
    const unitsByKey = new Map(parsed.map((item) => [item.canonicalKey, item.unit]));

    expect(byKey.get("vitamin_d")).toBeCloseTo(40.06, 1);
    expect(byKey.get("fasting_glucose")).toBe(5);
    expect(byKey.get("hscrp")).toBeCloseTo(0.08, 2);
    expect(byKey.get("apob")).toBe(90);
    expect(unitsByKey.get("fasting_glucose")).toBe("mmol/L");
    expect(unitsByKey.get("hscrp")).toBe("mg/dL");

    expect(normalizeBiologicalAgeInputValue("fasting_glucose", 5)).toBe(90);
    expect(normalizeBiologicalAgeInputValue("hscrp", 0.08)).toBeCloseTo(0.8, 2);
  });

  test("displays lab trends in familiar clinical units", () => {
    const trends = buildLabTrends([
      {
        canonical_key: "fasting_glucose",
        measured_at: "2026-07-01T00:00:00.000Z",
        unit: "mmol/L",
        value: 5,
      },
      {
        canonical_key: "hscrp",
        measured_at: "2026-07-01T00:00:00.000Z",
        unit: "mg/dL",
        value: 0.08,
      },
    ]);

    const byKey = new Map(trends.map((trend) => [trend.canonicalKey, trend]));

    expect(byKey.get("fasting_glucose")?.latestValue).toBe(90);
    expect(byKey.get("fasting_glucose")?.unit).toBe("mg/dL");
    expect(byKey.get("hscrp")?.latestValue).toBe(0.8);
    expect(byKey.get("hscrp")?.unit).toBe("mg/L");
  });

  test("reads Oura sleep duration from the sleep collection and avoids strain collision", async () => {
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/sleep")
        ? { data: [{ day: "2026-07-01", total_sleep_duration: 25_200, efficiency: 91 }] }
        : url.includes("/daily_sleep")
        ? { data: [{ day: "2026-07-01", contributors: { sleep_efficiency: 89 } }] }
        : url.includes("/daily_readiness")
        ? { data: [{ day: "2026-07-01", score: 77 }] }
        : { data: [{ day: "2026-07-01", score: 82, steps: 9500 }] };

      return Response.json(body);
    };

    try {
      const metrics = await fetchOuraMetrics({
        accessToken: "token",
        endDate: "2026-07-01",
        startDate: "2026-07-01",
      });

      expect(metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ metricName: "sleep_duration", value: 7 }),
          expect.objectContaining({ metricName: "sleep_efficiency", value: 91 }),
          expect.objectContaining({ metricName: "activity_score", value: 82 }),
        ])
      );

      const normalized = normalizeHealthMetrics(metrics.map((metric) => ({
        metricName: metric.metricName,
        source: "oura",
        timestamp: metric.timestamp,
        userId: "user",
        value: metric.value,
      })));

      expect(normalized).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ metric: "sleep_hours", value: 7 }),
          expect.objectContaining({ metric: "recovery_score", value: 82 }),
        ])
      );
      expect(normalized.some((metric) => metric.metric === "strain_score")).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("uses WHOOP asleep time instead of time in bed", async () => {
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/activity/sleep")
        ? {
            records: [{
              end: "2026-07-01T08:00:00.000Z",
              score: {
                stage_summary: {
                  total_awake_time_milli: 3_600_000,
                  total_in_bed_time_milli: 28_800_000,
                },
              },
            }],
          }
        : url.includes("/recovery")
        ? { records: [] }
        : { records: [] };

      return Response.json(body);
    };

    try {
      const metrics = await fetchWhoopMetrics({
        accessToken: "token",
        endDate: "2026-07-01",
        startDate: "2026-07-01",
      });

      expect(metrics).toEqual([
        expect.objectContaining({ metricName: "sleep", value: 7 }),
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
