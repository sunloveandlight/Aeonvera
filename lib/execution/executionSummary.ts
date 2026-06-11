type OutcomeRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  notes?: string | null;
  measured_at?: string | null;
  created_at?: string | null;
};

type CalendarEventRow = {
  action?: string | null;
  action_scope?: string | null;
  recurrence?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type ExecutionPattern = {
  label: string;
  count: number;
  actions: string[];
};

export type ExecutionSummary = {
  score: number;
  total: number;
  completed: number;
  skipped: number;
  deferred: number;
  scheduled: number;
  weekStart: string;
  weekEnd: string;
  status: "building" | "needs_attention" | "steady" | "strong";
  headline: string;
  topSkippedPattern: ExecutionPattern | null;
  skippedPatterns: ExecutionPattern[];
  calendarBlocks: CalendarEventRow[];
};

export function getExecutionWindow(now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function buildExecutionSummary({
  calendarEvents,
  outcomes,
  now = new Date(),
}: {
  calendarEvents: CalendarEventRow[];
  outcomes: OutcomeRow[];
  now?: Date;
}): ExecutionSummary {
  const window = getExecutionWindow(now);
  const recentOutcomes = outcomes.filter((outcome) =>
    isInsideWindow(outcome.measured_at || outcome.created_at, window.start, window.end)
  );
  const recentCalendarEvents = calendarEvents.filter((event) =>
    isInsideWindow(event.scheduled_for || event.created_at, window.start, window.end)
  );
  const completed = recentOutcomes.filter((outcome) => isSuccess(outcome)).length;
  const skipped = recentOutcomes.filter((outcome) => isSkipped(outcome)).length;
  const deferred = recentOutcomes.filter((outcome) => isDeferred(outcome)).length;
  const total = completed + skipped + deferred;
  const score = total ? Math.round((completed / total) * 100) : 0;
  const skippedPatterns = buildSkippedPatterns(recentOutcomes);

  return {
    score,
    total,
    completed,
    skipped,
    deferred,
    scheduled: recentCalendarEvents.length,
    weekStart: window.startIso,
    weekEnd: window.endIso,
    status: getExecutionStatus(score, total),
    headline: getExecutionHeadline({
      completed,
      deferred,
      scheduled: recentCalendarEvents.length,
      score,
      skipped,
      total,
    }),
    topSkippedPattern: skippedPatterns[0] || null,
    skippedPatterns,
    calendarBlocks: recentCalendarEvents.slice(0, 8),
  };
}

function isInsideWindow(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
}

function isSuccess(outcome: OutcomeRow) {
  return outcome.outcome === "success" || outcome.success === true;
}

function isSkipped(outcome: OutcomeRow) {
  return outcome.outcome === "failure" || /skipped/i.test(outcome.notes || "");
}

function isDeferred(outcome: OutcomeRow) {
  return outcome.outcome === "unknown" || /rescheduled|later|deferred/i.test(outcome.notes || "");
}

function buildSkippedPatterns(outcomes: OutcomeRow[]) {
  const groups = outcomes
    .filter(isSkipped)
    .reduce<Record<string, ExecutionPattern>>((current, outcome) => {
      const label = normalizePatternLabel(outcome);
      const existing = current[label] || { label, count: 0, actions: [] };
      existing.count += 1;

      if (outcome.action && !existing.actions.includes(outcome.action)) {
        existing.actions.push(outcome.action);
      }

      current[label] = existing;
      return current;
    }, {});

  return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 5);
}

function normalizePatternLabel(outcome: OutcomeRow) {
  const domain = outcome.domain?.trim();
  if (domain) return domain;

  const action = outcome.action?.toLowerCase() || "";
  if (/sleep|bed|wake/.test(action)) return "Sleep";
  if (/strength|resistance|zone 2|workout|training|walk/.test(action)) return "Training";
  if (/meal|nutrition|protein|glucose/.test(action)) return "Nutrition";
  if (/lab|blood|biomarker|measure|track|check/.test(action)) return "Check-ins";
  return "Optimization";
}

function getExecutionStatus(score: number, total: number): ExecutionSummary["status"] {
  if (!total) return "building";
  if (score < 50) return "needs_attention";
  if (score < 80) return "steady";
  return "strong";
}

function getExecutionHeadline({
  completed,
  deferred,
  scheduled,
  score,
  skipped,
  total,
}: {
  completed: number;
  deferred: number;
  scheduled: number;
  score: number;
  skipped: number;
  total: number;
}) {
  if (!total && !scheduled) {
    return "Start completing protocol actions to build an execution score.";
  }

  if (!total && scheduled) {
    return `${scheduled} calendar block${scheduled === 1 ? "" : "s"} scheduled. Completion signals are next.`;
  }

  if (score >= 80) {
    return `${completed} completed this week. Execution is becoming a strength.`;
  }

  if (skipped > completed) {
    return `${skipped} skipped this week. Aeonvera should simplify the plan.`;
  }

  if (deferred) {
    return `${deferred} deferred this week. Timing may need adjustment.`;
  }

  return `${score}% adherence this week across ${total} action${total === 1 ? "" : "s"}.`;
}
