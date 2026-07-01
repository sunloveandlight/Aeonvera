import { expect, test } from "@playwright/test";

import { parseClinicalBiomarkerText } from "@/lib/labs/clinicalBiomarkers";
import { normalizeHealthMetrics } from "@/lib/metrics/normalizeHealthMetrics";
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

  test("parses biomarker values after label digits and normalizes clinical units", () => {
    const parsed = parseClinicalBiomarkerText([
      "25-OH vitamin D 100 nmol/L",
      "Fasting glucose 90 mg/dL",
      "hs-CRP 0.8 mg/L",
      "ApoB 0.9 g/L",
    ].join("\n"));
    const byKey = new Map(parsed.map((item) => [item.canonicalKey, item.value]));

    expect(byKey.get("vitamin_d")).toBeCloseTo(40.06, 1);
    expect(byKey.get("fasting_glucose")).toBe(5);
    expect(byKey.get("hscrp")).toBeCloseTo(0.08, 2);
    expect(byKey.get("apob")).toBe(90);
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
