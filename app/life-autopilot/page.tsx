"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  Droplets,
  Dumbbell,
  HeartPulse,
  Moon,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type AutopilotMode = "manual" | "suggest" | "approve" | "autopilot" | "sovereign";
type Intensity = "quiet" | "balanced" | "high_touch";
type MealRhythm = "two_meals" | "three_meals" | "protein_anchor" | "custom";
type MedicationBoundary = "never_medical" | "remind_only" | "clinician_supervised";

type ReminderDomains = {
  check_ins: boolean;
  fasting: boolean;
  food: boolean;
  hydration: boolean;
  recovery: boolean;
  sleep: boolean;
  sunlight: boolean;
  supplements: boolean;
  workouts: boolean;
};

type Preferences = {
  allow_check_ins: boolean;
  allow_nutrition_blocks: boolean;
  allow_recovery_blocks: boolean;
  allow_training_blocks: boolean;
  allowed_reminder_domains: ReminderDomains;
  auto_schedule_enabled: boolean;
  calendar_enabled: boolean;
  fasting_window_end: string;
  fasting_window_start: string;
  friction_tracking_enabled: boolean;
  hydration_target_ml: number;
  intensity: Intensity;
  meal_rhythm: MealRhythm;
  medication_boundary: MedicationBoundary;
  mode: AutopilotMode;
  notifications_enabled: boolean;
  quiet_hours_end: string;
  quiet_hours_start: string;
  sleep_window_end: string;
  sleep_window_start: string;
  streak_tracking_enabled: boolean;
  sunlight_target_minutes: number;
  supplement_reminders_enabled: boolean;
  timezone: string;
  training_days: string[];
  weekly_review_enabled: boolean;
};

type Recommendation = {
  detail: string;
  label: string;
  value: string;
};

type SovereignItem = {
  detail: string;
  label: string;
  status: string;
};

type Payload = {
  deliveries?: Array<{ channel: string; created_at: string; status: string; title: string }>;
  preferences: Preferences;
  recentPlan?: { plan_date?: string; status?: string; summary?: string } | null;
  recommendations?: Recommendation[];
  sovereign?: SovereignItem[];
};

const DEFAULT_PREFERENCES: Preferences = {
  allow_check_ins: true,
  allow_nutrition_blocks: true,
  allow_recovery_blocks: true,
  allow_training_blocks: true,
  allowed_reminder_domains: {
    check_ins: true,
    fasting: true,
    food: true,
    hydration: true,
    recovery: true,
    sleep: true,
    sunlight: true,
    supplements: false,
    workouts: true,
  },
  auto_schedule_enabled: false,
  calendar_enabled: true,
  fasting_window_end: "08:00",
  fasting_window_start: "20:00",
  friction_tracking_enabled: true,
  hydration_target_ml: 2500,
  intensity: "balanced",
  meal_rhythm: "three_meals",
  medication_boundary: "never_medical",
  mode: "approve",
  notifications_enabled: true,
  quiet_hours_end: "07:00",
  quiet_hours_start: "22:00",
  sleep_window_end: "07:00",
  sleep_window_start: "22:30",
  streak_tracking_enabled: true,
  sunlight_target_minutes: 20,
  supplement_reminders_enabled: false,
  timezone: "UTC",
  training_days: ["Mon", "Wed", "Fri"],
  weekly_review_enabled: true,
};

const BEHAVIOR_DOMAINS: Array<{
  detail: string;
  icon: LucideIcon;
  key: keyof ReminderDomains;
  label: string;
}> = [
  { key: "hydration", label: "Hydration", icon: Droplets, detail: "Water targets and gentle reminders." },
  { key: "food", label: "Food", icon: Utensils, detail: "Protein anchors and meal rhythm." },
  { key: "fasting", label: "Fasting", icon: CalendarClock, detail: "Eating window boundaries." },
  { key: "sunlight", label: "Sunlight", icon: SunMedium, detail: "Outdoor light and fresh air." },
  { key: "sleep", label: "Sleep", icon: Moon, detail: "Wind-down and bedtime protection." },
  { key: "workouts", label: "Workouts", icon: Dumbbell, detail: "Training days and movement blocks." },
  { key: "supplements", label: "Supplements", icon: ShieldCheck, detail: "Reminders only, never dosing advice." },
  { key: "recovery", label: "Recovery", icon: HeartPulse, detail: "Stress, breath, mobility, HRV protection." },
  { key: "check_ins", label: "Check-ins", icon: Bell, detail: "Body weight, symptoms, HRV, labs." },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LifeAutopilotPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) window.location.href = "/login?mode=signin";
          return;
        }

        const response = await fetch("/api/autopilot/preferences", {
          credentials: "include",
        });
        const data = await response.json();

        if (response.status === 403) {
          if (!cancelled) {
            setLocked(true);
            setMessage(data.error || "Life Autopilot is locked.");
          }
          return;
        }

        if (!response.ok) throw new Error(data.error || "Could not load Life Autopilot.");

        if (!cancelled) {
          setPayload(data);
          setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load Life Autopilot.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeDomainCount = useMemo(
    () => Object.values(preferences.allowed_reminder_domains).filter(Boolean).length,
    [preferences.allowed_reminder_domains]
  );

  async function save(nextPreferences = preferences) {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/autopilot/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPreferences),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not save Life Autopilot.");

      setPayload((current) => ({
        ...(current || {}),
        preferences: data.preferences,
        recommendations: data.recommendations,
        sovereign: data.sovereign,
      }));
      setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
      setMessage("Life Autopilot saved. Coach delivery and notification preferences are now unified.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Life Autopilot.");
    } finally {
      setSaving(false);
    }
  }

  function update(patch: Partial<Preferences>) {
    setPreferences((current) => ({ ...current, ...patch }));
  }

  function toggleDomain(key: keyof ReminderDomains) {
    setPreferences((current) => {
      const domains = {
        ...current.allowed_reminder_domains,
        [key]: !current.allowed_reminder_domains[key],
      };

      return {
        ...current,
        allowed_reminder_domains: domains,
        allow_check_ins: domains.check_ins,
        allow_nutrition_blocks:
          domains.food || domains.fasting || domains.hydration || domains.supplements,
        allow_recovery_blocks: domains.sleep || domains.recovery,
        allow_training_blocks: domains.workouts,
        supplement_reminders_enabled:
          key === "supplements" ? !current.allowed_reminder_domains.supplements : current.supplement_reminders_enabled,
      };
    });
  }

  function toggleTrainingDay(day: string) {
    setPreferences((current) => {
      const exists = current.training_days.includes(day);
      const training_days = exists
        ? current.training_days.filter((item) => item !== day)
        : [...current.training_days, day];
      return { ...current, training_days };
    });
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="py-16">
          <AccessState
            eyebrow="Life Autopilot"
            title="Loading your behavior operating system."
            body="Aeonvera is reading your coach delivery, quiet hours, reminders, and schedule permissions."
            actions={[]}
          />
        </div>
      </PageContainer>
    );
  }

  if (locked) {
    return (
      <PageContainer>
        <div className="py-16">
          <AccessState
            eyebrow="Life Autopilot"
            title="Unlock proactive behavior orchestration."
            body={message || "Life Autopilot is available on Elite and Sovereign."}
            points={[
              "Hydration, food, fasting, sunlight, sleep, training, and recovery reminders",
              "Unified coach notification intensity and quiet hours",
              "Approval-based calendar scheduling",
            ]}
            actions={[
              { href: "/pricing", label: "Compare plans" },
              { href: "/login?mode=signin", label: "Sign in", variant: "secondary" },
            ]}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="py-16">
        <section className="mb-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="executive-panel rounded-lg p-6 md:p-8">
            <p className="micro-label">Life Autopilot</p>
            <h1 className="life-autopilot-title mt-4 max-w-4xl font-semibold text-white">
              The operating layer for your biological future.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/50">
              Tell Aeonvera what it is allowed to remind you about, when to stay quiet,
              and how aggressively it should align your day. The coach turns this into
              daily action without becoming spammy.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? "Saving" : "Save Autopilot"}
                {!saving ? <ArrowRight size={15} /> : null}
              </button>
              <Link
                href="/plan"
                className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
              >
                View today’s plan
              </Link>
            </div>
            {message ? <p className="mt-4 text-sm leading-6 royal-text">{message}</p> : null}
          </div>

          <div className="executive-panel rounded-lg p-6 md:p-7">
            <p className="micro-label">Operating Mode</p>
            <div className="mt-5 space-y-3">
              <Segment
                active={preferences.intensity}
                items={[
                  ["quiet", "Quiet"],
                  ["balanced", "Balanced"],
                  ["high_touch", "High touch"],
                ]}
                onChange={(value) => update({
                  intensity: value as Intensity,
                  notifications_enabled: value !== "quiet",
                })}
              />
              <Segment
                active={preferences.mode}
                items={[
                  ["manual", "Manual"],
                  ["approve", "Approve"],
                  ["autopilot", "Autopilot"],
                  ["sovereign", "Sovereign"],
                ]}
                onChange={(value) => update({
                  mode: value as AutopilotMode,
                  auto_schedule_enabled: value === "autopilot" || value === "sovereign",
                })}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Active domains" value={String(activeDomainCount)} />
              <Metric label="Quiet hours" value={`${preferences.quiet_hours_start}-${preferences.quiet_hours_end}`} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <Panel title="Coach Intensity & Notifications" icon={Bell}>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleCard
                  active={preferences.notifications_enabled}
                  label="Coach notifications"
                  detail="Syncs to real email, push, and in-app delivery preferences."
                  onClick={() => update({ notifications_enabled: !preferences.notifications_enabled })}
                />
                <ToggleCard
                  active={preferences.calendar_enabled}
                  label="Calendar execution"
                  detail="Allow Aeonvera to prepare or schedule blocks based on your mode."
                  onClick={() => update({ calendar_enabled: !preferences.calendar_enabled })}
                />
                <ToggleCard
                  active={preferences.weekly_review_enabled}
                  label="Weekly review"
                  detail="What changed in your body this week, what worked, and what slipped."
                  onClick={() => update({ weekly_review_enabled: !preferences.weekly_review_enabled })}
                />
                <ToggleCard
                  active={preferences.streak_tracking_enabled}
                  label="Streak tracking"
                  detail="Track adherence without making the product feel punitive."
                  onClick={() => update({ streak_tracking_enabled: !preferences.streak_tracking_enabled })}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <TimeInput label="Quiet start" value={preferences.quiet_hours_start} onChange={(value) => update({ quiet_hours_start: value })} />
                <TimeInput label="Quiet end" value={preferences.quiet_hours_end} onChange={(value) => update({ quiet_hours_end: value })} />
                <TextInput label="Timezone" value={preferences.timezone} onChange={(value) => update({ timezone: value })} />
              </div>
            </Panel>

            <Panel title="Behavior Boundaries" icon={ShieldCheck}>
              <div className="grid gap-3">
                <SelectInput
                  label="Medication boundary"
                  value={preferences.medication_boundary}
                  options={[
                    ["never_medical", "Never give medication guidance"],
                    ["remind_only", "Remind only"],
                    ["clinician_supervised", "Clinician-supervised only"],
                  ]}
                  onChange={(value) => update({ medication_boundary: value as MedicationBoundary })}
                />
                <SelectInput
                  label="Meal rhythm"
                  value={preferences.meal_rhythm}
                  options={[
                    ["two_meals", "Two meals"],
                    ["three_meals", "Three meals"],
                    ["protein_anchor", "Protein anchors"],
                    ["custom", "Custom rhythm"],
                  ]}
                  onChange={(value) => update({ meal_rhythm: value as MealRhythm })}
                />
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel title="Behavior Orchestration" icon={Sparkles}>
              <div className="grid gap-3 sm:grid-cols-2">
                {BEHAVIOR_DOMAINS.map(({ detail, icon: Icon, key, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={preferences.allowed_reminder_domains[key]}
                    onClick={() => toggleDomain(key)}
                    className={`av-control-card rounded-lg border p-4 text-left transition ${
                      preferences.allowed_reminder_domains[key]
                        ? "av-control-card-active border-[rgba(var(--gold),0.26)] bg-[rgba(var(--gold),0.07)]"
                        : "border-white/[0.07] bg-white/[0.025]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <Icon size={17} className="mt-0.5 royal-text" />
                        <div>
                          <p className="text-sm text-white/80">{label}</p>
                          <p className="mt-1 text-xs leading-5 text-white/40">{detail}</p>
                        </div>
                      </div>
                      {preferences.allowed_reminder_domains[key] ? <Check size={15} className="royal-text" /> : null}
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Daily Rhythm" icon={CalendarClock}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TimeInput label="Fast starts" value={preferences.fasting_window_start} onChange={(value) => update({ fasting_window_start: value })} />
                <TimeInput label="Fast ends" value={preferences.fasting_window_end} onChange={(value) => update({ fasting_window_end: value })} />
                <TimeInput label="Sleep starts" value={preferences.sleep_window_start} onChange={(value) => update({ sleep_window_start: value })} />
                <TimeInput label="Wake target" value={preferences.sleep_window_end} onChange={(value) => update({ sleep_window_end: value })} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <NumberInput label="Hydration target ml" value={preferences.hydration_target_ml} onChange={(value) => update({ hydration_target_ml: value })} />
                <NumberInput label="Sunlight minutes" value={preferences.sunlight_target_minutes} onChange={(value) => update({ sunlight_target_minutes: value })} />
              </div>
              <div className="mt-4">
                <p className="micro-label mb-3">Training days</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={preferences.training_days.includes(day)}
                      onClick={() => toggleTrainingDay(day)}
                      className={`av-control-card h-9 rounded-md border px-3 text-xs font-semibold transition ${
                        preferences.training_days.includes(day)
                          ? "av-control-card-active border-[rgba(var(--gold),0.26)] bg-[rgba(var(--gold),0.08)] royal-text"
                          : "border-white/[0.07] bg-white/[0.025] text-white/42"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel title="Retention Loop" icon={HeartPulse}>
            <div className="grid gap-3 sm:grid-cols-3">
              {(payload?.recommendations || []).map((item) => (
                <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                  <p className="micro-label">{item.label}</p>
                  <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-xs leading-5 text-white/42">{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-white/45">
              Aeonvera will use daily one-move focus, streak tracking, friction tracking,
              weekly review, and body-change summaries as the core retention loop.
            </p>
          </Panel>

          <Panel title="Sovereign White-Glove Layer" icon={Sparkles}>
            <div className="grid gap-3">
              {(payload?.sovereign || []).map((item) => (
                <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/78">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/42">{item.detail}</p>
                    </div>
                    <span className="av-eyebrow rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-white/42">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </PageContainer>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <p className="micro-label">Aeonvera</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
        </div>
        <Icon size={22} className="royal-text" />
      </div>
      {children}
    </section>
  );
}

function Segment({
  active,
  items,
  onChange,
}: {
  active: string;
  items: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] p-1">
      {items.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={active === value}
          onClick={() => onChange(value)}
          className={`av-control-card min-h-9 rounded-md border px-3 text-xs font-semibold transition ${
            active === value
              ? "av-control-card-active border-[rgba(var(--gold),0.26)] bg-[rgba(var(--gold),0.08)]"
              : "border-white/[0.07] bg-white/[0.025] text-white/42"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ToggleCard({
  active,
  detail,
  label,
  onClick,
}: {
  active: boolean;
  detail: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`av-control-card rounded-lg border p-4 text-left transition ${
        active
          ? "av-control-card-active border-[rgba(var(--gold),0.26)] bg-[rgba(var(--gold),0.07)]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/80">{label}</p>
          <p className="mt-1 text-xs leading-5 text-white/40">{detail}</p>
        </div>
        {active ? <Check size={15} className="royal-text" /> : null}
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
      <p className="micro-label">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function TimeInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="micro-label mb-2 block">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/72 focus:border-[rgba(var(--gold),0.45)] focus:outline-none"
      />
    </label>
  );
}

function TextInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="micro-label mb-2 block">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/72 focus:border-[rgba(var(--gold),0.45)] focus:outline-none"
      />
    </label>
  );
}

function NumberInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="block">
      <span className="micro-label mb-2 block">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/72 focus:border-[rgba(var(--gold),0.45)] focus:outline-none"
      />
    </label>
  );
}

function SelectInput({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="block">
      <span className="micro-label mb-2 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-white/[0.08] bg-black/40 px-3 text-sm text-white/72 focus:border-[rgba(var(--gold),0.45)] focus:outline-none"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
