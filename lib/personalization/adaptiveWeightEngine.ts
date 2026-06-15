/**
 * Aeonvera — Adaptive Weight Engine (V1)
 * --------------------------------------
 * Adjusts coaching priorities based on behavior feedback.
 */

export type AdaptiveWeight = {
  domain: string;
  weight: number; // 0.0 - 2.0
  confidence: number;
};

export type BehaviorEvent = {
  userId: string;
  eventType: string;
  reference?: string;
  outcome?: {
    success?: boolean;
  } | null;
  timestamp: string;
};

/**
 * MAIN ENTRY
 */
export function computeAdaptiveWeights(
  events: BehaviorEvent[]
): AdaptiveWeight[] {
  if (!events.length) {
    return defaultWeights();
  }

  const domains = ["sleep", "recovery", "activity", "nutrition"];

  const weights: AdaptiveWeight[] = [];

  for (const domain of domains) {
    const domainEvents = filterByDomain(events, domain);

    const followRate = computeFollowRate(domainEvents);
    const outcomeScore = computeOutcomeScore(domainEvents);

    const rawWeight = followRate * 0.6 + outcomeScore * 0.4;

    weights.push({
      domain,
      weight: clamp(0.5 + rawWeight, 0.2, 2.0),
      confidence: Math.min(1, domainEvents.length / 10),
    });
  }

  return weights;
}

/**
 * FOLLOW RATE
 */
function computeFollowRate(events: BehaviorEvent[]) {
  const total = events.filter(
    (e) => e.eventType === "viewed_recommendation"
  ).length;

  const followed = events.filter(
    (e) => e.eventType === "followed_recommendation"
  ).length;

  if (total === 0) return 0.5;

  return followed / total;
}

/**
 * OUTCOME SCORE (simple proxy signal)
 */
function computeOutcomeScore(events: BehaviorEvent[]) {
  const positive = events.filter(
    (e) => e.outcome?.success === true
  ).length;

  const total = events.length;

  if (total === 0) return 0.5;

  return positive / total;
}

/**
 * FILTER DOMAIN
 */
function filterByDomain(events: BehaviorEvent[], domain: string) {
  return events.filter((e) =>
    e.reference?.includes(domain)
  );
}

/**
 * DEFAULT WEIGHTS (cold start)
 */
function defaultWeights(): AdaptiveWeight[] {
  return [
    { domain: "sleep", weight: 1.0, confidence: 0 },
    { domain: "recovery", weight: 1.0, confidence: 0 },
    { domain: "activity", weight: 1.0, confidence: 0 },
    { domain: "nutrition", weight: 1.0, confidence: 0 },
  ];
}

/**
 * UTILITY
 */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
