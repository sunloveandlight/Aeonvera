"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Brain,
  CalendarClock,
  Dna,
  MessageCircle,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import NotificationPreferencesPanel from "@/components/dashboard/NotificationPreferencesPanel";
import { supabase } from "@/lib/supabase/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

type TwinPayload = {
  intelligence?: {
    summary: string;
    modelState: string;
    confidence: number;
    nextMove: {
      title: string;
      detail: string;
      href: string;
    };
  };
  counts?: Record<string, number>;
};

type ProtocolAction = {
  domain?: string;
  action?: string;
  why?: string;
  cadence?: string;
  impact?: "low" | "medium" | "high";
};

type ActionScope = "today" | "week" | "check_in" | "later";

type Protocol = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  status?: string | null;
  created_at?: string;
  protocol?: {
    summary?: string;
    primary_protocol?: ProtocolAction[];
    coach_message?: string;
  } | null;
};

type CoachMessage = {
  id: string;
  title: string;
  message: string;
  created_at?: string;
};

type CalendarStatus = {
  connected: boolean;
  migrationRequired?: boolean;
  message?: string;
  connection?: {
    provider: string;
    status: string;
    calendar_id?: string;
    connected_at?: string;
  } | null;
};

type ExecutionSummary = {
  score: number;
  total: number;
  completed: number;
  skipped: number;
  deferred: number;
  scheduled: number;
  status: "building" | "needs_attention" | "steady" | "strong";
  headline: string;
  topSkippedPattern?: {
    label: string;
    count: number;
    actions: string[];
  } | null;
  skippedPatterns: Array<{
    label: string;
    count: number;
    actions: string[];
  }>;
};

type CoachMemory = {
  communicationStyle: "encouraging" | "accountability" | "direct" | "balanced";
  motivationProfile?: {
    primaryDriver?: string;
    needs?: string;
    toneReason?: string;
  };
  failurePatterns?: Array<{
    label: string;
    count: number;
    actions: string[];
  }>;
  bestInterventions?: Array<{
    domain: string;
    action: string;
    successCount: number;
  }>;
  domainScores?: Record<string, number>;
  morningBrief?: string;
  confidence?: number;
};

type DailyBrief = {
  title: string;
  message: string;
  href: string;
  healthPriority: string;
  behaviorPriority: string;
  calendarPriority: string;
  primaryAction: string;
  confidence: number;
  style: string;
};

type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentAppliedAction = {
  type: string;
  label: string;
  detail: string;
};

type AgentSendOptions = {
  clinicalFollowUpAnswer?: boolean;
  clinicalInsightId?: string;
};

type ClinicalInsight = {
  id: string;
  source_question?: string | null;
  answer_summary?: string | null;
  domains?: string[] | null;
  concern_status?: "active" | "improving" | "unresolved" | "dismissed" | "monitoring" | null;
  confidence?: number | string | null;
  range_flags?: Array<{
    marker?: string;
    value?: string;
    status?: string;
  }> | null;
  follow_up_questions?: string[] | null;
  recommended_actions?: ProtocolAction[] | null;
  metadata?: {
    follow_up_responses?: Array<{
      answer?: string;
      answered_at?: string;
      interpreted_status?: string;
      question?: string;
    }>;
    progression?: {
      status?: string;
      summary?: string;
      repeatedDomains?: string[];
      newDomains?: string[];
      priorInsightCount?: number;
      lastSeenAt?: string | null;
    };
  } | null;
  created_at?: string | null;
};

export default function CompanionPage() {
  const router = useRouter();
  const clinicalPanelRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [twin, setTwin] = useState<TwinPayload | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);
  const [coachMemory, setCoachMemory] = useState<CoachMemory | null>(null);
  const [clinicalInsights, setClinicalInsights] = useState<ClinicalInsight[]>([]);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me why Aeonvera chose today’s focus, what should change, or how to make the plan fit your real life.",
    },
  ]);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentActions, setAgentActions] = useState<AgentAppliedAction[]>([]);
  const [clinicalAnswer, setClinicalAnswer] = useState("");
  const [answeringClinicalInsightId, setAnsweringClinicalInsightId] = useState<string | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState([
    "Why this plan today?",
    "What should I do first?",
    "Make today simpler.",
  ]);
  const [agentThinking, setAgentThinking] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [schedulingCalendar, setSchedulingCalendar] = useState(false);
  const [schedulingActionKey, setSchedulingActionKey] = useState<string | null>(null);
  const [savingOutcomeKey, setSavingOutcomeKey] = useState<string | null>(null);
  const [scheduledActionKeys, setScheduledActionKeys] = useState<Record<string, boolean>>({});
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState(() => getInstallState());

  useEffect(() => {
    let cancelled = false;

    async function loadCompanion() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?mode=signin");
        return;
      }

      try {
        const [
          twinResponse,
          protocolResponse,
          coachResponse,
          calendarResponse,
          executionResponse,
          memoryResponse,
          dailyBriefResponse,
          clinicalMemoryResponse,
        ] = await Promise.all([
          fetch("/api/digital-twin/timeline", { credentials: "include" }),
          fetch("/api/optimization/protocols", { credentials: "include" }),
          fetch("/api/notifications/deliveries", { credentials: "include" }),
          fetch("/api/calendar/google/status", { credentials: "include" }),
          fetch("/api/execution/summary", { credentials: "include" }),
          fetch("/api/coach/memory", { credentials: "include" }),
          fetch("/api/coach/daily-brief", { credentials: "include" }),
          fetch("/api/clinical/insights", { credentials: "include" }),
        ]);
        const [
          twinData,
          protocolData,
          coachData,
          calendarData,
          executionData,
          memoryData,
          dailyBriefData,
          clinicalMemoryData,
        ] = await Promise.all([
          twinResponse.json(),
          protocolResponse.json(),
          coachResponse.json(),
          calendarResponse.json(),
          executionResponse.json(),
          memoryResponse.json(),
          dailyBriefResponse.json(),
          clinicalMemoryResponse.json(),
        ]);

        if (!twinResponse.ok) throw new Error(twinData.error || "Companion could not load.");

        if (!cancelled) {
          setTwin(twinData);
          setProtocols(protocolData.protocols || []);
          setCoachMessages(coachData.notifications || []);
          setCalendarStatus(calendarResponse.ok ? calendarData : null);
          setExecutionSummary(executionResponse.ok ? executionData.execution : null);
          setCoachMemory(memoryResponse.ok ? memoryData.memory : null);
          setClinicalInsights(
            clinicalMemoryResponse.ok ? clinicalMemoryData.insights || [] : []
          );
          setDailyBrief(dailyBriefResponse.ok ? dailyBriefData.brief : null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Companion could not load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCompanion();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (loading || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") !== "clinical") return;

    window.setTimeout(() => {
      clinicalPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [loading]);

  useEffect(() => {
    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setInstallState((current) => ({ ...current, standalone: true }));
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const protocol = protocols[0];
  const protocolFocus = useMemo(
    () => protocol?.focus_domains?.slice(0, 3).join(" / ") || "Optimization",
    [protocol]
  );
  const protocolActions = protocol?.protocol?.primary_protocol || [];

  async function installCompanion() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  async function scheduleProtocolToCalendar() {
    if (!protocol) {
      setCalendarMessage("Generate an optimization protocol before scheduling.");
      return;
    }

    if (!calendarStatus?.connected) {
      window.location.href = "/api/calendar/google/connect";
      return;
    }

    setSchedulingCalendar(true);
    setCalendarMessage(null);

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(9, 0, 0, 0);
    const scheduledLocal = toLocalDateTimePayload(scheduledFor);

    try {
      const response = await fetch("/api/calendar/google/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Aeonvera protocol: ${protocolFocus}`,
          description:
            protocol.summary ||
            "Aeonvera scheduled this protocol block from your companion view.",
          action: protocol.summary || protocolFocus,
          actionScope: "week",
          protocolId: protocol.id,
          scheduledFor: scheduledFor.toISOString(),
          scheduledLocal,
          durationMinutes: 45,
          recurrence: "weekly",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Calendar event could not be scheduled.");
      }

      setCalendarMessage("Protocol scheduled in Google Calendar.");
    } catch (error) {
      setCalendarMessage(
        error instanceof Error ? error.message : "Calendar event could not be scheduled."
      );
    } finally {
      setSchedulingCalendar(false);
    }
  }

  async function scheduleActionToCalendar(action: ProtocolAction, actionIndex: number) {
    if (!protocol || !action.action) return;

    if (!calendarStatus?.connected) {
      window.location.href = "/api/calendar/google/connect";
      return;
    }

    const actionKey = `${protocol.id}:${actionIndex}:${action.action}`;
    const scope = classifyActionScope(action);
    const scheduledFor = getActionScheduleDate(scope, actionIndex);
    const scheduledLocal = toLocalDateTimePayload(scheduledFor);
    const recurrence = getActionRecurrence(scope, action);

    setSchedulingActionKey(actionKey);
    setCalendarMessage(null);

    try {
      const response = await fetch("/api/calendar/google/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Aeonvera: ${action.action}`,
          description: action.why || protocol.summary || "Aeonvera scheduled this action.",
          action: action.action,
          actionScope: scope,
          protocolId: protocol.id,
          scheduledFor: scheduledFor.toISOString(),
          scheduledLocal,
          durationMinutes: getActionDuration(scope, action),
          recurrence,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action could not be scheduled.");
      }

      setScheduledActionKeys((current) => ({ ...current, [actionKey]: true }));
      setCalendarMessage("Action scheduled in Google Calendar.");
    } catch (error) {
      setCalendarMessage(
        error instanceof Error ? error.message : "Action could not be scheduled."
      );
    } finally {
      setSchedulingActionKey(null);
    }
  }

  async function recordActionOutcome(
    action: ProtocolAction,
    actionIndex: number,
    outcome: "success" | "failure" | "unknown"
  ) {
    if (!protocol || !action.action) return;

    const outcomeKey = `${protocol.id}:${actionIndex}:${outcome}`;
    const notes =
      outcome === "success"
        ? "Marked done from companion protocol action."
        : outcome === "failure"
          ? "Marked skipped from companion protocol action."
          : "Marked later from companion protocol action.";

    setSavingOutcomeKey(outcomeKey);
    setCalendarMessage(null);

    try {
      const response = await fetch("/api/digital-twin/outcomes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolId: protocol.id,
          domain: action.domain || protocolFocus,
          action: action.action,
          outcome,
          confidence: outcome === "success" ? 0.86 : outcome === "failure" ? 0.78 : 0.62,
          notes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action outcome could not be saved.");
      }

      const executionResponse = await fetch("/api/execution/summary", {
        credentials: "include",
      });
      const memoryResponse = await fetch("/api/coach/memory", {
        credentials: "include",
      });
      const executionData = await executionResponse.json();
      const memoryData = await memoryResponse.json();

      if (executionResponse.ok) {
        setExecutionSummary(executionData.execution || null);
      }

      if (memoryResponse.ok) {
        setCoachMemory(memoryData.memory || null);
      }

      setCalendarMessage(
        outcome === "success"
          ? "Action marked done."
          : outcome === "failure"
            ? "Action marked skipped."
            : "Action moved to later."
      );
    } catch (error) {
      setCalendarMessage(
        error instanceof Error ? error.message : "Action outcome could not be saved."
      );
    } finally {
      setSavingOutcomeKey(null);
    }
  }

  async function askPersonalAgent(promptOverride?: string, options: AgentSendOptions = {}) {
    const question = (promptOverride || agentPrompt).trim();
    if (!question || agentThinking) return;

    const history = agentMessages.slice(-8);
    const nextMessages: AgentChatMessage[] = [...agentMessages, { role: "user", content: question }];

    setAgentMessages(nextMessages);
    setAgentPrompt("");
    setAgentThinking(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, ...options }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Aeonvera could not answer right now.");
      }

      setAgentMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || "Aeonvera is still reading the signal.",
        },
      ]);

      if (Array.isArray(data.suggestedPrompts)) {
        setAgentSuggestions(data.suggestedPrompts.slice(0, 3));
      }

      if (Array.isArray(data.actions)) {
        setAgentActions(data.actions.slice(0, 4));

        if (
          data.actions.some((action: AgentAppliedAction) =>
            [
              "plan_simplified",
              "clinical_plan_prepared",
              "clinical_follow_up_plan_updated",
            ].includes(action.type)
          )
        ) {
          const dailyBriefResponse = await fetch("/api/coach/daily-brief", {
            credentials: "include",
          });
          const dailyBriefData = await dailyBriefResponse.json();
          if (dailyBriefResponse.ok) {
            setDailyBrief(dailyBriefData.brief || null);
          }
        }
      }

      const clinicalMemoryResponse = await fetch("/api/clinical/insights", {
        credentials: "include",
      });
      const clinicalMemoryData = await clinicalMemoryResponse.json();
      if (clinicalMemoryResponse.ok) {
        setClinicalInsights(clinicalMemoryData.insights || []);
      }

      if (options.clinicalFollowUpAnswer) {
        setClinicalAnswer("");
        setAnsweringClinicalInsightId(null);
      }
    } catch (error) {
      setAgentMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Aeonvera could not answer right now.",
        },
      ]);
    } finally {
      setAgentThinking(false);
    }
  }

  function answerClinicalFollowUp(insightId: string) {
    const answer = clinicalAnswer.trim();
    if (!answer || agentThinking) return;

    setAnsweringClinicalInsightId(insightId);
    void askPersonalAgent(answer, {
      clinicalFollowUpAnswer: true,
      clinicalInsightId: insightId,
    });
  }

  return (
    <PageContainer>
      <div className="py-14">
        <div className="mb-9 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="micro-label mb-5">Mobile Companion</p>
            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl">
              Today&apos;s healthspan operating view.
            </h1>
          </div>
          <Link
            href="/digital-twin"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            Digital Twin <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Loading companion</p>
          </div>
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Link
                href={dailyBrief?.href || twin?.intelligence?.nextMove.href || "/optimization"}
                className="quiet-lift executive-panel block rounded-lg p-6 transition hover:border-white/[0.14] md:p-7"
              >
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="micro-label">Today</p>
                  <Sparkles size={18} className="royal-text" />
                </div>
                <h2 className="text-3xl font-light leading-tight text-white">
                  {dailyBrief?.title ||
                    twin?.intelligence?.nextMove.title ||
                    "Run your next protocol"}
                </h2>
                <p className="mt-5 text-sm leading-7 text-white/48">
                  {dailyBrief?.message ||
                    twin?.intelligence?.nextMove.detail ||
                    "Aeonvera is ready to turn the next recommendation into a tracked action."}
                </p>
                {dailyBrief ? (
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    <DailyBriefSignal label="Health" value={dailyBrief.healthPriority} />
                    <DailyBriefSignal label="Behavior" value={dailyBrief.behaviorPriority} />
                    <DailyBriefSignal label="Calendar" value={dailyBrief.calendarPriority} />
                  </div>
                ) : null}
              </Link>

              <div className="executive-panel rounded-lg p-6 md:p-7">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="micro-label">Twin Status</p>
                  <Dna size={18} className="royal-text" />
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-light leading-none text-white">
                    {twin?.intelligence?.confidence || 0}
                  </p>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/28">
                    confidence
                  </p>
                </div>
                <p className="mt-5 text-sm leading-7 text-white/48">
                  {twin?.intelligence?.summary ||
                    "Your model is assembling from assessments, labs, protocols, coach signals, and wearable data."}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <InstallCompanionCard
                installState={installState}
                canPrompt={Boolean(installPrompt)}
                onInstall={() => void installCompanion()}
              />
              <CompanionCard
                icon={CalendarClock}
                label="Active Protocol"
                title={protocolFocus}
                detail={protocol?.summary || "Generate a protocol to activate daily execution."}
                href="/optimization"
              />
              <CalendarAutomationCard
                connected={calendarStatus?.connected === true}
                migrationRequired={calendarStatus?.migrationRequired === true}
                message={calendarMessage || calendarStatus?.message}
                scheduling={schedulingCalendar}
                onConnect={() => {
                  window.location.href = "/api/calendar/google/connect";
                }}
                onSchedule={() => void scheduleProtocolToCalendar()}
              />
            </div>

            <ExecutionScorePanel execution={executionSummary} />

            <PersonalHealthAgentPanel
              appliedActions={agentActions}
              messages={agentMessages}
              prompt={agentPrompt}
              suggestions={agentSuggestions}
              thinking={agentThinking}
              onPromptChange={setAgentPrompt}
              onSend={(value) => void askPersonalAgent(value)}
            />

            <PersonalAgentMemoryPanel memory={coachMemory} />

            <div ref={clinicalPanelRef}>
              <ClinicalIntelligenceMemoryPanel
                answer={clinicalAnswer}
                answeringInsightId={answeringClinicalInsightId}
                insights={clinicalInsights}
                thinking={agentThinking}
                onAnswerChange={setClinicalAnswer}
                onSubmitAnswer={answerClinicalFollowUp}
              />
            </div>

            <CompanionCard
              icon={MessageCircle}
              label="Coach Inbox"
              title={coachMessages[0]?.title || "No coach message yet"}
              detail={coachMessages[0]?.message || "Daily coach messages will appear here as the system learns."}
              href="/dashboard"
            />

            <ProtocolActionsCalendarPanel
              actions={protocolActions}
              connected={calendarStatus?.connected === true}
              protocolId={protocol?.id}
              scheduledActionKeys={scheduledActionKeys}
              schedulingActionKey={schedulingActionKey}
              savingOutcomeKey={savingOutcomeKey}
              onConnect={() => {
                window.location.href = "/api/calendar/google/connect";
              }}
              onSchedule={(action, index) => void scheduleActionToCalendar(action, index)}
              onRecordOutcome={(action, index, outcome) =>
                void recordActionOutcome(action, index, outcome)
              }
            />

            <NotificationPreferencesPanel />
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function toLocalDateTimePayload(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, input, label, select, textarea, a"))
    : false;
}

function ProtocolActionsCalendarPanel({
  actions,
  connected,
  onConnect,
  onRecordOutcome,
  onSchedule,
  protocolId,
  savingOutcomeKey,
  scheduledActionKeys,
  schedulingActionKey,
}: {
  actions: ProtocolAction[];
  connected: boolean;
  onConnect: () => void;
  onRecordOutcome: (
    action: ProtocolAction,
    index: number,
    outcome: "success" | "failure" | "unknown"
  ) => void;
  onSchedule: (action: ProtocolAction, index: number) => void;
  protocolId?: string;
  savingOutcomeKey: string | null;
  scheduledActionKeys: Record<string, boolean>;
  schedulingActionKey: string | null;
}) {
  if (!actions.length) {
    return null;
  }

  return (
    <div className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="micro-label">Action Scheduling</p>
        <CalendarClock size={18} className="royal-text" />
      </div>
      <div className="space-y-4">
        {actions.slice(0, 6).map((action, index) => {
          const scope = classifyActionScope(action);
          const actionKey = `${protocolId}:${index}:${action.action}`;
          const scheduled = scheduledActionKeys[actionKey];
          const scheduling = schedulingActionKey === actionKey;
          const savingDone = savingOutcomeKey === `${protocolId}:${index}:success`;
          const savingSkip = savingOutcomeKey === `${protocolId}:${index}:failure`;
          const savingLater = savingOutcomeKey === `${protocolId}:${index}:unknown`;

          return (
            <div
              key={actionKey}
              role="button"
              tabIndex={scheduled || scheduling ? -1 : 0}
              onClick={(event) => {
                if (isInteractiveTarget(event.target)) return;
                if (scheduled || scheduling) return;
                if (connected) {
                  onSchedule(action, index);
                } else {
                  onConnect();
                }
              }}
              onKeyDown={(event) => {
                if (scheduled || scheduling) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (connected) {
                  onSchedule(action, index);
                } else {
                  onConnect();
                }
              }}
              className={`quiet-lift rounded-lg border border-white/[0.07] bg-black/15 p-4 transition hover:border-white/[0.14] ${
                scheduled || scheduling ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/[0.035] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/80">
                      {scopeLabel(scope)}
                    </span>
                    {action.cadence && (
                      <span className="rounded-md bg-white/[0.025] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-white/32">
                        {action.cadence}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-light leading-snug text-white/86">
                    {action.action || "Protocol action"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/42">
                    {action.why || "Schedule this action into your calendar."}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRecordOutcome(action, index, "success");
                    }}
                    disabled={Boolean(savingOutcomeKey)}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-[10px] uppercase tracking-[0.14em] text-white/68 transition hover:border-[#dabc73]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {savingDone ? "Saving" : "Done"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRecordOutcome(action, index, "failure");
                    }}
                    disabled={Boolean(savingOutcomeKey)}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.025] px-3 text-[10px] uppercase tracking-[0.14em] text-white/48 transition hover:border-white/[0.18] hover:text-white/76 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {savingSkip ? "Saving" : "Skip"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRecordOutcome(action, index, "unknown");
                    }}
                    disabled={Boolean(savingOutcomeKey)}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.025] px-3 text-[10px] uppercase tracking-[0.14em] text-white/48 transition hover:border-white/[0.18] hover:text-white/76 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {savingLater ? "Saving" : "Later"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (connected) {
                        onSchedule(action, index);
                      } else {
                        onConnect();
                      }
                    }}
                    disabled={scheduling || scheduled}
                    className="premium-action inline-flex h-10 items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {scheduled
                      ? "Scheduled"
                      : scheduling
                        ? "Scheduling"
                        : connected
                          ? "Schedule"
                          : "Connect"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutionScorePanel({ execution }: { execution: ExecutionSummary | null }) {
  const score = execution?.score ?? 0;
  const label = execution ? executionStatusLabel(execution.status) : "Building";

  return (
    <div className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="micro-label">Execution Intelligence</p>
        <Brain size={18} className="royal-text" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <div className="flex items-end gap-3">
            <p className="text-6xl font-light leading-none text-white">{score}</p>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/28">
              score
            </p>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[#dabc73]/80">
            {label}
          </p>
        </div>
        <div>
          <h3 className="text-2xl font-light leading-tight text-white/88">
            {execution?.headline ||
              "Execution score appears after protocol actions are completed, skipped, or scheduled."}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <ExecutionStat label="Done" value={execution?.completed || 0} />
            <ExecutionStat label="Skipped" value={execution?.skipped || 0} />
            <ExecutionStat label="Later" value={execution?.deferred || 0} />
            <ExecutionStat label="Calendar" value={execution?.scheduled || 0} />
          </div>
          {execution?.topSkippedPattern ? (
            <div className="mt-5 rounded-lg border border-white/[0.07] bg-black/15 p-4">
              <p className="micro-label">Skipped pattern</p>
              <p className="mt-3 text-sm leading-6 text-white/50">
                {execution.topSkippedPattern.label} skipped{" "}
                {execution.topSkippedPattern.count} time
                {execution.topSkippedPattern.count === 1 ? "" : "s"} this week.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PersonalHealthAgentPanel({
  appliedActions,
  messages,
  onPromptChange,
  onSend,
  prompt,
  suggestions,
  thinking,
}: {
  appliedActions: AgentAppliedAction[];
  messages: AgentChatMessage[];
  onPromptChange: (value: string) => void;
  onSend: (value?: string) => void;
  prompt: string;
  suggestions: string[];
  thinking: boolean;
}) {
  const latestMessages = messages.slice(-5);

  return (
    <div className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="micro-label">Personal Health Agent</p>
          <h2 className="mt-3 text-3xl font-light leading-tight text-white">
            Ask Aeonvera why.
          </h2>
        </div>
        <MessageCircle size={18} className="royal-text" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm leading-7 text-white/48">
            Aeonvera now explains the reasoning behind your plan using your memory,
            calendar, protocol, and recent execution signals.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSend(suggestion)}
                disabled={thinking}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-left text-[10px] uppercase tracking-[0.12em] text-white/48 transition hover:border-[#dabc73]/35 hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {suggestion}
              </button>
            ))}
          </div>
          {appliedActions.length ? (
            <div className="mt-5 space-y-2">
              {appliedActions.map((action) => (
                <div
                  key={`${action.type}-${action.label}`}
                  className="rounded-lg border border-[#dabc73]/20 bg-[#dabc73]/[0.045] p-3"
                >
                  <p className="text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/80">
                    {action.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/48">{action.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="max-h-[330px] space-y-3 overflow-y-auto pr-1">
            {latestMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
                className={`rounded-lg border p-4 ${
                  message.role === "assistant"
                    ? "border-white/[0.07] bg-white/[0.025]"
                    : "border-[#dabc73]/20 bg-[#dabc73]/[0.045]"
                }`}
              >
                <p className="mb-2 text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/75">
                  {message.role === "assistant" ? "Aeonvera" : "You"}
                </p>
                <p className="text-sm leading-7 text-white/58">{message.content}</p>
              </div>
            ))}
            {thinking ? (
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-sm leading-7 text-white/42">
                  Aeonvera is reading today&apos;s signal.
                </p>
              </div>
            ) : null}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <input
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Ask what to do, why it matters, or what should change..."
              className="min-h-12 flex-1 rounded-md border border-white/[0.08] bg-black/25 px-4 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#dabc73]/35"
            />
            <button
              type="submit"
              disabled={thinking || !prompt.trim()}
              className="premium-action inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Ask Aeonvera"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DailyBriefSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/70">
        {label}
      </p>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/44">{value}</p>
    </div>
  );
}

function ExecutionStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="text-2xl font-light text-white/86">{value}</p>
      <p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>
    </div>
  );
}

function PersonalAgentMemoryPanel({ memory }: { memory: CoachMemory | null }) {
  const friction = memory?.failurePatterns?.[0];
  const strongest = memory?.bestInterventions?.[0];
  const confidence = Math.round((memory?.confidence || 0) * 100);
  const styleLabel = memory ? coachStyleLabel(memory.communicationStyle) : "Building";

  return (
    <div className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="micro-label">Personal Agent Memory</p>
        <Target size={18} className="royal-text" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white/[0.035] px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/80">
              {styleLabel}
            </span>
            <span className="rounded-md bg-white/[0.025] px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] text-white/30">
              {confidence || 0}% confidence
            </span>
          </div>

          <h3 className="mt-5 text-2xl font-light leading-tight text-white/88">
            {memory?.morningBrief ||
              "Aeonvera is learning your natural rhythm, the places your energy resists, and the interventions your system responds to best."}
          </h3>

          <p className="mt-4 text-sm leading-7 text-white/42">
            {memory?.motivationProfile?.needs ||
              "Mark actions Done, Skip, or Later to help the agent understand what fits your real life."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <MemoryStat
            label="Friction"
            value={friction ? friction.label : "Learning"}
            detail={
              friction
                ? `${friction.count} skipped this week`
                : "No repeated failure pattern yet"
            }
          />
          <MemoryStat
            label="Strongest"
            value={strongest ? readableDomain(strongest.domain) : "Learning"}
            detail={
              strongest
                ? `${strongest.successCount} aligned responses`
                : "No strongest pattern yet"
            }
          />
          <MemoryStat
            label="Driver"
            value={memory?.motivationProfile?.primaryDriver || "Small wins"}
            detail="Current motivation model"
          />
        </div>
      </div>
    </div>
  );
}

function ClinicalIntelligenceMemoryPanel({
  answer,
  answeringInsightId,
  insights,
  onAnswerChange,
  onSubmitAnswer,
  thinking,
}: {
  answer: string;
  answeringInsightId: string | null;
  insights: ClinicalInsight[];
  onAnswerChange: (value: string) => void;
  onSubmitAnswer: (insightId: string) => void;
  thinking: boolean;
}) {
  const latest = insights[0];
  const confidence = Math.round(Number(latest?.confidence || 0) * 100);
  const status = latest?.concern_status || "building";
  const domains = latest?.domains?.slice(0, 4) || [];
  const rangeFlags = latest?.range_flags?.slice(0, 3) || [];
  const followUp = latest?.follow_up_questions?.[0];
  const nextAction = latest?.recommended_actions?.[0];
  const progression = latest?.metadata?.progression;
  const lastResponse = latest?.metadata?.follow_up_responses?.at(-1);

  return (
    <div className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="micro-label">Clinical Intelligence Memory</p>
        <Brain size={18} className="royal-text" />
      </div>

      {latest ? (
        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/[0.035] px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] text-[#dabc73]/80">
                {clinicalStatusLabel(status)}
              </span>
              <span className="rounded-md bg-white/[0.025] px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] text-white/30">
                {confidence || 0}% confidence
              </span>
            </div>
            <h3 className="mt-5 text-2xl font-light leading-tight text-white/88">
              {latest.answer_summary ||
                "Aeonvera has stored a clinical reasoning memory for future comparisons."}
            </h3>
            {followUp ? (
              <p className="mt-4 text-sm leading-7 text-white/42">{followUp}</p>
            ) : null}
            {followUp ? (
              <div className="mt-5 rounded-lg border border-[#dabc73]/15 bg-[#dabc73]/[0.035] p-4">
                <p className="micro-label">Answer follow-up</p>
                <textarea
                  value={answer}
                  onChange={(event) => onAnswerChange(event.target.value)}
                  placeholder="Tell Aeonvera what changed, what stayed the same, or what you want adjusted..."
                  className="mt-3 min-h-24 w-full resize-none rounded-md border border-white/[0.08] bg-black/25 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-[#dabc73]/35"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-white/36">
                    {lastResponse?.answer
                      ? `Last answered: ${lastResponse.answer.slice(0, 96)}`
                      : "Your answer updates this exact clinical thread."}
                  </p>
                  <button
                    type="button"
                    disabled={thinking || !answer.trim() || answeringInsightId === latest.id}
                    onClick={() => onSubmitAnswer(latest.id)}
                    className="premium-action inline-flex min-h-10 items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {answeringInsightId === latest.id ? "Updating" : "Answer"}
                  </button>
                </div>
              </div>
            ) : null}
            {progression?.summary ? (
              <p className="mt-4 rounded-lg border border-white/[0.07] bg-black/15 p-4 text-sm leading-7 text-white/48">
                {progression.summary}
              </p>
            ) : null}
            {domains.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {domains.map((domain) => (
                  <span
                    key={domain}
                    className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9px] uppercase tracking-[0.13em] text-white/42"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {rangeFlags.length ? (
              rangeFlags.map((flag) => (
                <MemoryStat
                  key={`${flag.marker}-${flag.value}`}
                  label={flag.status || "Signal"}
                  value={flag.marker || "Marker"}
                  detail={flag.value || "Tracked clinical signal"}
                />
              ))
            ) : (
              <MemoryStat
                label="Signal"
                value="Building"
                detail="Ask a clinical question or upload labs to deepen this memory."
              />
            )}
            {nextAction ? (
              <MemoryStat
                label="Next Action"
                value={nextAction.domain || "Protocol"}
                detail={nextAction.action || "Review the prepared clinical plan."}
              />
            ) : null}
            {progression ? (
              <MemoryStat
                label="Trajectory"
                value={clinicalProgressionLabel(progression.status)}
                detail={`${progression.priorInsightCount || 0} prior clinical memor${
                  progression.priorInsightCount === 1 ? "y" : "ies"
                }`}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-2xl font-light leading-tight text-white/88">
            Aeonvera is ready to remember clinical conclusions.
          </h3>
          <p className="mt-4 text-sm leading-7 text-white/42">
            Ask a deep health question or request a protocol. The agent will store the signal map,
            missing data, follow-up questions, and recommended actions here.
          </p>
        </div>
      )}
    </div>
  );
}

function MemoryStat({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="micro-label">{label}</p>
      <p className="mt-3 text-lg font-light leading-snug text-white/86">{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/36">{detail}</p>
    </div>
  );
}

function clinicalStatusLabel(status: string) {
  if (status === "improving") return "Improving";
  if (status === "unresolved") return "Unresolved";
  if (status === "dismissed") return "Dismissed";
  if (status === "monitoring") return "Monitoring";
  if (status === "active") return "Active";
  return "Building";
}

function clinicalProgressionLabel(status?: string) {
  if (status === "improving_signal") return "Improving";
  if (status === "recurrent_signal") return "Recurring";
  if (status === "new_signal") return "New signal";
  return "Monitoring";
}

function executionStatusLabel(status: ExecutionSummary["status"]) {
  if (status === "strong") return "Strong";
  if (status === "steady") return "Steady";
  if (status === "needs_attention") return "Needs adjustment";
  return "Building";
}

function coachStyleLabel(style: CoachMemory["communicationStyle"]) {
  if (style === "encouraging") return "Encouraging coach";
  if (style === "accountability") return "Accountability coach";
  if (style === "direct") return "Direct coach";
  return "Balanced coach";
}

function readableDomain(domain: string) {
  const value = domain.toLowerCase();

  if (value.includes("stress")) return "Stress reduction";
  if (value.includes("sleep")) return "Sleep";
  if (value.includes("training") || value.includes("activity")) return "Training";
  if (value.includes("nutrition")) return "Nutrition";
  if (value.includes("recovery")) return "Recovery";

  return domain;
}

function classifyActionScope(action: ProtocolAction): ActionScope {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /(measure|check|track|log|record|weigh|weight|metric|retest|lab|blood|hrv|resting heart|sleep score|recovery score|biomarker)/.test(
      text
    )
  ) {
    return "check_in";
  }

  if (
    /(weekly|week|2x|3x|4x|twice|three times|session|sessions|zone 2|strength|resistance|meal prep|review)/.test(
      text
    )
  ) {
    return "week";
  }

  if (/(daily|today|morning|evening|nightly|bedtime|wake|walk|hydrate|meal)/.test(text)) {
    return "today";
  }

  return "later";
}

function getActionScheduleDate(scope: ActionScope, actionIndex: number) {
  const date = new Date();

  if (scope === "today") {
    date.setDate(date.getDate() + 1);
    date.setHours(8 + Math.min(actionIndex, 3), 0, 0, 0);
    return date;
  }

  if (scope === "check_in") {
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
    return date;
  }

  if (scope === "week") {
    date.setDate(date.getDate() + 2 + (actionIndex % 3));
    date.setHours(9 + (actionIndex % 2), 0, 0, 0);
    return date;
  }

  date.setDate(date.getDate() + 3);
  date.setHours(11, 0, 0, 0);
  return date;
}

function getActionDuration(scope: ActionScope, action: ProtocolAction) {
  const text = [action.domain, action.action, action.cadence].join(" ").toLowerCase();
  if (scope === "check_in") return 15;
  if (/strength|zone 2|training|workout|session|resistance/.test(text)) return 60;
  if (/walk|meal|nutrition|sleep|wind/.test(text)) return 30;
  return 45;
}

function getActionRecurrence(scope: ActionScope, action: ProtocolAction) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .join(" ")
    .toLowerCase();
  if (scope === "today" || /daily|nightly|morning|evening/.test(text)) return "daily";
  if (scope === "week" || /weekly|week|session|sessions/.test(text)) return "weekly";
  return "none";
}

function scopeLabel(scope: ActionScope) {
  if (scope === "check_in") return "Check-in";
  if (scope === "week") return "This week";
  if (scope === "later") return "Later";
  return "Today";
}

function InstallCompanionCard({
  installState,
  canPrompt,
  onInstall,
}: {
  installState: {
    standalone: boolean;
    serviceWorker: boolean;
    push: boolean;
  };
  canPrompt: boolean;
  onInstall: () => void;
}) {
  const title = installState.standalone
    ? "Installed"
    : canPrompt
    ? "Install Aeonvera"
    : "Add to Home Screen";
  const detail = installState.standalone
    ? "Aeonvera is running like an app on this device."
    : canPrompt
    ? "Install the companion so coach messages and protocols live one tap away."
    : "On iPhone or iPad, use Share, then Add to Home Screen. On Android, use the browser install option.";

  return (
    <div
      role={canPrompt && !installState.standalone ? "button" : undefined}
      tabIndex={canPrompt && !installState.standalone ? 0 : undefined}
      onClick={(event) => {
        if (!canPrompt || installState.standalone || isInteractiveTarget(event.target)) return;
        onInstall();
      }}
      onKeyDown={(event) => {
        if (!canPrompt || installState.standalone) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onInstall();
      }}
      className={`executive-panel rounded-lg p-5 ${
        canPrompt && !installState.standalone
          ? "quiet-lift cursor-pointer transition hover:border-white/[0.14]"
          : ""
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">App Mode</p>
        <Bell size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">{title}</h3>
      <p className="mt-4 text-sm leading-7 text-white/42">{detail}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          ["Install", installState.standalone || canPrompt],
          ["Push", installState.push],
          ["Worker", installState.serviceWorker],
        ].map(([label, active]) => (
          <span
            key={String(label)}
            className={`rounded-md px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] ${
              active
                ? "bg-white/[0.035] royal-text"
                : "bg-white/[0.02] text-white/26"
            }`}
          >
            {String(label)}
          </span>
        ))}
      </div>
      {canPrompt && !installState.standalone && (
        <button
          type="button"
          onClick={onInstall}
          className="premium-action mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em]"
        >
          Install companion
        </button>
      )}
    </div>
  );
}

function CalendarAutomationCard({
  connected,
  message,
  migrationRequired,
  onConnect,
  onSchedule,
  scheduling,
}: {
  connected: boolean;
  message?: string | null;
  migrationRequired: boolean;
  onConnect: () => void;
  onSchedule: () => void;
  scheduling: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={migrationRequired || scheduling ? -1 : 0}
      onClick={(event) => {
        if (migrationRequired || scheduling || isInteractiveTarget(event.target)) return;
        if (connected) {
          onSchedule();
        } else {
          onConnect();
        }
      }}
      onKeyDown={(event) => {
        if (migrationRequired || scheduling) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (connected) {
          onSchedule();
        } else {
          onConnect();
        }
      }}
      className={`executive-panel rounded-lg p-5 transition hover:border-white/[0.14] ${
        migrationRequired || scheduling ? "cursor-default" : "quiet-lift cursor-pointer"
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">Calendar</p>
        <CalendarClock size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">
        {connected ? "Google connected" : "Connect Google"}
      </h3>
      <p className="mt-4 text-sm leading-7 text-white/42">
        {connected
          ? "Schedule protocol blocks into Google Calendar so execution leaves Aeonvera and lands on the day."
          : "Connect Google Calendar to let Aeonvera schedule workouts, walks, check-ins, and protocol blocks."}
      </p>
      {message && (
        <p className="mt-4 text-xs leading-5 text-[#dabc73]/80">{message}</p>
      )}
      <button
        type="button"
        onClick={connected ? onSchedule : onConnect}
        disabled={migrationRequired || scheduling}
        className="premium-action mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {migrationRequired
          ? "Migration needed"
          : connected
            ? scheduling
              ? "Scheduling"
              : "Schedule protocol"
            : "Connect calendar"}
      </button>
    </div>
  );
}

function CompanionCard({
  icon: Icon,
  label,
  title,
  detail,
  href,
}: {
  icon: typeof Bell;
  label: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="quiet-lift executive-panel block rounded-lg p-5 transition hover:border-white/[0.14]"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">{label}</p>
        <Icon size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">{title}</h3>
      <p className="mt-4 line-clamp-4 text-sm leading-7 text-white/42">{detail}</p>
    </Link>
  );
}

function getInstallState() {
  if (typeof window === "undefined") {
    return {
      standalone: false,
      serviceWorker: false,
      push: false,
    };
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as StandaloneNavigator).standalone === true;

  return {
    standalone,
    serviceWorker: "serviceWorker" in navigator,
    push: "PushManager" in window,
  };
}
