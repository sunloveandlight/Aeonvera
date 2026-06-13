export type DataSourcePrompt = {
  title: string;
  body: string;
  actionLabel: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export type DataSourceSignal = {
  label: string;
  value: string;
  detail: string;
  status: "active" | "ready" | "stale" | "missing";
};

export type DataSourceIntelligence = {
  score: number;
  status: "excellent" | "strong" | "building" | "thin";
  headline: string;
  nextBestAction: string;
  prompts: DataSourcePrompt[];
  signals: DataSourceSignal[];
};

type WearableRow = {
  provider?: string | null;
  recorded_at?: string | null;
};

type LabRow = {
  canonical_key?: string | null;
  measured_at?: string | null;
};

type HealthStateLike = {
  updated_at?: string | null;
};

export function buildDataSourceIntelligence({
  appleRows,
  calendarConnected,
  connectedProviders,
  healthState,
  labRows,
  wearableRows,
}: {
  appleRows: WearableRow[];
  calendarConnected: boolean;
  connectedProviders: Iterable<string>;
  healthState: HealthStateLike | null;
  labRows: LabRow[];
  wearableRows: WearableRow[];
}): DataSourceIntelligence {
  const providers = new Set(connectedProviders);
  const latestWearableAt = latestDate(wearableRows.map((row) => row.recorded_at));
  const latestLabAt = latestDate(labRows.map((row) => row.measured_at));
  const healthStateAt = healthState?.updated_at || null;
  const labPanelDepth = new Set(labRows.map((row) => row.canonical_key).filter(Boolean)).size;

  const wearableFresh = latestWearableAt ? daysSince(latestWearableAt) <= 3 : false;
  const wearableStale = latestWearableAt ? daysSince(latestWearableAt) > 7 : false;
  const labFresh = latestLabAt ? daysSince(latestLabAt) <= 180 : false;
  const labThin = labPanelDepth < 8;
  const healthStateFresh = healthStateAt ? daysSince(healthStateAt) <= 7 : false;
  const hasWearableSource = providers.has("oura") || providers.has("whoop") || appleRows.length > 0;

  const score =
    (hasWearableSource ? 15 : 0) +
    (wearableFresh ? 20 : latestWearableAt ? 10 : 0) +
    (appleRows.length > 0 ? 12 : 0) +
    (labPanelDepth >= 8 ? 22 : labPanelDepth >= 4 ? 12 : 0) +
    (labFresh ? 8 : latestLabAt ? 4 : 0) +
    (healthStateFresh ? 15 : healthStateAt ? 8 : 0) +
    (calendarConnected ? 8 : 0);
  const normalizedScore = Math.min(100, score);

  const prompts: DataSourcePrompt[] = [];

  if (!hasWearableSource) {
    prompts.push({
      title: "Connect a live recovery source",
      body: "Aeonvera can reason better when sleep, HRV, resting heart rate, and activity are arriving automatically.",
      actionLabel: "Open Data Sources",
      href: "/data-sources",
      priority: "high",
    });
  } else if (wearableStale) {
    prompts.push({
      title: "Refresh wearable signal",
      body: `Your latest wearable signal is ${formatFreshness(latestWearableAt)}. Sync Oura or import Apple Health so today's plan uses current recovery data.`,
      actionLabel: "Refresh Signal",
      href: "/data-sources",
      priority: "high",
    });
  }

  if (labRows.length === 0) {
    prompts.push({
      title: "Add clinical labs",
      body: "Bloodwork gives Aeonvera the metabolic, inflammatory, hormonal, and cardiovascular context that wearables cannot see.",
      actionLabel: "Import Labs",
      href: "/data-sources",
      priority: "high",
    });
  } else if (labThin) {
    prompts.push({
      title: "Complete the biomarker panel",
      body: "Your lab layer is active but still narrow. Adding glucose, HbA1c, ApoB, hsCRP, hormones, thyroid, and vitamin D will sharpen recommendations.",
      actionLabel: "Add Biomarkers",
      href: "/data-sources",
      priority: "medium",
    });
  } else if (!labFresh) {
    prompts.push({
      title: "Update lab recency",
      body: "Your lab layer is useful, but fresh bloodwork makes clinical interpretation and biological age movement more reliable.",
      actionLabel: "Update Labs",
      href: "/data-sources",
      priority: "medium",
    });
  }

  if (!calendarConnected) {
    prompts.push({
      title: "Activate execution scheduling",
      body: "Calendar access lets Aeonvera move from insight into action by placing recovery, nutrition, and training blocks into real time.",
      actionLabel: "Connect Calendar",
      href: "/data-sources",
      priority: "medium",
    });
  }

  if (!healthStateFresh) {
    prompts.push({
      title: "Rebuild health state",
      body: "The unified health state needs current source depth before advanced protocols can become truly personalized.",
      actionLabel: "Refresh State",
      href: "/data-sources",
      priority: healthStateAt ? "medium" : "high",
    });
  }

  const status =
    normalizedScore >= 85
      ? "excellent"
      : normalizedScore >= 68
      ? "strong"
      : normalizedScore >= 40
      ? "building"
      : "thin";

  const headline =
    status === "excellent"
      ? "Your intelligence layer is running on current, multi-source signal."
      : status === "strong"
      ? "Your health model is strong, with a few signals worth tightening."
      : status === "building"
      ? "Aeonvera has enough signal to begin, but the model still has blind spots."
      : "Your intelligence layer needs more source depth before it can feel truly personal.";

  return {
    score: normalizedScore,
    status,
    headline,
    nextBestAction:
      prompts[0]?.body ||
      "Keep wearables, labs, and calendar connected so Aeonvera can detect changes before they become obvious.",
    prompts: prompts.slice(0, 4),
    signals: [
      {
        label: "Wearables",
        value: wearableRows.length ? `${wearableRows.length}` : hasWearableSource ? "Ready" : "Missing",
        detail: latestWearableAt ? `Latest ${formatFreshness(latestWearableAt)}` : "No wearable signal yet",
        status: wearableFresh ? "active" : latestWearableAt ? "stale" : hasWearableSource ? "ready" : "missing",
      },
      {
        label: "Apple Health",
        value: appleRows.length ? `${appleRows.length}` : "Ready",
        detail: appleRows.length ? "Imported into the health model" : "Export or screenshot can be added",
        status: appleRows.length ? "active" : "ready",
      },
      {
        label: "Clinical Labs",
        value: labRows.length ? `${labRows.length}` : "Missing",
        detail: latestLabAt ? `Latest ${formatFreshness(latestLabAt)}` : "No biomarkers imported",
        status: labRows.length && labFresh ? "active" : labRows.length ? "stale" : "missing",
      },
      {
        label: "Execution",
        value: calendarConnected ? "Active" : "Ready",
        detail: calendarConnected ? "Calendar connected" : "Calendar not connected",
        status: calendarConnected ? "active" : "ready",
      },
    ],
  };
}

export function formatFreshness(value?: string | null) {
  if (!value) return "not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not yet";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function latestDate(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
  );
}

function daysSince(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / 86400000;
}
