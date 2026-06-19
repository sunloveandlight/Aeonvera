"use client";

import Link from "next/link";

type WearableProvider = "oura" | "whoop" | "apple";

type WearablesPanelProps = {
  wearableMessage: string | null;
  connectedProvidersCount: number;
  wearableRowsCount: number;
  latestWearableAt?: string | null;
  wearableSyncing: string | null;
  connectedProviderSet: Set<"oura" | "whoop">;
  applePayload: string;
  appleImportFileName: string | null;
  wearableRisk: Record<string, number>;
  wearableBaselines: Record<string, number>;
  firstInsight?: string;
  onApplePayloadChange: (value: string) => void;
  onAppleImportFileChange: (file: File | null) => void;
  onProviderAction: (provider: "oura" | "whoop") => void;
  onWearableSync: (provider: WearableProvider) => void;
};

export default function WearablesPanel({
  wearableMessage,
  connectedProvidersCount,
  wearableRowsCount,
  latestWearableAt,
  wearableSyncing,
  connectedProviderSet,
  applePayload,
  appleImportFileName,
  wearableRisk,
  wearableBaselines,
  firstInsight,
  onApplePayloadChange,
  onAppleImportFileChange,
  onProviderAction,
  onWearableSync,
}: WearablesPanelProps) {
  return (
    <div className="executive-panel rounded-lg p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="micro-label">Wearables</p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-white/80">
            Continuous health state
          </h2>
          <p className="mt-2 text-sm leading-7 text-white/45">
            Connect a device once, then let Aeonvera rebuild sleep, recovery,
            activity, and cardiovascular state as new data arrives.
          </p>
          {wearableMessage && (
            <p className="mt-3 text-sm leading-6 royal-text">{wearableMessage}</p>
          )}
          <Link
            href="/data-sources"
            className="premium-action-secondary mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em]"
          >
            Open Data Sources
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 text-right">
          <div>
            <p className="micro-label">Sources</p>
            <p className="mt-2 text-xl font-light text-white/78">
              {connectedProvidersCount}
            </p>
          </div>
          <div>
            <p className="micro-label">Metrics</p>
            <p className="mt-2 text-xl font-light text-white/78">
              {wearableRowsCount}
            </p>
          </div>
          <div>
            <p className="micro-label">Updated</p>
            <p className="mt-2 text-sm font-light text-white/60">
              {latestWearableAt
                ? new Date(latestWearableAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "None"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(["oura", "whoop"] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => onProviderAction(provider)}
            disabled={Boolean(wearableSyncing)}
            className="executive-panel-soft quiet-lift flex min-h-[20rem] cursor-pointer flex-col rounded-lg p-5 text-left disabled:cursor-not-allowed disabled:opacity-55"
          >
            <div className="flex-1">
              <p className="micro-label">
                {provider === "oura" ? "Oura Ring" : "WHOOP"}
              </p>
              <p className="mt-2 text-sm text-white/72">
                {wearableSyncing === provider
                  ? "Syncing..."
                  : connectedProviderSet.has(provider)
                  ? "Ready to sync"
                  : "Not connected"}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/45">
                {connectedProviderSet.has(provider)
                  ? "Pulls sleep, recovery, strain, and activity metrics into health state."
                  : "Starts secure OAuth authorization and stores refreshable sync credentials."}
              </p>
              {connectedProviderSet.has(provider) && (
                <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-white/38">
                  Connected
                </p>
              )}
            </div>
            <span
              className="premium-action mt-5 inline-flex w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em]"
            >
              {wearableSyncing === provider
                ? "Syncing"
                : connectedProviderSet.has(provider)
                ? "Sync Data"
                : "Connect"}
            </span>
          </button>
        ))}

        <div
          className={`executive-panel-soft quiet-lift flex min-h-[20rem] flex-col rounded-lg p-5 ${
            wearableSyncing ? "opacity-55" : ""
          }`}
        >
          <div className="flex-1">
            <p className="micro-label">Apple Health</p>
            <p className="mt-2 text-sm text-white/72">Ready to import</p>
            <p className="mt-2 text-xs leading-5 text-white/45">
              Paste JSON, upload an export file, or add a readable screenshot.
            </p>
            <textarea
              value={applePayload}
              onChange={(event) => onApplePayloadChange(event.target.value)}
              placeholder='{"records":[{"type":"HKQuantityTypeIdentifierStepCount","value":8400}]}'
              className="apple-health-input executive-input mt-4 h-28 w-full resize-none rounded-lg p-3 text-xs leading-5 placeholder:text-white/16"
            />
            <label className="mt-4 flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-xs text-white/50 transition hover:border-white/[0.16] hover:text-white/70">
              <span className="min-w-0 truncate">
                {appleImportFileName || "Upload file or picture"}
              </span>
              <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-white/30">
                Choose
              </span>
              <input
                type="file"
                accept="application/json,text/plain,text/csv,.json,.csv,.txt,image/png,image/jpeg,image/webp,image/heic,image/heif"
                className="sr-only"
                onChange={(event) =>
                  onAppleImportFileChange(event.target.files?.[0] || null)
                }
              />
            </label>
            {appleImportFileName && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAppleImportFileChange(null);
                }}
                className="mt-2 text-left text-[9px] uppercase tracking-[0.14em] text-white/28 transition hover:text-white/55"
              >
                Remove upload
              </button>
            )}
          </div>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onWearableSync("apple");
            }}
            disabled={Boolean(wearableSyncing)}
            className="premium-action mt-5 inline-flex w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {wearableSyncing === "apple" ? "Importing" : "Import Data"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ["Sleep", wearableRisk.sleep, wearableBaselines.sleep_hours ? `${wearableBaselines.sleep_hours}h` : "-"],
          ["Recovery", wearableRisk.recovery, wearableBaselines.recovery_score ?? "-"],
          ["Activity", wearableRisk.activity, wearableBaselines.daily_steps ? `${wearableBaselines.daily_steps}` : "-"],
          ["Metabolic", wearableRisk.metabolic, wearableBaselines.blood_glucose ?? "-"],
        ].map(([label, risk, baseline]) => (
          <div key={label} className="executive-panel-soft rounded-lg p-4">
            <p className="micro-label">{label}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-xl font-light text-white/78">
                {typeof risk === "number" ? risk : "-"}
              </p>
              <p className="text-xs text-white/40">{baseline}</p>
            </div>
            <div className="mt-3 h-px bg-white/[0.08]">
              <div
                className="living-bar"
                style={{ width: `${typeof risk === "number" ? risk : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {firstInsight && (
        <p className="mt-4 text-xs leading-6 text-white/45">{firstInsight}</p>
      )}
    </div>
  );
}
