/**
 * Aeonvera — Behavior Memory Engine (V1)
 * --------------------------------------
 * Tracks whether recommendations actually work.
 */

export type BehaviorEvent = {
  userId: string;
  eventType:
    | "viewed_recommendation"
    | "followed_recommendation"
    | "ignored_recommendation"
    | "manual_action";
  source?: string;
  reference?: string;
  value?: any;
  outcome?: any;
  timestamp: string;
};

export type BehaviorInsight = {
  pattern: string;
  confidence: number;
  impact: "positive" | "negative" | "neutral";
};

/**
 * MAIN ENTRY
 */
export function analyzeBehavior(
  events: BehaviorEvent[]
): BehaviorInsight[] {
  if (!events.length) return [];

  const insights: BehaviorInsight[] = [];

  const followRate = computeFollowRate(events);

  const sleepImpact = computeDomainImpact(events, "sleep");

  if (followRate < 0.4) {
    insights.push({
      pattern: "Low adherence to recommendations",
      confidence: 0.8,
      impact: "negative",
    });
  }

  if (sleepImpact > 0.2) {
    insights.push({
      pattern: "Sleep interventions are effective",
      confidence: 0.75,
      impact: "positive",
    });
  }

  if (sleepImpact < -0.2) {
    insights.push({
      pattern: "Sleep recommendations are ineffective or misaligned",
      confidence: 0.7,
      impact: "negative",
    });
  }

  return insights;
}

/**
 * FOLLOW RATE = adherence signal
 */
function computeFollowRate(events: BehaviorEvent[]) {
  const total = events.filter(
    (e) => e.eventType === "viewed_recommendation"
  ).length;

  const followed = events.filter(
    (e) => e.eventType === "followed_recommendation"
  ).length;

  if (total === 0) return 0;

  return followed / total;
}

/**
 * DOMAIN IMPACT ANALYSIS (V1 SIMPLE CORRELATION)
 */
function computeDomainImpact(
  events: BehaviorEvent[],
  domain: string
): number {
  const relevant = events.filter((e) =>
    e.reference?.includes(domain)
  );

  const followed = relevant.filter(
    (e) => e.eventType === "followed_recommendation"
  );

  const ignored = relevant.filter(
    (e) => e.eventType === "ignored_recommendation"
  );

  return (followed.length - ignored.length) / (relevant.length || 1);
}