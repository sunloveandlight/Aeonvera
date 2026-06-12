import "react-native-url-polyfill/auto";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  type LayoutChangeEvent,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { createClient, type Session } from "@supabase/supabase-js";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import * as Calendar from "expo-calendar";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";

type ActiveView = "today" | "agent" | "inbox" | "message" | "settings";
type VoicePhase = "idle" | "listening" | "processing" | "speaking" | "ready_follow_up";

type CoachMessage = {
  id: string;
  alert_id?: string | null;
  title: string;
  message: string;
  status?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
  sent_at?: string | null;
};

type ProtocolAction = {
  domain?: string;
  action?: string;
  why?: string;
  cadence?: string;
  impact?: "low" | "medium" | "high";
};

type ActionScope = "today" | "week" | "check_in" | "later";
type ReminderPreset = "default" | "soon" | "tomorrow";
type ReminderRepeat = "once" | "daily" | "weekly";

type ScheduledProtocolAction = ProtocolAction & {
  actionIndex: number;
  scope: ActionScope;
};

type Protocol = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  status?: string | null;
  created_at?: string | null;
  protocol?: {
    summary?: string;
    primary_protocol?: ProtocolAction[];
    coach_message?: string;
  } | null;
};

type AdherenceOutcome = "success" | "failure" | "unknown";

type AdherenceEvent = {
  id: string;
  protocol_id?: string | null;
  domain?: string | null;
  action: string;
  outcome?: AdherenceOutcome | null;
  success?: boolean | null;
  notes?: string | null;
  measured_at?: string | null;
  created_at?: string | null;
};

type LocalReminder = {
  notificationId: string;
  repeat: ReminderRepeat;
  scheduledFor: string;
};

type NativeCalendarEvent = {
  eventId: string;
  calendarEventId?: string | null;
  calendarTitle: string;
  scheduledFor: string;
  reason?: string;
  feedbackNotificationId?: string | null;
};

type CalendarScheduleResult = {
  eventId: string;
  calendarEventId?: string | null;
  calendarTitle: string;
  scheduledFor: string;
  reason: string;
};

type BusySlot = {
  start: Date;
  end: Date;
};

type NotificationTapData = {
  path?: string;
  url?: string;
  target?: string;
  alertId?: string;
  alert_id?: string;
  action?: string;
  actionIndex?: number;
  actionScope?: ActionScope;
  calendarEventId?: string;
  domain?: string;
  protocolId?: string;
  scheduledFor?: string;
};

type PendingFeedback = {
  action: string;
  actionIndex: number;
  calendarEventId?: string | null;
  domain: string;
  protocolId?: string | null;
  scope: ActionScope;
  scheduledFor?: string | null;
};

type Preferences = {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
};

type AutopilotMode = "manual" | "suggest" | "approve" | "autopilot" | "sovereign";

type AutopilotPreferences = {
  user_id: string;
  mode: AutopilotMode;
  calendar_enabled: boolean;
  notifications_enabled: boolean;
  auto_schedule_enabled: boolean;
  allow_training_blocks: boolean;
  allow_nutrition_blocks: boolean;
  allow_recovery_blocks: boolean;
  allow_check_ins: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
};

type DailyPlanItem = ScheduledProtocolAction & {
  adaptation_reason?: string;
  recommended_time?: string;
  execution_mode?: "manual" | "suggest" | "approve" | "notify" | "schedule";
};

type DailyExecutionPlan = {
  id: string;
  plan_date: string;
  status: "draft" | "prepared" | "accepted" | "adjusted" | "skipped" | "auto_scheduled";
  autopilot_mode: AutopilotMode;
  summary?: string | null;
  plan?: {
    summary?: string;
    items?: DailyPlanItem[];
    memory?: {
      completion_rate?: number;
      friction_domains?: string[];
      plan_load?: "light" | "steady" | "ambitious";
      strong_domains?: string[];
      total_signals?: number;
    };
    principles?: string[];
  } | null;
  scheduled_event_ids?: string[] | null;
};

type ExecutionPattern = {
  label: string;
  count: number;
  actions: string[];
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
  topSkippedPattern: ExecutionPattern | null;
};

type DiagnosticCheck = {
  detail: string;
  label: string;
  status: "pass" | "warn" | "fail";
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
  concern_status?: string | null;
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
      safety_level?: string;
      status_reason?: string;
    }>;
    progression?: {
      status?: string;
      summary?: string;
      repeatedDomains?: string[];
      newDomains?: string[];
      priorInsightCount?: number;
      lastSeenAt?: string | null;
    };
    missing_inputs?: Array<{
      domain?: string;
      label?: string;
      priority?: string;
      reason?: string;
    }>;
    risk_tier?: string;
    safety_level?: string;
    status_reason?: string;
  } | null;
  created_at?: string | null;
};

type UsageMeterSnapshot = {
  allowed: boolean;
  limit: number;
  meter: string;
  migrationRequired?: boolean;
  periodStart: string;
  plan: string | null;
  remaining: number;
  used: number;
};

type UsageLimitsPayload = {
  plan: string | null;
  subscriptionStatus: string | null;
  usage: UsageMeterSnapshot[];
};

type ModalityRecommendation = {
  id: string;
  name: string;
  minimumTier: string;
  category: string;
  evidenceGrade: string;
  risk: string;
  cost: string;
  access: "included" | "locked";
  fitScore: number;
  rationale: string;
  upgradeMessage?: string;
  protocolRange: string;
  track: string[];
  stopIf: string[];
  clinicianReview: boolean;
};

type ModalitiesPayload = {
  currentPlan: string | null;
  recommendations: ModalityRecommendation[];
};

const WEB_URL =
  process.env.EXPO_PUBLIC_AEONVERA_WEB_URL ||
  Constants.expoConfig?.extra?.webUrl ||
  "https://www.aeonvera.com";
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ||
  "";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ||
  "";
const EAS_PROJECT_ID =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  Constants.easConfig?.projectId ||
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
    ?.projectId ||
  "";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: secureStoreAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const shortcuts = [
  { label: "Dashboard", title: "Healthspan command center", path: "/dashboard" },
  { label: "Optimize", title: "AI protocol builder", path: "/optimization" },
  { label: "Twin", title: "Digital twin timeline", path: "/digital-twin" },
  { label: "Report", title: "Longevity intelligence", path: "/report" },
];

const ACTION_SECTIONS: {
  scope: ActionScope;
  title: string;
  copy: string;
  maxVisible: number;
}[] = [
  {
    scope: "today",
    title: "Today",
    copy: "Daily actions and anything that should happen now.",
    maxVisible: 3,
  },
  {
    scope: "week",
    title: "This Week",
    copy: "Weekly targets, training blocks, and setup actions.",
    maxVisible: 2,
  },
  {
    scope: "check_in",
    title: "Check-ins",
    copy: "Measurements and feedback Aeonvera uses to adapt.",
    maxVisible: 2,
  },
  {
    scope: "later",
    title: "Later",
    copy: "Lower urgency actions or items better scheduled manually.",
    maxVisible: 1,
  },
];

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>("today");
  const [pushStatus, setPushStatus] = useState("Not requested");
  const [authStatus, setAuthStatus] = useState(
    supabase ? "Restoring session" : "Mobile auth needs Supabase env vars"
  );
  const [authInitializing, setAuthInitializing] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [adherenceEvents, setAdherenceEvents] = useState<AdherenceEvent[]>([]);
  const [localReminders, setLocalReminders] = useState<Record<string, LocalReminder>>({});
  const [nativeCalendarEvents, setNativeCalendarEvents] = useState<
    Record<string, NativeCalendarEvent>
  >({});
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [inboxNotice, setInboxNotice] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [autopilotPreferences, setAutopilotPreferences] =
    useState<AutopilotPreferences | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyExecutionPlan | null>(null);
  const [autopilotMessage, setAutopilotMessage] = useState<string | null>(null);
  const [acceptingDailyPlan, setAcceptingDailyPlan] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);
  const [diagnosticChecks, setDiagnosticChecks] = useState<DiagnosticCheck[]>([]);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask why Aeonvera chose today’s plan, what should change, or how to make the day feel lighter.",
    },
  ]);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentThinking, setAgentThinking] = useState(false);
  const [agentActions, setAgentActions] = useState<AgentAppliedAction[]>([]);
  const [clinicalInsights, setClinicalInsights] = useState<ClinicalInsight[]>([]);
  const [usageLimits, setUsageLimits] = useState<UsageLimitsPayload | null>(null);
  const [modalities, setModalities] = useState<ModalitiesPayload | null>(null);
  const [clinicalAnswerDraft, setClinicalAnswerDraft] = useState("");
  const [activeVoiceClinicalInsightId, setActiveVoiceClinicalInsightId] = useState<string | null>(
    null
  );
  const [agentSuggestions, setAgentSuggestions] = useState([
    "Why this plan today?",
    "What should I do first?",
    "Make today simpler.",
  ]);
  const [voiceRecording, setVoiceRecording] = useState<Audio.Recording | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState<string | null>(null);
  const [lastVoiceAnswer, setLastVoiceAnswer] = useState<string | null>(null);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [notificationFocusTick, setNotificationFocusTick] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const inboxOffsetY = useRef(0);
  const messageListOffsetY = useRef(0);
  const selectedMessageOffsetY = useRef<number | null>(null);
  const appUrl = useMemo(() => WEB_URL.replace(/\/$/, ""), []);
  const selectedMessage = useMemo(
    () => coachMessages.find((message) => message.id === selectedMessageId) || null,
    [coachMessages, selectedMessageId]
  );

  const openPath = useCallback(
    async (path: string) => {
      await Linking.openURL(`${appUrl}${path}`);
    },
    [appUrl]
  );

  const loadCompanionData = useCallback(
    async (currentSession: Session | null, showSpinner = false) => {
      if (!supabase || !currentSession) return;

      if (showSpinner) setRefreshing(true);
      setDataMessage(null);
      setAutopilotMessage(null);

      const [messageResult, protocolResult, preferenceResult] = await Promise.all([
        supabase
          .from("notification_deliveries")
          .select("id,alert_id,title,message,status,payload,created_at,sent_at")
          .eq("channel", "in_app")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("optimization_protocols")
          .select("id,protocol,summary,focus_domains,status,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("notification_preferences")
          .select(
            "user_id,email_enabled,push_enabled,quiet_hours_start,quiet_hours_end,timezone"
          )
          .eq("user_id", currentSession.user.id)
          .maybeSingle(),
      ]);
      const autopilotResult = await fetch(`${appUrl}/api/autopilot/daily-plan`, {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      })
        .then((response) =>
          response.json().then((body) => ({
            body,
            ok: response.ok,
          }))
        )
        .catch((error) => ({
          body: {
            error:
              error instanceof Error
                ? error.message
                : "Autopilot could not prepare today.",
          },
          ok: false,
        }));
      const executionResult = await fetch(`${appUrl}/api/execution/summary`, {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      })
        .then((response) =>
          response.json().then((body) => ({
            body,
            ok: response.ok,
          }))
        )
        .catch((error) => ({
          body: {
            error:
              error instanceof Error
                ? error.message
                : "Execution summary could not load.",
          },
          ok: false,
        }));
      const clinicalMemoryResult = await fetch(`${appUrl}/api/clinical/insights`, {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      })
        .then((response) =>
          response.json().then((body) => ({
            body,
            ok: response.ok,
          }))
        )
        .catch(() => ({
          body: { insights: [] },
          ok: false,
        }));
      const usageResult = await fetch(`${appUrl}/api/usage/limits`, {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      })
        .then((response) =>
          response.json().then((body) => ({
            body,
            ok: response.ok,
          }))
        )
        .catch(() => ({
          body: null,
          ok: false,
        }));
      const modalityResult = await fetch(`${appUrl}/api/longevity/modalities`, {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      })
        .then((response) =>
          response.json().then((body) => ({
            body,
            ok: response.ok,
          }))
        )
        .catch(() => ({
          body: null,
          ok: false,
        }));

      if (messageResult.error || protocolResult.error || preferenceResult.error) {
        setDataMessage(
          messageResult.error?.message ||
            protocolResult.error?.message ||
            preferenceResult.error?.message ||
            "Mobile companion data could not load."
        );
      }

      const latestProtocol =
        ((protocolResult.data || [])[0] as Protocol | undefined) || null;
      let nextAdherenceEvents: AdherenceEvent[] = [];

      if (latestProtocol?.id) {
        const adherenceResult = await supabase
          .from("intervention_outcomes")
          .select("id,protocol_id,domain,action,outcome,success,notes,measured_at,created_at")
          .eq("protocol_id", latestProtocol.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (adherenceResult.error) {
          setDataMessage(adherenceResult.error.message);
        } else {
          nextAdherenceEvents = (adherenceResult.data || []) as AdherenceEvent[];
        }
      }

      setCoachMessages((messageResult.data || []) as CoachMessage[]);
      setProtocol(latestProtocol);
      setAdherenceEvents(nextAdherenceEvents);
      if (!autopilotResult.ok) {
        setAutopilotMessage(
          autopilotResult.body?.error || "Autopilot could not prepare today."
        );
      } else if (autopilotResult.body?.migrationRequired) {
        setAutopilotMessage(
          autopilotResult.body.message || "Autopilot needs its Supabase migration."
        );
      }
      setAutopilotPreferences(
        (autopilotResult.body?.preferences as AutopilotPreferences | null) ||
          defaultAutopilotPreferences(currentSession.user.id)
      );
      setDailyPlan((autopilotResult.body?.plan as DailyExecutionPlan | null) || null);
      if (executionResult.ok && !executionResult.body?.migrationRequired) {
        setExecutionSummary((executionResult.body?.execution as ExecutionSummary | null) || null);
      } else if (!executionResult.ok) {
        setExecutionSummary(null);
      }
      setClinicalInsights(
        clinicalMemoryResult.ok
          ? ((clinicalMemoryResult.body?.insights || []) as ClinicalInsight[])
          : []
      );
      setUsageLimits(usageResult.ok ? (usageResult.body as UsageLimitsPayload) : null);
      setModalities(modalityResult.ok ? (modalityResult.body as ModalitiesPayload) : null);
      setPreferences(
        ((preferenceResult.data as Preferences | null) || {
          user_id: currentSession.user.id,
          email_enabled: true,
          push_enabled: false,
          quiet_hours_start: "22:00",
          quiet_hours_end: "07:00",
          timezone: "UTC",
        }) as Preferences
      );
      if (showSpinner) setRefreshing(false);
    },
    [appUrl]
  );

  useEffect(() => {
    if (!selectedAlertId || !coachMessages.length) return;

    const timeout = setTimeout(() => {
      const matchedMessage = coachMessages.find(
        (message) => message.alert_id === selectedAlertId || message.id === selectedAlertId
      );

      setSelectedMessageId(matchedMessage?.id || coachMessages[0]?.id || null);
    }, 0);

    return () => clearTimeout(timeout);
  }, [coachMessages, selectedAlertId]);

  useEffect(() => {
    if (activeView !== "inbox") return;

    const timeout = setTimeout(() => {
      const selectedY =
        selectedMessageId && selectedMessageOffsetY.current !== null
          ? inboxOffsetY.current + messageListOffsetY.current + selectedMessageOffsetY.current
          : inboxOffsetY.current;

      scrollRef.current?.scrollTo({
        y: Math.max(selectedY - 18, 0),
        animated: true,
      });
    }, 140);

    return () => clearTimeout(timeout);
  }, [activeView, coachMessages.length, notificationFocusTick, selectedMessageId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthStatus(data.session ? "Signed in" : "Signed out");
      setAuthInitializing(false);
      void loadCompanionData(data.session);
    }).catch((error) => {
      setAuthStatus("Signed out");
      setAuthInitializing(false);
      setDataMessage(error instanceof Error ? error.message : "Session could not be restored.");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setAuthStatus(nextSession ? "Signed in" : "Signed out");
      setAuthInitializing(false);
      if (nextSession) {
        void loadCompanionData(nextSession);
      } else {
        setProtocol(null);
        setAdherenceEvents([]);
        setCoachMessages([]);
        setPreferences(null);
        setAutopilotPreferences(null);
        setDailyPlan(null);
        setAutopilotMessage(null);
        setAcceptingDailyPlan(false);
        setPendingFeedback(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadCompanionData]);

  const handleNotificationTap = useCallback(
    (data?: NotificationTapData) => {
      const alertId = data?.alertId || data?.alert_id || null;

      if (data?.target === "autopilot") {
        setActiveView("today");
        setActionNotice("Opened from Morning Autopilot. Review today's prepared plan.");
        playSoftHaptic();
        void loadCompanionData(session);
        return;
      }

      if (data?.target === "action_feedback" && data.action) {
        setPendingFeedback({
          action: data.action,
          actionIndex: Number(data.actionIndex || 0),
          calendarEventId: data.calendarEventId || null,
          domain: data.domain || "Optimization",
          protocolId: data.protocolId || null,
          scope: data.actionScope || "today",
          scheduledFor: data.scheduledFor || null,
        });
        setActiveView("today");
        setActionNotice("Aeonvera is ready to learn from that calendar block.");
        playSoftHaptic();
        void loadCompanionData(session);
        return;
      }

      if (data?.target === "clinical_follow_up") {
        setActiveView("agent");
        setActionNotice("Opened from your clinical follow-up.");
        playSoftHaptic();
        void loadCompanionData(session);
        return;
      }

      if (data?.target === "coach_inbox" || alertId) {
        selectedMessageOffsetY.current = null;
        setSelectedAlertId(alertId);
        setSelectedMessageId(null);
        setInboxNotice("Opened from your coach notification.");
        setActiveView("message");
        setNotificationFocusTick((current) => current + 1);
        playSoftHaptic();
        void loadCompanionData(session);
        return;
      }

      if (data?.url && /^https?:\/\//i.test(data.url)) {
        void Linking.openURL(data.url);
        return;
      }

      const path = data?.path || data?.url;

      if (path?.startsWith("/companion")) {
        setActiveView(
          path.includes("focus=coach")
            ? "message"
            : path.includes("focus=clinical")
            ? "agent"
            : "today"
        );
        if (path.includes("focus=coach")) {
          selectedMessageOffsetY.current = null;
          setNotificationFocusTick((current) => current + 1);
          playSoftHaptic();
        } else if (path.includes("focus=autopilot")) {
          setActionNotice("Opened from Morning Autopilot. Review today's prepared plan.");
          playSoftHaptic();
        } else if (path.includes("focus=clinical")) {
          setActionNotice("Opened from your clinical follow-up.");
          playSoftHaptic();
        }
        void loadCompanionData(session);
        return;
      }

      if (path?.startsWith("/")) {
        void openPath(path);
        return;
      }

      setActiveView("message");
      selectedMessageOffsetY.current = null;
      setNotificationFocusTick((current) => current + 1);
      playSoftHaptic();
      void loadCompanionData(session);
    },
    [loadCompanionData, openPath, session]
  );

  const recordNotificationResponse = useCallback(
    async (action: "done" | "later", data?: NotificationTapData) => {
      if (!supabase || !session) return;

      await supabase.from("behavior_events").insert({
        user_id: session.user.id,
        type: "coach_notification",
        event_type: `coach_notification_${action}`,
        action: action === "done" ? "Acknowledged coach signal" : "Saved coach signal for later",
        outcome: action,
        payload: {
          alert_id: data?.alertId || data?.alert_id || null,
          source: "mobile_push_action",
        },
      });
    },
    [session]
  );

  useEffect(() => {
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("coach-updates", {
        name: "Coach updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 120],
        lightColor: "#f2dc9c",
      });
      void Notifications.setNotificationChannelAsync("protocol-reminders", {
        name: "Protocol reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#f2dc9c",
      });
    }

    if (Platform.OS === "ios" || Platform.OS === "android") {
      void Notifications.setNotificationCategoryAsync("coach-message", [
        {
          identifier: "open",
          buttonTitle: "Open",
          options: { opensAppToForeground: true },
        },
        {
          identifier: "later",
          buttonTitle: "Later",
          options: { opensAppToForeground: true },
        },
        {
          identifier: "done",
          buttonTitle: "Done",
          options: { opensAppToForeground: true },
        },
      ]).catch(() => null);
    }

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const actionIdentifier = response.actionIdentifier;
        const data = response.notification.request.content.data as
          | NotificationTapData
          | undefined;

        if (actionIdentifier === "later") {
          void recordNotificationResponse("later", data);
          setActiveView("today");
          setInboxNotice("Coach message saved for later.");
          playSoftHaptic();
          return;
        }

        if (actionIdentifier === "done") {
          void recordNotificationResponse("done", data);
          setActiveView("today");
          setInboxNotice("Noted. Aeonvera marked this signal as acknowledged.");
          playSoftHaptic();
          return;
        }

        handleNotificationTap(data);
      });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      handleNotificationTap(
        response.notification.request.content.data as NotificationTapData | undefined
      );
    });

    return () => responseSubscription.remove();
  }, [handleNotificationTap, recordNotificationResponse]);

  async function signIn() {
    if (!supabase) {
      Alert.alert(
        "Mobile auth not configured",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env."
      );
      return;
    }

    if (!email || !password) {
      Alert.alert("Sign in", "Enter your Aeonvera email and password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert("Sign in failed", error.message);
      return;
    }

    setAuthStatus("Signed in");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPushStatus("Not requested");
  }

  async function savePreferences(next: Partial<Preferences>) {
    if (!supabase || !session) return;

    const merged: Preferences = {
      user_id: session.user.id,
      email_enabled: preferences?.email_enabled !== false,
      push_enabled: preferences?.push_enabled === true,
      quiet_hours_start: preferences?.quiet_hours_start || "22:00",
      quiet_hours_end: preferences?.quiet_hours_end || "07:00",
      timezone: preferences?.timezone || "UTC",
      ...next,
    };

    setPreferences(merged);

    const { error } = await supabase.from("notification_preferences").upsert(
      {
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (next.push_enabled === false) {
      await supabase
        .from("push_subscriptions")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("user_id", session.user.id);
    }

    if (error) {
      Alert.alert("Preferences", error.message);
    }
  }

  async function saveAutopilotPreferences(next: Partial<AutopilotPreferences>) {
    if (!session) return;

    const merged: AutopilotPreferences = {
      ...defaultAutopilotPreferences(session.user.id),
      ...(autopilotPreferences || {}),
      ...next,
    };

    if (next.auto_schedule_enabled === true && merged.mode !== "sovereign") {
      merged.mode = "autopilot";
    }

    if (merged.mode !== "autopilot" && merged.mode !== "sovereign") {
      merged.auto_schedule_enabled = false;
    }

    setAutopilotPreferences(merged);

    const response = await fetch(`${appUrl}/api/autopilot/daily-plan`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(merged),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || result?.migrationRequired) {
      Alert.alert(
        "Autopilot preferences",
        result?.message || result?.error || "Autopilot preferences could not be saved."
      );
      return;
    }

    setAutopilotPreferences(result.preferences as AutopilotPreferences);
    setActionNotice("Autopilot preferences updated.");
  }

  async function updateDailyPlanStatus(
    status: DailyExecutionPlan["status"],
    scheduledEventIds?: string[]
  ) {
    if (!session) return;

    const response = await fetch(`${appUrl}/api/autopilot/daily-plan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        ...(scheduledEventIds ? { scheduled_event_ids: scheduledEventIds } : {}),
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      Alert.alert(
        "Daily plan",
        result?.error || "Daily plan status could not be updated."
      );
      return;
    }

    if (result?.plan) {
      setDailyPlan(result.plan as DailyExecutionPlan);
    } else if (dailyPlan) {
      setDailyPlan({ ...dailyPlan, status });
    }
  }

  async function acceptDailyPlan(forceRecreate = false) {
    if (acceptingDailyPlan) return;

    if (!dailyPlan?.plan?.items?.length) {
      Alert.alert("Autopilot", "There is no prepared plan to accept yet.");
      return;
    }

    const activeArtifacts = await reconcileScheduledArtifacts(dailyPlan.plan.items);

    if (
      !forceRecreate &&
      (dailyPlan.status === "accepted" || dailyPlan.status === "auto_scheduled")
    ) {
      const existingCount = activeArtifacts.activeCalendar + activeArtifacts.activeNotifications;

      setActionNotice(
        existingCount
          ? "Today is already prepared. Tap Recreate only if you want Aeonvera to add a fresh set."
          : "Today was prepared earlier. If you deleted the calendar events, Aeonvera can recreate them."
      );
      Alert.alert(
        "Today is already prepared",
        existingCount
          ? "Aeonvera already has calendar or notification records for this plan. Do you want to add a fresh set anyway?"
          : "Aeonvera marked this plan prepared earlier. If you removed the events from your calendar, you can recreate them now.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Recreate",
            onPress: () => void acceptDailyPlan(true),
          },
        ]
      );
      return;
    }

    const preferences = autopilotPreferences || defaultAutopilotPreferences(session?.user.id || "");
    const items = dailyPlan.plan.items.slice(0, 5);
    let scheduled = 0;
    let notified = 0;
    let skippedExisting = 0;
    const scheduledEvents: CalendarScheduleResult[] = [];
    const scheduledEventIds = new Set(dailyPlan.scheduled_event_ids || []);

    setAcceptingDailyPlan(true);

    try {
      for (const item of items) {
        if (!item.action || !protocol?.id) continue;

        const actionKey = getReminderKey(protocol.id, item);
        if (
          !forceRecreate &&
          (activeArtifacts.nativeCalendarEvents[actionKey] ||
            activeArtifacts.localReminders[actionKey])
        ) {
          skippedExisting += 1;
          continue;
        }

        if (preferences.calendar_enabled && item.execution_mode !== "notify") {
          const event = await scheduleActionToNativeCalendar(item, "default", true);
          if (event) {
            scheduled += 1;
            scheduledEvents.push(event);
            if (event.calendarEventId) scheduledEventIds.add(event.calendarEventId);
          }
        }

        if (
          preferences.notifications_enabled &&
          (item.execution_mode === "notify" || !preferences.calendar_enabled)
        ) {
          const notificationId = await scheduleActionReminder(
            item,
            item.scope,
            "default",
            "once",
            true
          );
          if (notificationId) notified += 1;
        }
      }

      await updateDailyPlanStatus(
        preferences.mode === "autopilot" || preferences.mode === "sovereign"
          ? "auto_scheduled"
          : "accepted",
        Array.from(scheduledEventIds)
      );

      const confirmation =
        scheduled || notified
          ? `Created ${scheduled} calendar block${scheduled === 1 ? "" : "s"}${
              notified ? ` and ${notified} phone notification${notified === 1 ? "" : "s"}` : ""
            }${
              scheduledEvents.length
                ? `: ${scheduledEvents
                    .slice(0, 3)
                    .map((event) => formatReminderDate(new Date(event.scheduledFor)))
                    .join(", ")}`
                : ""
            }.${skippedExisting ? ` ${skippedExisting} already existed.` : ""}`
          : skippedExisting
            ? "Today was already prepared. No duplicate calendar events were created."
            : "Today is accepted. Aeonvera will hold the plan in your active queue.";

      setActionNotice(confirmation);
      playSoftHaptic();
      Alert.alert("Today is prepared", confirmation);
    } finally {
      setAcceptingDailyPlan(false);
    }
  }

  async function skipDailyPlan() {
    await updateDailyPlanStatus("skipped");
    setActionNotice("Autopilot paused for today. Your protocol remains available below.");
    playSoftHaptic();
  }

  async function askPersonalAgent(promptOverride?: string, options: AgentSendOptions = {}) {
    if (!session?.access_token || agentThinking) return;

    const question = (promptOverride || agentPrompt).trim();
    if (!question) return;

    const history = agentMessages.slice(-8);
    setAgentMessages((current) => [...current, { role: "user", content: question }]);
    setAgentPrompt("");
    setAgentThinking(true);

    try {
      const response = await fetch(`${appUrl}/api/agent/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, history, ...options }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Aeonvera could not answer right now.");
      }

      setAgentMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result?.answer || "Aeonvera is still reading today's signal.",
        },
      ]);

      if (Array.isArray(result?.suggestedPrompts)) {
        setAgentSuggestions(result.suggestedPrompts.slice(0, 3));
      }

      if (result?.usage?.meter) {
        setUsageLimits((current) => updateUsageMeter(current, result.usage));
      }

      if (Array.isArray(result?.actions)) {
        const actions = result.actions.slice(0, 4) as AgentAppliedAction[];
        setAgentActions(actions);

        if (
          actions.some((action) =>
            ["plan_simplified", "clinical_follow_up_plan_updated"].includes(action.type)
          )
        ) {
          void loadCompanionData(session);
        }
      }

      await refreshClinicalInsights();
      if (options.clinicalFollowUpAnswer) {
        setClinicalAnswerDraft("");
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

  async function refreshClinicalInsights() {
    if (!session?.access_token) return;

    const response = await fetch(`${appUrl}/api/clinical/insights`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }).catch(() => null);

    if (!response?.ok) return;

    const result = await response.json().catch(() => null);
    setClinicalInsights((result?.insights || []) as ClinicalInsight[]);
  }

  async function startAgentVoice(clinicalInsightId?: string) {
    if (!session?.access_token || agentThinking || voiceRecording) return;

    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      Alert.alert("Native only", "Voice conversation is available in the mobile app.");
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone needed", "Allow microphone access to speak with Aeonvera.");
        return;
      }

      await Speech.stop();
      setVoiceSpeaking(false);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      setActiveVoiceClinicalInsightId(clinicalInsightId || null);
      setVoiceRecording(recording);
      setVoicePhase("listening");
      setLastVoiceTranscript(null);
      setVoiceStatus(
        clinicalInsightId
          ? "Listening for your clinical follow-up answer. Speak naturally."
          : "Listening. Speak naturally, then tap finish."
      );
      playSoftHaptic();
    } catch (error) {
      setVoiceRecording(null);
      setVoiceStatus(null);
      Alert.alert(
        "Voice did not start",
        error instanceof Error ? error.message : "Aeonvera could not open the microphone."
      );
    }
  }

  async function stopAgentVoice() {
    if (!session?.access_token || !voiceRecording) return;

    const recording = voiceRecording;
    setVoiceRecording(null);
    setAgentThinking(true);
    setVoicePhase("processing");
    setVoiceStatus("Understanding your question and reading your health context.");

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        throw new Error("No voice recording was captured.");
      }

      const history = agentMessages.slice(-8);
      const formData = new FormData();
      formData.append("history", JSON.stringify(history));
      if (activeVoiceClinicalInsightId) {
        formData.append("clinicalInsightId", activeVoiceClinicalInsightId);
        formData.append("clinicalFollowUpAnswer", "true");
      }
      formData.append("audio", {
        uri,
        name: "aeonvera-voice.m4a",
        type: Platform.OS === "ios" ? "audio/m4a" : "audio/mp4",
      } as unknown as Blob);

      const response = await fetch(`${appUrl}/api/agent/voice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Aeonvera could not understand that voice note.");
      }

      const transcript = result?.transcript || "Voice question";
      const answer = result?.answer || "Aeonvera is still reading today's signal.";
      setLastVoiceTranscript(transcript);
      setLastVoiceAnswer(answer);
      setAgentMessages((current) => [
        ...current,
        { role: "user", content: transcript },
        { role: "assistant", content: answer },
      ]);

      if (Array.isArray(result?.suggestedPrompts)) {
        setAgentSuggestions(result.suggestedPrompts.slice(0, 3));
      }

      if (result?.usage?.meter) {
        setUsageLimits((current) => updateUsageMeter(current, result.usage));
      }

      if (Array.isArray(result?.actions)) {
        const actions = result.actions.slice(0, 4) as AgentAppliedAction[];
        setAgentActions(actions);

        if (
          actions.some((action) =>
            ["plan_simplified", "clinical_follow_up_plan_updated"].includes(action.type)
          )
        ) {
          void loadCompanionData(session);
        }
      }

      setVoiceStatus("Aeonvera is answering. You can stop the voice or ask a follow-up.");
      setActiveVoiceClinicalInsightId(null);
      await refreshClinicalInsights();
      speakAgentAnswer(answer);
      playSoftHaptic();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Aeonvera could not process voice right now.";
      setVoiceStatus(message);
      setVoicePhase("idle");
      setActiveVoiceClinicalInsightId(null);
      setAgentMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setAgentThinking(false);
    }
  }

  async function cancelAgentVoice() {
    if (!voiceRecording) return;

    const recording = voiceRecording;
    setVoiceRecording(null);
    setActiveVoiceClinicalInsightId(null);
    setVoicePhase("idle");
    setVoiceStatus("Voice note cancelled.");

    await recording.stopAndUnloadAsync().catch(() => null);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    }).catch(() => null);
  }

  function speakAgentAnswer(answer: string) {
    if (!answer.trim()) return;

    setVoiceSpeaking(true);
    setVoicePhase("speaking");
    Speech.speak(answer.replace(/\s+/g, " ").slice(0, 3600), {
      language: "en-US",
      pitch: 0.92,
      rate: Platform.OS === "ios" ? 0.48 : 0.86,
      onDone: () => {
        setVoiceSpeaking(false);
        setVoicePhase("ready_follow_up");
        setVoiceStatus("Ready for a follow-up.");
      },
      onError: () => {
        setVoiceSpeaking(false);
        setVoicePhase("ready_follow_up");
      },
      onStopped: () => {
        setVoiceSpeaking(false);
        setVoicePhase("ready_follow_up");
      },
    });
  }

  async function stopAgentSpeech() {
    await Speech.stop();
    setVoiceSpeaking(false);
    setVoicePhase("ready_follow_up");
    setVoiceStatus("Voice reply stopped. Ask a follow-up when ready.");
  }

  async function reconcileScheduledArtifacts(items: ScheduledProtocolAction[]) {
    if (!protocol?.id) {
      return {
        activeCalendar: 0,
        activeNotifications: 0,
        nativeCalendarEvents,
        localReminders,
      };
    }

    const notificationIds = new Set(
      await Notifications.getAllScheduledNotificationsAsync()
        .then((notifications) => notifications.map((item) => item.identifier))
        .catch(() => [])
    );
    const nextNativeEvents = { ...nativeCalendarEvents };
    const nextLocalReminders = { ...localReminders };
    let activeCalendar = 0;
    let activeNotifications = 0;
    let changed = false;

    for (const item of items) {
      const actionKey = getReminderKey(protocol.id, item);
      const nativeEvent = nextNativeEvents[actionKey];
      const localReminder = nextLocalReminders[actionKey];

      if (nativeEvent?.eventId) {
        const exists = await Calendar.getEventAsync(nativeEvent.eventId)
          .then(Boolean)
          .catch(() => false);

        if (exists) {
          activeCalendar += 1;
        } else {
          delete nextNativeEvents[actionKey];
          changed = true;
        }
      }

      if (localReminder?.notificationId) {
        if (notificationIds.has(localReminder.notificationId)) {
          activeNotifications += 1;
        } else {
          delete nextLocalReminders[actionKey];
          changed = true;
        }
      }
    }

    if (changed) {
      setNativeCalendarEvents(nextNativeEvents);
      setLocalReminders(nextLocalReminders);
    }

    return {
      activeCalendar,
      activeNotifications,
      nativeCalendarEvents: nextNativeEvents,
      localReminders: nextLocalReminders,
    };
  }

  async function recordExecutionFeedback(
    feedback: PendingFeedback,
    outcome: "done" | "partly" | "missed" | "reschedule"
  ) {
    if (!supabase || !session) return;

    const normalizedOutcome =
      outcome === "done" ? "success" : outcome === "missed" ? "failure" : "unknown";
    const confidence =
      outcome === "done" ? 0.92 : outcome === "missed" ? 0.86 : outcome === "partly" ? 0.62 : 0.5;
    const notes =
      outcome === "done"
        ? "Completed from mobile execution feedback."
        : outcome === "partly"
          ? "Partly completed from mobile execution feedback."
          : outcome === "missed"
            ? "Missed from mobile execution feedback."
            : "Requested reschedule from mobile execution feedback.";

    const { data, error } = await supabase
      .from("intervention_outcomes")
      .insert({
        user_id: session.user.id,
        protocol_id: feedback.protocolId || protocol?.id || null,
        domain: feedback.domain,
        action: feedback.action,
        outcome: normalizedOutcome,
        success: normalizedOutcome === "success",
        confidence,
        notes,
        measured_at: new Date().toISOString(),
        followup_snapshot: {
          source: "mobile_execution_feedback",
          calendar_event_id: feedback.calendarEventId || null,
          scheduled_for: feedback.scheduledFor || null,
          action_index: feedback.actionIndex,
          action_scope: feedback.scope,
          feedback_outcome: outcome,
        },
      })
      .select("id,protocol_id,domain,action,outcome,success,notes,measured_at,created_at")
      .single();

    if (error) {
      Alert.alert("Feedback not saved", error.message);
      return;
    }

    await Promise.all([
      supabase.from("behavior_learning_events").insert({
        user_id: session.user.id,
        domain: feedback.domain,
        action: feedback.action,
        outcome: normalizedOutcome,
        confidence,
        source: "manual",
      }),
      supabase.from("behavior_events").insert({
        user_id: session.user.id,
        type: "execution_feedback",
        event_type: `calendar_action_${outcome}`,
        domain: feedback.domain,
        action: feedback.action,
        outcome: normalizedOutcome,
        payload: {
          calendar_event_id: feedback.calendarEventId || null,
          protocol_id: feedback.protocolId || protocol?.id || null,
          scheduled_for: feedback.scheduledFor || null,
          source: "mobile",
        },
      }),
    ]);

    if (feedback.calendarEventId) {
      await updateCalendarFeedbackPayload(
        feedback.calendarEventId,
        outcome,
        (data as AdherenceEvent).id
      );
    }

    setAdherenceEvents((current) => [
      data as AdherenceEvent,
      ...current.filter((event) => event.action !== feedback.action),
    ]);

    setPendingFeedback(null);

    if (outcome === "reschedule") {
      const nextAction: ScheduledProtocolAction = {
        action: feedback.action,
        actionIndex: feedback.actionIndex,
        domain: feedback.domain,
        scope: feedback.scope,
      };
      const event = await scheduleActionToNativeCalendar(nextAction, "tomorrow", true);
      const message = event
        ? `Feedback saved. Aeonvera rescheduled it for ${formatReminderDate(new Date(event.scheduledFor))}.`
        : "Feedback saved. Aeonvera could not create a new calendar block.";
      setActionNotice(message);
      Alert.alert("Feedback saved", message);
    } else {
      const message =
        outcome === "done"
          ? "Marked complete. Aeonvera will favor this pattern."
          : outcome === "partly"
            ? "Marked partly complete. Aeonvera will look for friction, not failure."
            : "Marked missed. Aeonvera will adapt the timing and load.";
      setActionNotice(message);
      Alert.alert("Feedback saved", message);
    }

    playSoftHaptic();
  }

  async function updateCalendarFeedbackPayload(
    calendarEventId: string,
    outcome: "done" | "partly" | "missed" | "reschedule",
    interventionOutcomeId: string
  ) {
    if (!supabase || !session) return;

    const existing = await supabase
      .from("calendar_events")
      .select("payload")
      .eq("id", calendarEventId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    const existingPayload =
      existing.data?.payload && typeof existing.data.payload === "object"
        ? (existing.data.payload as Record<string, unknown>)
        : {};

    await supabase
      .from("calendar_events")
      .update({
        payload: {
          ...existingPayload,
          feedback_outcome: outcome,
          feedback_recorded_at: new Date().toISOString(),
          intervention_outcome_id: interventionOutcomeId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", calendarEventId)
      .eq("user_id", session.user.id);
  }

  async function scheduleActionReminder(
    action: ScheduledProtocolAction,
    scope: ActionScope,
    preset: ReminderPreset = "default",
    repeat: ReminderRepeat = "once",
    silent = false
  ) {
    if (!supabase || !session || !protocol?.id || !action.action) return null;

    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      Alert.alert("Native only", "Protocol reminders are available in the mobile app.");
      return null;
    }

    const current = await Notifications.getPermissionsAsync();
    const finalPermission = isNotificationPermissionGranted(current)
      ? current
      : await Notifications.requestPermissionsAsync();

    if (!isNotificationPermissionGranted(finalPermission)) {
      Alert.alert("Notification not scheduled", "Notification permission was not granted.");
      return null;
    }

    const scheduledFor = getReminderDate(scope, preset, action);
    const trigger = getReminderTrigger(scheduledFor, repeat);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Aeonvera protocol reminder",
        body: action.action,
        data: {
          path: "/companion",
          protocol_id: protocol.id,
          action: action.action,
          action_scope: scope,
          reminder_preset: preset,
          reminder_repeat: repeat,
        },
      },
      trigger,
    });

    const reminderKey = getReminderKey(protocol.id, action);
    setLocalReminders((current) => ({
      ...current,
      [reminderKey]: {
        notificationId,
        repeat,
        scheduledFor: scheduledFor.toISOString(),
      },
    }));

    await supabase.from("behavior_events").insert({
      user_id: session.user.id,
      type: "protocol_reminder",
      event_type: "protocol_reminder_scheduled",
      domain: action.domain || "Optimization",
      action: action.action,
      outcome: "scheduled",
      payload: {
        protocol_id: protocol.id,
        notification_id: notificationId,
        action_index: action.actionIndex,
        action_scope: scope,
        reminder_preset: preset,
        reminder_repeat: repeat,
        scheduled_for: scheduledFor.toISOString(),
        source: "mobile",
      },
    });

    setActionNotice(
      `Phone notification scheduled ${formatReminderDate(scheduledFor)}${
        repeat === "once" ? "" : `, ${repeat}`
      }.`
    );
    if (!silent) {
      Alert.alert(
        "Phone notification scheduled",
        `Aeonvera will send a phone notification ${formatReminderDate(scheduledFor)}${
          repeat === "once" ? "" : `, ${repeat}`
        }. This does not create a calendar event.`
      );
    }

    return notificationId;
  }

  async function scheduleActionToNativeCalendar(
    action: ScheduledProtocolAction,
    preset: ReminderPreset = "default",
    silent = false
  ): Promise<CalendarScheduleResult | null> {
    if (!supabase || !session || !protocol?.id || !action.action) return null;

    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      Alert.alert("Native only", "Device calendar scheduling is available in the mobile app.");
      return null;
    }

    const currentPermission = await Calendar.getCalendarPermissionsAsync().catch(() => null);
    const finalPermission =
      currentPermission && isPermissionGranted(currentPermission)
        ? currentPermission
        : await Calendar.requestCalendarPermissionsAsync();

    if (!isPermissionGranted(finalPermission)) {
      Alert.alert("Calendar not connected", "Calendar permission was not granted.");
      return null;
    }

    const calendar = await getWritableDeviceCalendar();
    if (!calendar) {
      Alert.alert("Calendar unavailable", "No writable calendar was found on this device.");
      return null;
    }

    const schedule = await findIntelligentCalendarSlot(calendar.id, action, preset);
    const scheduledFor = schedule.scheduledFor;
    const durationMinutes = getActionDurationMinutes(action);
    const endDate = new Date(scheduledFor.getTime() + durationMinutes * 60 * 1000);
    const title = `Aeonvera protocol: ${action.domain || "Optimization"}`;
    const notes = [
      action.action,
      action.why ? `Why: ${action.why}` : "",
      "Scheduled from Aeonvera mobile.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const eventId = await Calendar.createEventAsync(calendar.id, {
      title,
      startDate: scheduledFor,
      endDate,
      notes,
      alarms: [{ relativeOffset: -15 }],
      url: appUrl,
    });

    const calendarEventKey = getReminderKey(protocol.id, action);
    setNativeCalendarEvents((current) => ({
      ...current,
      [calendarEventKey]: {
        eventId,
        calendarTitle: calendar.title || "Calendar",
        scheduledFor: scheduledFor.toISOString(),
        reason: schedule.reason,
      },
    }));

    const provider = Platform.OS === "ios" ? "apple" : "android";
    const calendarRecordResult = await supabase
      .from("calendar_events")
      .insert({
        user_id: session.user.id,
        protocol_id: protocol.id,
        provider,
        provider_event_id: eventId,
        calendar_id: calendar.id,
        title,
        description: notes,
        action: action.action,
        action_scope: action.scope,
        scheduled_for: scheduledFor.toISOString(),
        duration_minutes: durationMinutes,
        recurrence: "none",
        status: "scheduled",
        payload: {
          source: "mobile_device_calendar",
          calendar_title: calendar.title || null,
          platform: Platform.OS,
          action_index: action.actionIndex,
          schedule_reason: schedule.reason,
          preferred_time: schedule.preferredFor.toISOString(),
          conflict_checked: true,
        },
      })
      .select("id")
      .maybeSingle();
    const calendarEventId = calendarRecordResult.data?.id || null;
    const feedbackNotificationId = await scheduleExecutionFeedbackPrompt({
      action,
      calendarEventId,
      endDate,
      protocolId: protocol.id,
      scheduledFor,
    });

    setNativeCalendarEvents((current) => ({
      ...current,
      [calendarEventKey]: {
        ...(current[calendarEventKey] || {}),
        calendarEventId,
        feedbackNotificationId,
      },
    }));

    if (!calendarRecordResult.error) {
      await supabase.from("behavior_events").insert({
        user_id: session.user.id,
        type: "calendar_event",
        event_type: "native_calendar_event_scheduled",
        domain: action.domain || "Execution",
        action: action.action,
        outcome: "scheduled",
        payload: {
          protocol_id: protocol.id,
          calendar_event_id: calendarEventId,
          provider,
          provider_event_id: eventId,
          action_scope: action.scope,
          scheduled_for: scheduledFor.toISOString(),
          schedule_reason: schedule.reason,
          feedback_notification_id: feedbackNotificationId,
          source: "mobile_device_calendar",
        },
      });
    }

    const calendarAppName = Platform.OS === "ios" ? "Apple Calendar" : "Android Calendar";
    if (!silent) {
      setActionNotice(
        `${calendarAppName} event added ${formatReminderDate(scheduledFor)} in ${
          calendar.title || "your calendar"
        }. ${schedule.reason}`
      );
      playSoftHaptic();
    }
    if (!silent) {
      Alert.alert(
        "Added to calendar",
        `Scheduled ${formatReminderDate(scheduledFor)} in ${calendar.title || "your calendar"}. ${schedule.reason}`
      );
    }

    return {
      eventId,
      calendarTitle: calendar.title || "Calendar",
      calendarEventId,
      scheduledFor: scheduledFor.toISOString(),
      reason: schedule.reason,
    };
  }

  async function scheduleExecutionFeedbackPrompt({
    action,
    calendarEventId,
    endDate,
    protocolId,
    scheduledFor,
  }: {
    action: ScheduledProtocolAction;
    calendarEventId?: string | null;
    endDate: Date;
    protocolId: string;
    scheduledFor: Date;
  }) {
    const permission = await Notifications.getPermissionsAsync().catch(() => null);
    if (!permission || !isNotificationPermissionGranted(permission)) {
      return null;
    }

    const feedbackAt = new Date(endDate.getTime() + 10 * 60 * 1000);
    if (feedbackAt.getTime() <= Date.now() + 60 * 1000) {
      feedbackAt.setTime(Date.now() + 5 * 60 * 1000);
    }

    return Notifications.scheduleNotificationAsync({
      content: {
        title: "Aeonvera execution check",
        body: `Did you complete ${action.action}?`,
        data: {
          target: "action_feedback",
          action: action.action,
          actionIndex: action.actionIndex,
          actionScope: action.scope,
          calendarEventId,
          domain: action.domain || "Optimization",
          protocolId,
          scheduledFor: scheduledFor.toISOString(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: feedbackAt,
      },
    }).catch(() => null);
  }

  async function prepareNotifications() {
    if (!session?.access_token) {
      Alert.alert("Sign in required", "Sign in before registering this device.");
      return;
    }

    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      Alert.alert("Native only", "Use the web app for browser push notifications.");
      return;
    }

    const current = await Notifications.getPermissionsAsync();
    const finalPermission = isNotificationPermissionGranted(current)
      ? current
      : await Notifications.requestPermissionsAsync();

    if (!isNotificationPermissionGranted(finalPermission)) {
      setPushStatus("Permission not granted");
      Alert.alert("Notifications", "Notification permission was not granted.");
      return;
    }

    if (!EAS_PROJECT_ID) {
      setPushStatus("Missing Expo project ID");
      Alert.alert(
        "Expo project ID needed",
        "Create or connect the Expo project, add EXPO_PUBLIC_EAS_PROJECT_ID to apps/mobile/.env, then restart Expo with --clear."
      );
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    }).catch(() => null);

    if (!token?.data) {
      setPushStatus("Permission granted");
      Alert.alert("Notifications", "Permission is ready, but no Expo token was returned.");
      return;
    }

    const response = await fetch(`${appUrl}/api/notifications/push-subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: Platform.OS,
        token: token.data,
        device_name: Device.deviceName || `${Platform.OS} device`,
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const message = result?.error || "Could not sync this device.";
      setPushStatus("Sync failed");
      Alert.alert("Notification sync failed", message);
      return;
    }

    setPushStatus("Ready for native push");
    await savePreferences({ push_enabled: true });
    Alert.alert(
      "Notifications connected",
      "This device is now connected to Aeonvera coach notifications."
    );
  }

  async function sendMorningAutopilotBrief() {
    if (!session?.access_token) {
      Alert.alert("Sign in required", "Sign in before sending Morning Autopilot.");
      return;
    }

    const response = await fetch(`${appUrl}/api/autopilot/morning-brief`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      Alert.alert(
        "Morning Autopilot",
        result?.result?.reason || result?.error || "Morning Autopilot could not run."
      );
      return;
    }

    setActionNotice("Morning Autopilot sent. Check your phone notification and inbox.");
    playSoftHaptic();
    Alert.alert(
      "Morning Autopilot sent",
      "Aeonvera prepared today and sent the morning notification."
    );
    void loadCompanionData(session);
  }

  async function runLaunchDiagnostics() {
    setDiagnosticsRunning(true);
    const checks: DiagnosticCheck[] = [];

    const addCheck = (check: DiagnosticCheck) => {
      checks.push(check);
      setDiagnosticChecks([...checks]);
    };

    try {
      addCheck({
        label: "Mobile environment",
        status: supabase && SUPABASE_URL && SUPABASE_ANON_KEY ? "pass" : "fail",
        detail:
          supabase && SUPABASE_URL && SUPABASE_ANON_KEY
            ? "Supabase URL and public key are available."
            : "Supabase mobile env vars are missing.",
      });

      addCheck({
        label: "Signed-in account",
        status: session?.user?.id ? "pass" : "fail",
        detail: session?.user?.id
          ? "Secure session is active on this device."
          : "Sign in before testing production readiness.",
      });

      addCheck({
        label: "Expo project",
        status: EAS_PROJECT_ID ? "pass" : "fail",
        detail: EAS_PROJECT_ID
          ? "EAS project ID is available for native push tokens."
          : "Add EXPO_PUBLIC_EAS_PROJECT_ID before production builds.",
      });

      const notificationPermission = await Notifications.getPermissionsAsync().catch(() => null);
      const notificationsGranted =
        notificationPermission && isNotificationPermissionGranted(notificationPermission);
      addCheck({
        label: "Notification permission",
        status: notificationsGranted ? "pass" : "warn",
        detail: notificationsGranted
          ? "This device has notification permission."
          : "Notifications are not granted on this device yet.",
      });

      let tokenSynced = false;
      if (session?.access_token && EAS_PROJECT_ID && notificationsGranted) {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: EAS_PROJECT_ID,
        }).catch(() => null);

        if (token?.data) {
          const response = await fetch(`${appUrl}/api/notifications/push-subscriptions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              platform: Platform.OS,
              token: token.data,
              device_name: Device.deviceName || `${Platform.OS} device`,
            }),
          });
          tokenSynced = response.ok;
        }
      }
      addCheck({
        label: "Native push token",
        status: tokenSynced ? "pass" : "warn",
        detail: tokenSynced
          ? "Expo push token registered with Aeonvera."
          : "Token was not registered. Connect notifications, then rerun diagnostics.",
      });

      const calendarPermission = await Calendar.getCalendarPermissionsAsync().catch(() => null);
      const calendarGranted = calendarPermission && isPermissionGranted(calendarPermission);
      const writableCalendars = calendarGranted
        ? await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
            .then((calendars) => calendars.filter((calendar) => calendar.allowsModifications))
            .catch(() => [])
        : [];
      addCheck({
        label: "Device calendar",
        status: calendarGranted && writableCalendars.length ? "pass" : "warn",
        detail:
          calendarGranted && writableCalendars.length
            ? `${writableCalendars.length} writable calendar${writableCalendars.length === 1 ? "" : "s"} available.`
            : "Calendar permission or writable calendar is missing.",
      });

      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync()
        .then((items) => items.length)
        .catch(() => 0);
      addCheck({
        label: "Scheduled nudges",
        status: scheduledNotifications ? "pass" : "warn",
        detail: scheduledNotifications
          ? `${scheduledNotifications} notification${scheduledNotifications === 1 ? "" : "s"} scheduled on this device.`
          : "No local notifications are scheduled yet.",
      });

      const allPass = checks.every((check) => check.status === "pass");
      setPushStatus(allPass ? "Launch diagnostics passed" : "Diagnostics need attention");
      setActionNotice(
        allPass
          ? "Launch diagnostics passed on this device."
          : "Diagnostics finished. Review the items that need attention."
      );
      playSoftHaptic();
    } finally {
      setDiagnosticsRunning(false);
    }
  }

  const latestActions = protocol?.protocol?.primary_protocol || [];
  const latestSummary =
    protocol?.summary || protocol?.protocol?.summary || "Generate your first protocol from Optimize.";
  const latestMessage =
    coachMessages[0]?.message ||
    protocol?.protocol?.coach_message ||
    "Your coach feed will appear here as Aeonvera learns your patterns.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="rgba(218,188,115,0.92)"
            onRefresh={() => void loadCompanionData(session, true)}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>AEONVERA MOBILE</Text>
          <Text style={styles.title}>Your healthspan companion.</Text>
          <Text style={styles.copy}>
            Today&apos;s protocol, coach inbox, and notification controls are
            connected to your live Aeonvera account.
          </Text>
        </View>

        {authInitializing ? (
          <View style={styles.panel}>
            <Text style={styles.cardLabel}>Aeonvera Account</Text>
            <Text style={styles.cardTitle}>Restoring session</Text>
            <Text style={styles.cardCopy}>
              Aeonvera is securely reopening your mobile companion.
            </Text>
          </View>
        ) : !session ? (
          <View style={styles.panel}>
            <Text style={styles.cardLabel}>Aeonvera Account</Text>
            <Text style={styles.cardTitle}>{authStatus}</Text>
            <Text style={styles.cardCopy}>
              Sign in with the same account you use on the website.
            </Text>
            <View style={styles.form}>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                autoCapitalize="none"
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.28)"
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable style={styles.button} onPress={() => void signIn()}>
                <Text style={styles.buttonText}>
                  {loading ? "Signing in" : "Sign in"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.statusRow}>
              <View>
                <Text style={styles.cardLabel}>Aeonvera Account</Text>
                <Text style={styles.smallTitle}>{authStatus}</Text>
              </View>
              <View style={styles.statusActions}>
                <Pressable style={styles.compactButton} onPress={() => void signOut()}>
                  <Text style={styles.compactButtonText}>Sign out</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.tabs}>
              {(["today", "agent", "inbox", "settings"] as ActiveView[]).map((view) => (
                <Pressable
                  key={view}
                  style={[
                    styles.tab,
                    (activeView === view || (activeView === "message" && view === "inbox")) &&
                      styles.activeTab,
                  ]}
                  onPress={() => setActiveView(view)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      (activeView === view || (activeView === "message" && view === "inbox")) &&
                        styles.activeTabText,
                    ]}
                  >
                    {view}
                  </Text>
                </Pressable>
              ))}
            </View>

            {dataMessage ? <Text style={styles.warning}>{dataMessage}</Text> : null}

            {activeView === "today" ? (
              <TodayView
                adherenceEvents={adherenceEvents}
                actionNotice={actionNotice}
                acceptingDailyPlan={acceptingDailyPlan}
                autopilotMessage={autopilotMessage}
                autopilotPreferences={autopilotPreferences}
                dailyPlan={dailyPlan}
                executionSummary={executionSummary}
                latestActions={latestActions}
                latestMessage={latestMessage}
                latestSummary={latestSummary}
                acceptDailyPlan={acceptDailyPlan}
                adjustAutopilot={() => {
                  playSoftHaptic();
                  setActiveView("settings");
                  setActionNotice("Autopilot settings opened.");
                }}
                openPath={openPath}
                protocol={protocol}
                skipDailyPlan={skipDailyPlan}
                nativeCalendarEvents={nativeCalendarEvents}
                localReminders={localReminders}
                pendingFeedback={pendingFeedback}
                recordExecutionFeedback={recordExecutionFeedback}
                setActionNotice={setActionNotice}
                onAskWhy={(question) => {
                  playSoftHaptic();
                  setActiveView("agent");
                  if (question) {
                    void askPersonalAgent(question);
                  }
                }}
              />
            ) : null}

            {activeView === "agent" ? (
              <AgentView
                messages={agentMessages}
                appliedActions={agentActions}
                clinicalAnswerDraft={clinicalAnswerDraft}
                clinicalInsights={clinicalInsights}
                prompt={agentPrompt}
                modalities={modalities}
                suggestions={agentSuggestions}
                thinking={agentThinking}
                usageLimits={usageLimits}
                voicePhase={voicePhase}
                lastVoiceTranscript={lastVoiceTranscript}
                lastVoiceAnswer={lastVoiceAnswer}
                voiceRecording={Boolean(voiceRecording)}
                voiceSpeaking={voiceSpeaking}
                voiceStatus={voiceStatus}
                onClinicalAnswerChange={setClinicalAnswerDraft}
                onSendClinicalAnswer={(insightId, answer) =>
                  void askPersonalAgent(answer, {
                    clinicalFollowUpAnswer: true,
                    clinicalInsightId: insightId,
                  })
                }
                onPromptChange={setAgentPrompt}
                onSend={(value) => void askPersonalAgent(value)}
                onStartVoice={(clinicalInsightId) => void startAgentVoice(clinicalInsightId)}
                onStopVoice={() => void stopAgentVoice()}
                onCancelVoice={() => void cancelAgentVoice()}
                onStopSpeech={() => void stopAgentSpeech()}
              />
            ) : null}

            {activeView === "inbox" ? (
              <InboxView
                messages={coachMessages}
                notice={inboxNotice}
                onInboxLayout={(event) => {
                  inboxOffsetY.current = event.nativeEvent.layout.y;
                }}
                onMessageListLayout={(event) => {
                  messageListOffsetY.current = event.nativeEvent.layout.y;
                }}
                onSelectedMessageLayout={(event) => {
                  selectedMessageOffsetY.current = event.nativeEvent.layout.y;
                }}
                openPath={openPath}
                selectedMessageId={selectedMessageId}
              />
            ) : null}

            {activeView === "message" ? (
              <MessageDetailView
                message={selectedMessage || coachMessages[0] || null}
                onBack={() => {
                  playSoftHaptic();
                  setActiveView("inbox");
                }}
                onDone={() => {
                  playSoftHaptic();
                  setActiveView("today");
                }}
                onOpen={() => {
                  const message = selectedMessage || coachMessages[0] || null;
                  if (message) {
                    void openMessage(message, openPath);
                  } else {
                    void openPath("/companion");
                  }
                }}
                onRemindLater={() => {
                  playSoftHaptic();
                  setActiveView("today");
                  setInboxNotice("Coach signal held for later.");
                }}
              />
            ) : null}

            {activeView === "settings" ? (
              <SettingsView
                autopilotPreferences={autopilotPreferences}
                diagnosticChecks={diagnosticChecks}
                diagnosticsRunning={diagnosticsRunning}
                preferences={preferences}
                pushStatus={pushStatus}
                prepareNotifications={prepareNotifications}
                runLaunchDiagnostics={runLaunchDiagnostics}
                saveAutopilotPreferences={saveAutopilotPreferences}
                savePreferences={savePreferences}
                sendMorningAutopilotBrief={sendMorningAutopilotBrief}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TodayView({
  acceptDailyPlan,
  acceptingDailyPlan,
  adjustAutopilot,
  adherenceEvents,
  actionNotice,
  autopilotMessage,
  autopilotPreferences,
  dailyPlan,
  executionSummary,
  latestActions,
  latestMessage,
  latestSummary,
  localReminders,
  nativeCalendarEvents,
  onAskWhy,
  openPath,
  pendingFeedback,
  protocol,
  recordExecutionFeedback,
  skipDailyPlan,
  setActionNotice,
}: {
  acceptDailyPlan: () => Promise<void>;
  acceptingDailyPlan: boolean;
  adjustAutopilot: () => void;
  adherenceEvents: AdherenceEvent[];
  actionNotice: string | null;
  autopilotMessage: string | null;
  autopilotPreferences: AutopilotPreferences | null;
  dailyPlan: DailyExecutionPlan | null;
  executionSummary: ExecutionSummary | null;
  latestActions: ProtocolAction[];
  latestMessage: string;
  latestSummary: string;
  localReminders: Record<string, LocalReminder>;
  nativeCalendarEvents: Record<string, NativeCalendarEvent>;
  onAskWhy: (question?: string) => void;
  openPath: (path: string) => Promise<void>;
  pendingFeedback: PendingFeedback | null;
  protocol: Protocol | null;
  recordExecutionFeedback: (
    feedback: PendingFeedback,
    outcome: "done" | "partly" | "missed" | "reschedule"
  ) => Promise<void>;
  skipDailyPlan: () => Promise<void>;
  setActionNotice: (message: string | null) => void;
}) {
  const [expandedActionKey, setExpandedActionKey] = useState<string | null>(null);
  const adherenceByAction = buildLatestAdherenceByAction(adherenceEvents);
  const groupedActions = groupActionsByScope(latestActions);
  const completedCount = latestActions.filter(
    (action) => adherenceByAction[action.action || ""]?.outcome === "success"
  ).length;
  const todayActions = groupedActions.today.slice(0, 3);
  const fallbackFocusActions = latestActions
    .slice(0, 3)
    .map((action, actionIndex) => ({
      ...action,
      actionIndex,
      scope: classifyActionScope(action),
    }));
  const secondarySections = ACTION_SECTIONS.filter(
    (section) => section.scope !== "today" && groupedActions[section.scope].length
  );
  const focusActions = todayActions.length ? todayActions : fallbackFocusActions;
  const primaryAction = focusActions[0] || null;
  const activeActionKey = expandedActionKey;

  return (
    <>
      <View style={styles.dailyBriefPanel}>
        <Text style={styles.cardLabel}>Daily Brief</Text>
        <Text style={styles.briefTitle}>What matters now</Text>
        <Text style={styles.briefCopy}>{latestMessage}</Text>
        {primaryAction ? (
          <View style={styles.briefAction}>
            <Text style={styles.selectedMessageLabel}>Highest leverage</Text>
            <Text style={styles.compactMessageTitle}>{primaryAction.action}</Text>
          </View>
        ) : null}
      </View>

      <AutopilotPlanCard
        acceptDailyPlan={acceptDailyPlan}
        acceptingDailyPlan={acceptingDailyPlan}
        adjustAutopilot={adjustAutopilot}
        autopilotMessage={autopilotMessage}
        dailyPlan={dailyPlan}
        localReminders={localReminders}
        nativeCalendarEvents={nativeCalendarEvents}
        onAskWhy={onAskWhy}
        preferences={autopilotPreferences}
        protocol={protocol}
        skipDailyPlan={skipDailyPlan}
      />

      <WeeklyExecutionReviewCard executionSummary={executionSummary} />

      {pendingFeedback ? (
        <ExecutionFeedbackCard
          feedback={pendingFeedback}
          onRecord={recordExecutionFeedback}
        />
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Today&apos;s Protocol</Text>
        <Text style={styles.cardTitle}>{protocol ? "Active protocol" : "Build protocol"}</Text>
        <Text style={styles.cardCopy}>{latestSummary}</Text>
        {latestActions.length ? (
          <View style={styles.protocolStats}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{latestActions.length}</Text>
              <Text style={styles.statLabel}>actions</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>complete</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{groupedActions.today.length}</Text>
              <Text style={styles.statLabel}>today</Text>
            </View>
          </View>
        ) : null}
        {actionNotice ? (
          <Pressable style={styles.actionNotice} onPress={() => setActionNotice(null)}>
            <Text style={styles.actionNoticeLabel}>Updated</Text>
            <Text style={styles.actionNoticeText}>{actionNotice}</Text>
          </Pressable>
        ) : null}
        <View style={styles.actionList}>
          {latestActions.length ? (
            <>
              {primaryAction ? (
                <View style={styles.primaryActionCard}>
                  <Text style={styles.cardLabel}>Now</Text>
                  <Text style={styles.primaryActionTitle}>{primaryAction.action}</Text>
                  {primaryAction.why ? (
                    <Text style={styles.cardCopy}>{primaryAction.why}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.actionSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>Today&apos;s focus</Text>
                    <Text style={styles.sectionCopy}>
                      The few actions that deserve attention first.
                    </Text>
                  </View>
                  <Text style={styles.sectionCount}>{groupedActions.today.length}</Text>
                </View>
                {focusActions.map((action) => {
                  const actionKey = getActionKey(action);
                  return (
                    <ProtocolActionRow
                      key={actionKey}
                      action={action}
                      expanded={activeActionKey === actionKey}
                      adherenceEvent={adherenceByAction[action.action || ""]}
                      localReminder={
                        protocol ? localReminders[getReminderKey(protocol.id, action)] : undefined
                      }
                      nativeCalendarEvent={
                        protocol ? nativeCalendarEvents[getReminderKey(protocol.id, action)] : undefined
                      }
                      onToggle={() => {
                        playSoftHaptic();
                        setExpandedActionKey(activeActionKey === actionKey ? null : actionKey);
                      }}
                    />
                  );
                })}
              </View>

              {secondarySections.length ? (
                <View style={styles.protocolOverview}>
                  <Text style={styles.cardLabel}>Protocol queue</Text>
                  {secondarySections.map((section) => {
                    const actions = groupedActions[section.scope];
                    const visibleActions = actions.slice(0, section.maxVisible);
                    const hiddenCount = Math.max(actions.length - visibleActions.length, 0);

                    return (
                      <View key={section.scope} style={styles.compactSection}>
                        <View style={styles.sectionHeader}>
                          <View style={styles.sectionText}>
                            <Text style={styles.compactSectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionCopy}>{section.copy}</Text>
                          </View>
                          <Text style={styles.sectionCount}>{actions.length}</Text>
                        </View>
                        {visibleActions.map((action) => (
                          <ProtocolActionRow
                            key={getActionKey(action)}
                            action={action}
                            compact={activeActionKey !== getActionKey(action)}
                            expanded={activeActionKey === getActionKey(action)}
                            adherenceEvent={adherenceByAction[action.action || ""]}
                            localReminder={
                              protocol ? localReminders[getReminderKey(protocol.id, action)] : undefined
                            }
                            nativeCalendarEvent={
                              protocol ? nativeCalendarEvents[getReminderKey(protocol.id, action)] : undefined
                            }
                            onToggle={() => {
                              playSoftHaptic();
                              setExpandedActionKey(
                                activeActionKey === getActionKey(action) ? null : getActionKey(action)
                              );
                            }}
                          />
                        ))}
                        {hiddenCount ? (
                          <Text style={styles.moreText}>
                            {hiddenCount} more action{hiddenCount === 1 ? "" : "s"} held in the active protocol.
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyText}>
              Answer the optimization intake to generate your first active protocol.
            </Text>
          )}
        </View>
        <Pressable style={styles.button} onPress={() => void openPath("/optimization")}>
          <Text style={styles.buttonText}>
            {protocol ? "Refine protocol" : "Open Optimize"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.shortcutGrid}>
        {shortcuts.map((item) => (
          <Pressable
            key={item.path}
            style={styles.shortcut}
            onPress={() => void openPath(item.path)}
          >
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.shortcutTitle}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.mobileCommandPanel}>
        <Text style={styles.cardLabel}>Connected Intelligence</Text>
        <Text style={styles.cardTitle}>What this app controls</Text>
        <View style={styles.mobileCommandGrid}>
          <MobileCommandStat
            label="Signals"
            value={String(Math.max(1, latestActions.length ? 3 : 1))}
            detail="Coach, protocol, and execution context."
          />
          <MobileCommandStat
            label="Reminders"
            value={String(Object.keys(localReminders).length)}
            detail="Phone notifications created on this device."
          />
          <MobileCommandStat
            label="Calendar"
            value={String(Object.keys(nativeCalendarEvents).length)}
            detail="Device calendar blocks scheduled."
          />
          <MobileCommandStat
            label="Complete"
            value={String(completedCount)}
            detail="Actions logged into Aeonvera memory."
          />
        </View>
        <Text style={styles.mobileCommandCopy}>
          The full website remains the deep cockpit. The mobile app is becoming the execution layer:
          fast actions, phone notifications, calendar blocks, and coach signals.
        </Text>
      </View>
    </>
  );
}

function ExecutionFeedbackCard({
  feedback,
  onRecord,
}: {
  feedback: PendingFeedback;
  onRecord: (
    feedback: PendingFeedback,
    outcome: "done" | "partly" | "missed" | "reschedule"
  ) => Promise<void>;
}) {
  const scheduledFor = feedback.scheduledFor
    ? formatReminderDate(new Date(feedback.scheduledFor))
    : null;

  return (
    <View style={styles.feedbackPanel}>
      <Text style={styles.cardLabel}>Execution Feedback</Text>
      <Text style={styles.cardTitle}>How did this block land?</Text>
      <Text style={styles.cardCopy}>
        {feedback.action}
        {scheduledFor ? ` / ${scheduledFor}` : ""}
      </Text>
      <Text style={styles.feedbackCopy}>
        Aeonvera will use this signal to refine timing, intensity, and the way your next day is
        prepared.
      </Text>
      <View style={styles.feedbackGrid}>
        <Pressable
          style={[styles.feedbackButton, styles.feedbackButtonPrimary]}
          onPress={() => void onRecord(feedback, "done")}
        >
          <Text style={[styles.feedbackButtonText, styles.feedbackButtonPrimaryText]}>Done</Text>
        </Pressable>
        <Pressable
          style={styles.feedbackButton}
          onPress={() => void onRecord(feedback, "partly")}
        >
          <Text style={styles.feedbackButtonText}>Partly</Text>
        </Pressable>
        <Pressable
          style={styles.feedbackButton}
          onPress={() => void onRecord(feedback, "missed")}
        >
          <Text style={styles.feedbackButtonText}>Missed</Text>
        </Pressable>
        <Pressable
          style={styles.feedbackButton}
          onPress={() => void onRecord(feedback, "reschedule")}
        >
          <Text style={styles.feedbackButtonText}>Reschedule</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AgentView({
  appliedActions,
  clinicalAnswerDraft,
  clinicalInsights,
  lastVoiceAnswer,
  lastVoiceTranscript,
  messages,
  modalities,
  onCancelVoice,
  onClinicalAnswerChange,
  onPromptChange,
  onSend,
  onSendClinicalAnswer,
  onStartVoice,
  onStopSpeech,
  onStopVoice,
  prompt,
  suggestions,
  thinking,
  usageLimits,
  voicePhase,
  voiceRecording,
  voiceSpeaking,
  voiceStatus,
}: {
  appliedActions: AgentAppliedAction[];
  clinicalAnswerDraft: string;
  clinicalInsights: ClinicalInsight[];
  lastVoiceAnswer: string | null;
  lastVoiceTranscript: string | null;
  messages: AgentChatMessage[];
  modalities: ModalitiesPayload | null;
  onCancelVoice: () => void;
  onClinicalAnswerChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onSend: (value?: string) => void;
  onSendClinicalAnswer: (insightId: string, answer: string) => void;
  onStartVoice: (clinicalInsightId?: string) => void;
  onStopSpeech: () => void;
  onStopVoice: () => void;
  prompt: string;
  suggestions: string[];
  thinking: boolean;
  usageLimits: UsageLimitsPayload | null;
  voicePhase: VoicePhase;
  voiceRecording: boolean;
  voiceSpeaking: boolean;
  voiceStatus: string | null;
}) {
  const visibleMessages = messages.slice(-6);
  const latestInsight = clinicalInsights[0] || null;
  const progression = latestInsight?.metadata?.progression;
  const lastClinicalResponse = latestInsight?.metadata?.follow_up_responses?.slice(-1)[0];
  const missingInput = latestInsight?.metadata?.missing_inputs?.[0];
  const riskTier = latestInsight?.metadata?.risk_tier;
  const safetyLevel = latestInsight?.metadata?.safety_level || lastClinicalResponse?.safety_level;
  const statusReason = latestInsight?.metadata?.status_reason || lastClinicalResponse?.status_reason;
  const voiceTitle = voicePhaseLabel(voicePhase, voiceSpeaking, voiceRecording);
  const primaryVoiceLabel =
    voicePhase === "ready_follow_up" ? "Follow Up" : voiceRecording ? "Finish" : "Speak";

  return (
    <View style={styles.agentPanel}>
      <Text style={styles.cardLabel}>Personal Health Agent</Text>
      <Text style={styles.cardTitle}>Ask Aeonvera why</Text>
      <Text style={styles.cardCopy}>
        Your agent reads today&apos;s plan, coach memory, recent execution, and calendar signals
        before answering.
      </Text>

      <View style={styles.voicePanel}>
        <View style={styles.voiceSignal}>
          <View
            style={[
              styles.voiceOrb,
              (voiceRecording || voiceSpeaking || voicePhase === "processing") &&
                styles.voiceOrbActive,
              voicePhase === "processing" && styles.voiceOrbProcessing,
            ]}
          />
          <View style={styles.voiceCopyGroup}>
            <Text style={styles.voiceTitle}>{voiceTitle}</Text>
            <Text style={styles.voiceHint}>
              {voiceStatus ||
                "Speak naturally. Aeonvera will answer out loud and remember the clinical context."}
            </Text>
          </View>
        </View>
        {lastVoiceTranscript || lastVoiceAnswer ? (
          <View style={styles.voiceTranscriptPanel}>
            {lastVoiceTranscript ? (
              <>
                <Text style={styles.voiceTranscriptLabel}>You said</Text>
                <Text style={styles.voiceTranscriptText}>{lastVoiceTranscript}</Text>
              </>
            ) : null}
            {lastVoiceAnswer ? (
              <>
                <Text style={styles.voiceTranscriptLabel}>Aeonvera answered</Text>
                <Text style={styles.voiceTranscriptText} numberOfLines={4}>
                  {lastVoiceAnswer}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
        <View style={styles.voiceControls}>
          {voiceRecording ? (
            <>
              <Pressable style={styles.voiceButtonSecondary} onPress={onCancelVoice}>
                <Text style={styles.voiceButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.voiceButton} onPress={onStopVoice}>
                <Text style={styles.voiceButtonPrimaryText}>{primaryVoiceLabel}</Text>
              </Pressable>
            </>
          ) : voiceSpeaking ? (
            <Pressable style={styles.voiceButtonSecondary} onPress={onStopSpeech}>
              <Text style={styles.voiceButtonText}>Stop Voice</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.voiceButton,
                (thinking && voicePhase !== "ready_follow_up") && styles.buttonDisabled,
              ]}
              disabled={thinking && voicePhase !== "ready_follow_up"}
              onPress={() => onStartVoice()}
            >
              <Text style={styles.voiceButtonPrimaryText}>{primaryVoiceLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <MobileUsagePanel usageLimits={usageLimits} />

      <MobileModalitiesPanel modalities={modalities} onAsk={onSend} />

      <View style={styles.clinicalMemoryPanel}>
        <View style={styles.clinicalMemoryHeader}>
          <Text style={styles.cardLabel}>Clinical Memory</Text>
          <Text style={styles.clinicalMemoryStatus}>
            {latestInsight ? clinicalStatusLabel(latestInsight.concern_status) : "Building"}
          </Text>
        </View>
        {safetyLevel ? (
          <Text style={styles.clinicalSafetyPill}>{clinicalSafetyLabel(safetyLevel)}</Text>
        ) : null}
        <Text style={styles.clinicalMemoryTitle}>
          {latestInsight?.answer_summary ||
            "Ask a deep health question and Aeonvera will remember the conclusion."}
        </Text>
        {latestInsight?.follow_up_questions?.[0] ? (
          <Text style={styles.clinicalMemoryCopy}>
            {latestInsight.follow_up_questions[0]}
          </Text>
        ) : null}
        {progression?.summary ? (
          <Text style={styles.clinicalTrajectoryCopy}>
            {clinicalProgressionLabel(progression.status)}: {progression.summary}
          </Text>
        ) : null}
        {riskTier || missingInput ? (
          <Text style={styles.clinicalTrajectoryCopy}>
            {riskTier ? `Risk tier: ${clinicalRiskTierLabel(riskTier)}.` : ""}
            {missingInput
              ? ` Next missing input: ${missingInput.label || "clinical marker"}.`
              : ""}
          </Text>
        ) : null}
        {latestInsight?.follow_up_questions?.[0] ? (
          <View style={styles.clinicalAnswerPanel}>
            <Text style={styles.clinicalAnswerLabel}>Answer follow-up</Text>
            <TextInput
              multiline
              value={clinicalAnswerDraft}
              onChangeText={onClinicalAnswerChange}
              placeholder="What changed, what stayed the same, or what should Aeonvera adjust?"
              placeholderTextColor="rgba(255,255,255,0.28)"
              style={styles.clinicalAnswerInput}
            />
            {lastClinicalResponse?.answer ? (
              <Text style={styles.clinicalAnswerHint}>
                Last answer saved as{" "}
                {clinicalStatusLabel(lastClinicalResponse.interpreted_status || latestInsight.concern_status)}
                : {lastClinicalResponse.answer.slice(0, 90)}
              </Text>
            ) : (
              <Text style={styles.clinicalAnswerHint}>
                This updates the same clinical thread.
              </Text>
            )}
            <View style={styles.clinicalAnswerActions}>
              <Pressable
                style={[styles.voiceButtonSecondary, thinking && styles.buttonDisabled]}
                disabled={thinking}
                onPress={() => onStartVoice(latestInsight.id)}
              >
                <Text style={styles.voiceButtonText}>Speak Answer</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.voiceButton,
                  (!clinicalAnswerDraft.trim() || thinking) && styles.buttonDisabled,
                ]}
                disabled={!clinicalAnswerDraft.trim() || thinking}
                onPress={() => onSendClinicalAnswer(latestInsight.id, clinicalAnswerDraft)}
              >
                <Text style={styles.voiceButtonPrimaryText}>Send Answer</Text>
              </Pressable>
            </View>
            {statusReason ? (
              <Text style={styles.clinicalAnswerHint}>{statusReason}</Text>
            ) : null}
          </View>
        ) : null}
        {latestInsight?.domains?.length ? (
          <View style={styles.clinicalDomainRow}>
            {latestInsight.domains.slice(0, 3).map((domain) => (
              <Text key={domain} style={styles.clinicalDomainPill}>
                {domain}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.agentSuggestions}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            style={styles.agentSuggestion}
            disabled={thinking}
            onPress={() => onSend(suggestion)}
          >
            <Text style={styles.agentSuggestionText}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>

      {appliedActions.length ? (
        <View style={styles.agentActionList}>
          {appliedActions.map((action) => (
            <View key={`${action.type}-${action.label}`} style={styles.agentActionItem}>
              <Text style={styles.actionNoticeLabel}>{action.label}</Text>
              <Text style={styles.actionNoticeText}>{action.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.agentMessageList}>
        {visibleMessages.map((message, index) => (
          <View
            key={`${message.role}-${index}-${message.content.slice(0, 14)}`}
            style={[
              styles.agentMessage,
              message.role === "user" && styles.agentUserMessage,
            ]}
          >
            <Text style={styles.selectedMessageLabel}>
              {message.role === "assistant" ? "Aeonvera" : "You"}
            </Text>
            <Text style={styles.agentMessageText}>{message.content}</Text>
          </View>
        ))}
        {thinking ? (
          <View style={styles.agentMessage}>
            <Text style={styles.agentMessageText}>Aeonvera is reading today&apos;s signal.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.agentInputRow}>
        <TextInput
          multiline
          placeholder="Ask what to do, why it matters, or what should change..."
          placeholderTextColor="rgba(255,255,255,0.28)"
          style={styles.agentInput}
          value={prompt}
          onChangeText={onPromptChange}
        />
        <Pressable
          style={[
            styles.agentSendButton,
            (thinking || voiceRecording || !prompt.trim()) && styles.buttonDisabled,
          ]}
          disabled={thinking || voiceRecording || !prompt.trim()}
          onPress={() => onSend()}
        >
          <Text style={styles.agentSendText}>Ask</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MobileUsagePanel({ usageLimits }: { usageLimits: UsageLimitsPayload | null }) {
  if (!usageLimits) return null;

  const highlighted = [
    usageLimits.usage.find((item) => item.meter === "agent_question"),
    usageLimits.usage.find((item) => item.meter === "voice_question"),
    usageLimits.usage.find((item) => item.meter === "report_generation"),
  ].filter(Boolean) as UsageMeterSnapshot[];

  if (!highlighted.length) return null;

  return (
    <View style={styles.mobileUsagePanel}>
      <View style={styles.mobileUsageHeader}>
        <Text style={styles.cardLabel}>Tier Intelligence</Text>
        <Text style={styles.mobileUsagePlan}>
          {usageLimits.plan ? titleCase(usageLimits.plan) : "Plan"}
        </Text>
      </View>
      <View style={styles.mobileUsageGrid}>
        {highlighted.map((item) => (
          <View key={item.meter} style={styles.mobileUsageItem}>
            <Text style={styles.mobileUsageLabel}>{usageMeterLabel(item.meter)}</Text>
            <Text style={styles.mobileUsageValue}>
              {item.limit <= 0 ? "Locked" : item.remaining.toLocaleString()}
            </Text>
            <Text style={styles.mobileUsageDetail}>
              {item.limit <= 0
                ? "Upgrade"
                : `${item.used.toLocaleString()} / ${item.limit.toLocaleString()}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MobileModalitiesPanel({
  modalities,
  onAsk,
}: {
  modalities: ModalitiesPayload | null;
  onAsk: (value?: string) => void;
}) {
  const recommendations = modalities?.recommendations || [];
  const visible = [
    ...recommendations.filter((item) => item.access === "included").slice(0, 2),
    ...recommendations.filter((item) => item.access === "locked").slice(0, 2),
  ].slice(0, 4);

  if (!visible.length) return null;

  return (
    <View style={styles.mobileModalitiesPanel}>
      <View style={styles.mobileUsageHeader}>
        <Text style={styles.cardLabel}>Advanced Modalities</Text>
        <Text style={styles.mobileUsagePlan}>
          {modalities?.currentPlan ? titleCase(modalities.currentPlan) : "Tiered"}
        </Text>
      </View>
      <Text style={styles.mobileModalitiesCopy}>
        Aeonvera ranks optional protocols by fit, evidence, risk, and access.
      </Text>
      <View style={styles.mobileModalityList}>
        {visible.map((modality) => (
          <Pressable
            key={modality.id}
            style={[
              styles.mobileModalityCard,
              modality.access === "included" && styles.mobileModalityIncluded,
            ]}
            onPress={() =>
              onAsk(
                `Explain whether ${modality.name} makes sense for me, including risks, contraindications, tracking markers, and the safest protocol range.`
              )
            }
          >
            <View style={styles.mobileModalityTopRow}>
              <Text style={styles.mobileModalityName}>{modality.name}</Text>
              <Text
                style={[
                  styles.mobileModalityAccess,
                  modality.access === "included" && styles.mobileModalityAccessIncluded,
                ]}
              >
                {modality.access === "included" ? "Included" : titleCase(modality.minimumTier)}
              </Text>
            </View>
            <Text style={styles.mobileModalityMeta}>
              {modality.fitScore} fit / {titleCase(modality.evidenceGrade)} /{" "}
              {titleCase(modality.risk)} risk
            </Text>
            <Text style={styles.mobileModalitiesCopy}>
              {modality.access === "included"
                ? modality.rationale
                : modality.upgradeMessage || modality.rationale}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MobileCommandStat({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.mobileCommandStat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.mobileCommandValue}>{value}</Text>
      <Text style={styles.mobileCommandDetail}>{detail}</Text>
    </View>
  );
}

function clinicalStatusLabel(status?: string | null) {
  if (status === "improving") return "Improving";
  if (status === "unresolved") return "Unresolved";
  if (status === "dismissed") return "Dismissed";
  if (status === "monitoring") return "Monitoring";
  if (status === "active") return "Active";
  return "Building";
}

function clinicalProgressionLabel(status?: string | null) {
  if (status === "improving_signal") return "Improving";
  if (status === "recurrent_signal") return "Recurring";
  if (status === "new_signal") return "New";
  return "Monitoring";
}

function clinicalSafetyLabel(status?: string | null) {
  if (status === "urgent") return "Urgent review";
  if (status === "medical_review") return "Medical review";
  if (status === "monitor") return "Monitor";
  return "Routine";
}

function clinicalRiskTierLabel(status?: string | null) {
  if (status === "urgent") return "Urgent";
  if (status === "clinician_review") return "Clinician Review";
  if (status === "monitor") return "Monitor";
  return "Optimize";
}

function WeeklyExecutionReviewCard({
  executionSummary,
}: {
  executionSummary: ExecutionSummary | null;
}) {
  const status = executionSummary?.status || "building";
  const score = executionSummary?.score ?? 0;

  return (
    <View style={styles.weeklyReviewPanel}>
      <View style={styles.detailHeader}>
        <View>
          <Text style={styles.cardLabel}>Weekly Review</Text>
          <Text style={styles.cardTitle}>
            {status === "strong"
              ? "Execution is compounding"
              : status === "steady"
                ? "Execution is stabilizing"
                : status === "needs_attention"
                  ? "Execution needs simplification"
                  : "Execution baseline building"}
          </Text>
        </View>
        <View style={styles.reviewScorePill}>
          <Text style={styles.reviewScore}>{score}</Text>
          <Text style={styles.reviewScoreLabel}>score</Text>
        </View>
      </View>
      <Text style={styles.cardCopy}>
        {executionSummary?.headline ||
          "Complete or miss a few actions and Aeonvera will start extracting patterns."}
      </Text>
      <View style={styles.reviewStatsRow}>
        <ReviewStat label="Done" value={String(executionSummary?.completed || 0)} />
        <ReviewStat label="Missed" value={String(executionSummary?.skipped || 0)} />
        <ReviewStat label="Deferred" value={String(executionSummary?.deferred || 0)} />
        <ReviewStat label="Scheduled" value={String(executionSummary?.scheduled || 0)} />
      </View>
      {executionSummary?.topSkippedPattern ? (
        <View style={styles.learningNote}>
          <Text style={styles.actionNoticeLabel}>Pattern</Text>
          <Text style={styles.actionNoticeText}>
            {executionSummary.topSkippedPattern.label} created the most friction this week.
            Aeonvera will reduce load or move timing before adding intensity.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewStat}>
      <Text style={styles.scheduleMetricValue}>{value}</Text>
      <Text style={styles.scheduleMetricLabel}>{label}</Text>
    </View>
  );
}

function AutopilotPlanCard({
  acceptDailyPlan,
  acceptingDailyPlan,
  adjustAutopilot,
  autopilotMessage,
  dailyPlan,
  localReminders,
  nativeCalendarEvents,
  onAskWhy,
  preferences,
  protocol,
  skipDailyPlan,
}: {
  acceptDailyPlan: () => Promise<void>;
  acceptingDailyPlan: boolean;
  adjustAutopilot: () => void;
  autopilotMessage: string | null;
  dailyPlan: DailyExecutionPlan | null;
  localReminders: Record<string, LocalReminder>;
  nativeCalendarEvents: Record<string, NativeCalendarEvent>;
  onAskWhy: (question?: string) => void;
  preferences: AutopilotPreferences | null;
  protocol: Protocol | null;
  skipDailyPlan: () => Promise<void>;
}) {
  const items = dailyPlan?.plan?.items || [];
  const mode = preferences?.mode || dailyPlan?.autopilot_mode || "approve";
  const status = dailyPlan?.status || "prepared";
  const previewItems = items.slice(0, 5);
  const scheduledCount = protocol?.id
    ? previewItems.filter((item) => nativeCalendarEvents[getReminderKey(protocol.id, item)]).length
    : 0;
  const notificationCount = protocol?.id
    ? previewItems.filter((item) => localReminders[getReminderKey(protocol.id, item)]).length
    : 0;
  const pendingCount = Math.max(previewItems.length - scheduledCount - notificationCount, 0);
  const isActive = status === "accepted" || status === "auto_scheduled";
  const primaryLabel = acceptingDailyPlan
    ? "Preparing"
    : isActive
      ? pendingCount
        ? "Recreate Missing"
        : "Already Scheduled"
      : "Approve Today";
  const confidence = getAutopilotConfidence(dailyPlan, scheduledCount + notificationCount);

  return (
    <View style={styles.autopilotPanel}>
      <View style={styles.detailHeader}>
        <View>
          <Text style={styles.cardLabel}>Autopilot</Text>
          <Text style={styles.cardTitle}>
            {status === "accepted" || status === "auto_scheduled"
              ? "Today is active"
              : "Today is prepared"}
          </Text>
        </View>
        <Text style={styles.modePill}>{formatAutopilotMode(mode)}</Text>
      </View>
      <View style={styles.schedulePreviewHeader}>
        <View style={styles.scheduleMetric}>
          <Text style={styles.scheduleMetricValue}>{previewItems.length}</Text>
          <Text style={styles.scheduleMetricLabel}>blocks</Text>
        </View>
        <View style={styles.scheduleMetric}>
          <Text style={styles.scheduleMetricValue}>{scheduledCount + notificationCount}</Text>
          <Text style={styles.scheduleMetricLabel}>placed</Text>
        </View>
        <View style={styles.scheduleMetric}>
          <Text style={styles.scheduleMetricValue}>{pendingCount}</Text>
          <Text style={styles.scheduleMetricLabel}>open</Text>
        </View>
      </View>
      <Text style={styles.cardCopy}>
        {dailyPlan?.summary ||
          dailyPlan?.plan?.summary ||
          autopilotMessage ||
          "Aeonvera will prepare your day after your first active protocol."}
      </Text>
      <View style={styles.confidenceStrip}>
        <View>
          <Text style={styles.actionNoticeLabel}>Autopilot confidence</Text>
          <Text style={styles.confidenceText}>{confidence.label}</Text>
        </View>
        <Text style={styles.confidenceValue}>{confidence.score}%</Text>
      </View>
      {autopilotMessage ? <Text style={styles.warning}>{autopilotMessage}</Text> : null}
      {previewItems.length ? (
        <View style={styles.schedulePreviewList}>
          {previewItems.map((item) => {
            const actionKey = protocol?.id ? getReminderKey(protocol.id, item) : "";
            const calendarEvent = actionKey ? nativeCalendarEvents[actionKey] : undefined;
            const reminder = actionKey ? localReminders[actionKey] : undefined;
            const state = calendarEvent ? "calendar" : reminder ? "notification" : "pending";

            return (
              <View key={getActionKey(item)} style={styles.schedulePreviewItem}>
                <View style={styles.scheduleTimeColumn}>
                  <Text style={styles.autopilotTime}>{item.recommended_time || "Smart"}</Text>
                  <Text style={styles.scheduleStatusText}>
                    {state === "calendar"
                      ? "Calendar"
                      : state === "notification"
                        ? "Notify"
                        : formatExecutionMode(item.execution_mode)}
                  </Text>
                </View>
                <View style={styles.schedulePreviewCopy}>
                  <Text style={styles.autopilotAction}>{item.action}</Text>
                  <Text style={styles.scheduleReason}>
                    {calendarEvent
                      ? `Already on ${calendarEvent.calendarTitle} ${formatReminderDate(new Date(calendarEvent.scheduledFor))}.`
                      : reminder
                        ? `Phone nudge set ${formatReminderDate(new Date(reminder.scheduledFor))}.`
                        : getSchedulePreviewReason(item)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.scheduleStatusDot,
                    state === "calendar" || state === "notification"
                      ? styles.scheduleStatusDotActive
                      : styles.scheduleStatusDotPending,
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.autopilotActions}>
        <Pressable
          style={[
            styles.button,
            styles.autopilotPrimaryButton,
            (acceptingDailyPlan || (isActive && pendingCount === 0)) && styles.buttonDisabled,
          ]}
          disabled={acceptingDailyPlan || (isActive && pendingCount === 0)}
          onPress={() => void acceptDailyPlan()}
        >
          <Text style={styles.buttonText}>{primaryLabel}</Text>
        </Pressable>
        <View style={styles.secondaryActionRow}>
          <Pressable
            style={styles.secondaryAction}
            onPress={adjustAutopilot}
          >
            <Text style={styles.secondaryActionText}>Adjust</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryAction}
            onPress={() => onAskWhy("Why did Aeonvera choose this plan today?")}
          >
            <Text style={styles.secondaryActionText}>Ask Why</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryAction}
            onPress={() => {
              void skipDailyPlan();
            }}
          >
            <Text style={styles.secondaryActionText}>Pause Today</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MessageDetailView({
  message,
  onBack,
  onDone,
  onOpen,
  onRemindLater,
}: {
  message: CoachMessage | null;
  onBack: () => void;
  onDone: () => void;
  onOpen: () => void;
  onRemindLater: () => void;
}) {
  if (!message) {
    return (
      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Coach Signal</Text>
        <Text style={styles.cardTitle}>Nothing new right now</Text>
        <Text style={styles.cardCopy}>
          Aeonvera will bring the next important signal here when it arrives.
        </Text>
        <Pressable style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>Open inbox</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailHeader}>
        <Text style={styles.cardLabel}>Coach Signal</Text>
        <Pressable style={styles.textButton} onPress={onBack}>
          <Text style={styles.textButtonText}>Inbox</Text>
        </Pressable>
      </View>
      <Text style={styles.detailTitle}>{message.title}</Text>
      <Text style={styles.messageDate}>{formatDate(message.created_at)}</Text>
      <Text style={styles.detailCopy}>{message.message}</Text>
      <View style={styles.detailActions}>
        <Pressable style={styles.button} onPress={onOpen}>
          <Text style={styles.buttonText}>Open protocol</Text>
        </Pressable>
        <View style={styles.secondaryActionRow}>
          <Pressable style={styles.secondaryAction} onPress={onDone}>
            <Text style={styles.secondaryActionText}>Done</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={onRemindLater}>
            <Text style={styles.secondaryActionText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function InboxView({
  messages,
  notice,
  onInboxLayout,
  onMessageListLayout,
  onSelectedMessageLayout,
  openPath,
  selectedMessageId,
}: {
  messages: CoachMessage[];
  notice: string | null;
  onInboxLayout: (event: LayoutChangeEvent) => void;
  onMessageListLayout: (event: LayoutChangeEvent) => void;
  onSelectedMessageLayout: (event: LayoutChangeEvent) => void;
  openPath: (path: string) => Promise<void>;
  selectedMessageId: string | null;
}) {
  const selectedMessage =
    messages.find((message) => message.id === selectedMessageId) || messages[0] || null;
  const recentMessages = selectedMessage
    ? messages.filter((message) => message.id !== selectedMessage.id).slice(0, 4)
    : messages.slice(0, 4);

  return (
    <View style={styles.panel} onLayout={onInboxLayout}>
      <Text style={styles.cardLabel}>Coach Inbox</Text>
      <Text style={styles.cardTitle}>{messages.length ? "Latest coach signal" : "No messages yet"}</Text>
      {notice ? <Text style={styles.inboxNotice}>{notice}</Text> : null}
      <View style={styles.messageList} onLayout={onMessageListLayout}>
        {selectedMessage ? (
          <>
            <Pressable
              key={selectedMessage.id}
              style={[
                styles.messageItem,
                styles.featuredMessageItem,
                selectedMessageId === selectedMessage.id && styles.selectedMessageItem,
              ]}
              onLayout={
                selectedMessageId === selectedMessage.id ? onSelectedMessageLayout : undefined
              }
              onPress={() => void openMessage(selectedMessage, openPath)}
            >
              <Text style={styles.selectedMessageLabel}>
                {selectedMessageId === selectedMessage.id ? "Selected notification" : "Latest"}
              </Text>
              <View style={styles.messageHeader}>
                <Text style={styles.messageTitle}>{selectedMessage.title}</Text>
                <Text style={styles.messageDate}>{formatDate(selectedMessage.created_at)}</Text>
              </View>
              <Text style={styles.messageCopy}>{selectedMessage.message}</Text>
            </Pressable>

            {recentMessages.length ? (
              <View style={styles.recentMessages}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.compactSectionTitle}>Recent history</Text>
                  <Text style={styles.sectionCount}>{messages.length}</Text>
                </View>
                {recentMessages.map((message) => (
                  <Pressable
                    key={message.id}
                    style={styles.compactMessageItem}
                    onPress={() => void openMessage(message, openPath)}
                  >
                    <Text style={styles.compactMessageTitle}>{message.title}</Text>
                    <Text style={styles.messageDate}>{formatDate(message.created_at)}</Text>
                  </Pressable>
                ))}
                {messages.length > recentMessages.length + 1 ? (
                  <Text style={styles.moreText}>
                    {messages.length - recentMessages.length - 1} older message
                    {messages.length - recentMessages.length - 1 === 1 ? "" : "s"} archived.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyText}>
            Coach messages will appear here after reports, protocols, and daily
            coach runs.
          </Text>
        )}
      </View>
    </View>
  );
}

function ProtocolActionRow({
  action,
  compact = false,
  expanded = false,
  adherenceEvent,
  localReminder,
  nativeCalendarEvent,
  onToggle,
}: {
  action: ScheduledProtocolAction;
  compact?: boolean;
  expanded?: boolean;
  adherenceEvent?: AdherenceEvent;
  localReminder?: LocalReminder;
  nativeCalendarEvent?: NativeCalendarEvent;
  onToggle?: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.actionItem,
        compact && styles.compactActionItem,
        expanded && styles.expandedActionItem,
      ]}
      onPress={onToggle}
    >
      <Text style={styles.actionIndex}>{action.actionIndex + 1}</Text>
      <View style={styles.actionBody}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionTitle}>{action.action}</Text>
          <AdherencePill event={adherenceEvent} />
        </View>
        <Text style={styles.actionMeta}>
          {[action.domain, action.cadence, action.impact].filter(Boolean).join(" / ")}
        </Text>
        {expanded && action.why ? <Text style={styles.actionWhy}>{action.why}</Text> : null}
        {expanded ? (
          <Text style={styles.actionWhy}>
            Aeonvera will handle this through Autopilot when you accept today&apos;s plan.
          </Text>
        ) : null}
        {localReminder ? (
          <Text style={styles.reminderText}>
            Phone notification {formatReminderDate(new Date(localReminder.scheduledFor))}
            {localReminder.repeat === "once" ? "" : ` / ${localReminder.repeat}`}
          </Text>
        ) : null}
        {nativeCalendarEvent ? (
          <Text style={styles.reminderText}>
            Calendar event {formatReminderDate(new Date(nativeCalendarEvent.scheduledFor))} /{" "}
            {nativeCalendarEvent.calendarTitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SettingsView({
  autopilotPreferences,
  diagnosticChecks,
  diagnosticsRunning,
  preferences,
  prepareNotifications,
  pushStatus,
  runLaunchDiagnostics,
  saveAutopilotPreferences,
  savePreferences,
  sendMorningAutopilotBrief,
}: {
  autopilotPreferences: AutopilotPreferences | null;
  diagnosticChecks: DiagnosticCheck[];
  diagnosticsRunning: boolean;
  preferences: Preferences | null;
  prepareNotifications: () => Promise<void>;
  pushStatus: string;
  runLaunchDiagnostics: () => Promise<void>;
  saveAutopilotPreferences: (next: Partial<AutopilotPreferences>) => Promise<void>;
  savePreferences: (next: Partial<Preferences>) => Promise<void>;
  sendMorningAutopilotBrief: () => Promise<void>;
}) {
  const autopilot = autopilotPreferences || defaultAutopilotPreferences("");

  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Autopilot</Text>
        <Text style={styles.cardTitle}>Daily execution intelligence</Text>
        <Text style={styles.cardCopy}>
          Aeonvera can prepare your day automatically, then schedule only what you allow.
        </Text>
        <View style={styles.modeGrid}>
          {(["suggest", "approve", "autopilot", "manual"] as AutopilotMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.modeButton,
                autopilot.mode === mode && styles.activeModeButton,
              ]}
              onPress={() => void saveAutopilotPreferences({ mode })}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  autopilot.mode === mode && styles.activeModeButtonText,
                ]}
              >
                {formatAutopilotMode(mode)}
              </Text>
            </Pressable>
          ))}
        </View>
        <PreferenceRow
          label="Calendar blocks"
          value={autopilot.calendar_enabled}
          onValueChange={(value) => void saveAutopilotPreferences({ calendar_enabled: value })}
        />
        <PreferenceRow
          label="Phone nudges"
          value={autopilot.notifications_enabled}
          onValueChange={(value) =>
            void saveAutopilotPreferences({ notifications_enabled: value })
          }
        />
        <PreferenceRow
          label="Auto schedule"
          value={autopilot.auto_schedule_enabled}
          onValueChange={(value) =>
            void saveAutopilotPreferences({ auto_schedule_enabled: value })
          }
        />
        <Text style={styles.quietHours}>
          Quiet hours {autopilot.quiet_hours_start}-{autopilot.quiet_hours_end}
        </Text>
        <Pressable style={styles.button} onPress={() => void sendMorningAutopilotBrief()}>
          <Text style={styles.buttonText}>Send morning brief</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Autonomy Boundaries</Text>
        <Text style={styles.cardTitle}>What Aeonvera may organize</Text>
        <PreferenceRow
          label="Training"
          value={autopilot.allow_training_blocks}
          onValueChange={(value) =>
            void saveAutopilotPreferences({ allow_training_blocks: value })
          }
        />
        <PreferenceRow
          label="Nutrition"
          value={autopilot.allow_nutrition_blocks}
          onValueChange={(value) =>
            void saveAutopilotPreferences({ allow_nutrition_blocks: value })
          }
        />
        <PreferenceRow
          label="Recovery"
          value={autopilot.allow_recovery_blocks}
          onValueChange={(value) =>
            void saveAutopilotPreferences({ allow_recovery_blocks: value })
          }
        />
        <PreferenceRow
          label="Check-ins"
          value={autopilot.allow_check_ins}
          onValueChange={(value) => void saveAutopilotPreferences({ allow_check_ins: value })}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Native Push</Text>
        <Text style={styles.cardTitle}>{pushStatus}</Text>
        <Text style={styles.cardCopy}>
          Register this phone so coach messages can reach you through iOS or
          Android notifications.
        </Text>
        <Pressable style={styles.button} onPress={() => void prepareNotifications()}>
          <Text style={styles.buttonText}>Connect notifications</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Launch Diagnostics</Text>
        <Text style={styles.cardTitle}>Production readiness</Text>
        <Text style={styles.cardCopy}>
          Run this on each release build before submitting to TestFlight or Play Store testing.
        </Text>
        <Pressable
          style={[styles.button, diagnosticsRunning && styles.buttonDisabled]}
          disabled={diagnosticsRunning}
          onPress={() => void runLaunchDiagnostics()}
        >
          <Text style={styles.buttonText}>
            {diagnosticsRunning ? "Checking" : "Run diagnostics"}
          </Text>
        </Pressable>
        {diagnosticChecks.length ? (
          <View style={styles.diagnosticList}>
            {diagnosticChecks.map((check) => (
              <View key={check.label} style={styles.diagnosticItem}>
                <View
                  style={[
                    styles.diagnosticDot,
                    check.status === "pass"
                      ? styles.diagnosticPass
                      : check.status === "warn"
                        ? styles.diagnosticWarn
                        : styles.diagnosticFail,
                  ]}
                />
                <View style={styles.diagnosticCopy}>
                  <Text style={styles.preferenceLabel}>{check.label}</Text>
                  <Text style={styles.quietHours}>{check.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Delivery Preferences</Text>
        <Text style={styles.cardTitle}>Coach contact</Text>
        <PreferenceRow
          label="Email"
          value={preferences?.email_enabled !== false}
          onValueChange={(value) => void savePreferences({ email_enabled: value })}
        />
        <PreferenceRow
          label="Push"
          value={preferences?.push_enabled === true}
          onValueChange={(value) => void savePreferences({ push_enabled: value })}
        />
        <Text style={styles.quietHours}>
          Quiet hours {preferences?.quiet_hours_start || "22:00"}-
          {preferences?.quiet_hours_end || "07:00"}
        </Text>
      </View>
    </>
  );
}

function PreferenceRow({
  label,
  onValueChange,
  value,
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <Switch
        ios_backgroundColor="rgba(255,255,255,0.12)"
        thumbColor={value ? "#f2dc9c" : "rgba(255,255,255,0.68)"}
        trackColor={{
          false: "rgba(255,255,255,0.12)",
          true: "rgba(218,188,115,0.42)",
        }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function AdherencePill({ event }: { event?: AdherenceEvent }) {
  if (!event) return null;

  const label =
    event.outcome === "success"
      ? "Done"
      : event.outcome === "failure"
        ? "Skipped"
        : "Later";

  return (
    <View
      style={[
        styles.adherencePill,
        event.outcome === "success" && styles.adherencePillDone,
      ]}
    >
      <Text style={styles.adherencePillText}>{label}</Text>
    </View>
  );
}

async function openMessage(
  message: CoachMessage,
  openPath: (path: string) => Promise<void>
) {
  const path = readPayloadPath(message.payload);
  await openPath(path || "/companion");
}

function readPayloadPath(payload?: Record<string, unknown> | null) {
  const path = payload?.path || payload?.href || payload?.url;
  return typeof path === "string" && path.startsWith("/") ? path : null;
}

function buildLatestAdherenceByAction(events: AdherenceEvent[]) {
  return events.reduce<Record<string, AdherenceEvent>>((current, event) => {
    if (event.action && !current[event.action]) {
      current[event.action] = event;
    }

    return current;
  }, {});
}

function defaultAutopilotPreferences(userId: string): AutopilotPreferences {
  return {
    user_id: userId,
    mode: "approve",
    calendar_enabled: true,
    notifications_enabled: true,
    auto_schedule_enabled: false,
    allow_training_blocks: true,
    allow_nutrition_blocks: true,
    allow_recovery_blocks: true,
    allow_check_ins: true,
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
    timezone: "UTC",
  };
}

function formatAutopilotMode(mode: AutopilotMode) {
  if (mode === "manual") return "Manual";
  if (mode === "suggest") return "Suggest";
  if (mode === "autopilot") return "Autopilot";
  if (mode === "sovereign") return "Sovereign";
  return "Approve";
}

function formatExecutionMode(mode?: DailyPlanItem["execution_mode"]) {
  if (mode === "notify") return "Notify";
  if (mode === "schedule") return "Calendar";
  if (mode === "manual") return "Manual";
  if (mode === "suggest") return "Suggested";
  return "Ready";
}

function getSchedulePreviewReason(item: DailyPlanItem) {
  if (item.adaptation_reason === "resurfaced_after_missed_execution") {
    return "Resurfaced because recent feedback showed this needs a cleaner attempt.";
  }

  if (item.adaptation_reason === "simplified_after_domain_friction") {
    return "Simplified because this domain has shown recent friction.";
  }

  if (item.adaptation_reason === "expanded_from_recent_strength") {
    return "Included because this domain is responding well.";
  }

  if (item.execution_mode === "notify") {
    return "A phone nudge is enough for this check-in.";
  }

  if (item.execution_mode === "schedule") {
    return "Ready to place in the best available calendar window.";
  }

  return "Prepared for approval before Aeonvera places it.";
}

function getAutopilotConfidence(dailyPlan: DailyExecutionPlan | null, placedCount: number) {
  const memory = dailyPlan?.plan?.memory;
  const signalCount = memory?.total_signals || 0;
  const completionRate =
    typeof memory?.completion_rate === "number" ? memory.completion_rate : 0.64;
  const planLoad = memory?.plan_load || "steady";
  const placedBonus = placedCount ? 8 : 0;
  const signalBonus = Math.min(signalCount * 3, 18);
  const loadAdjustment = planLoad === "light" ? 6 : planLoad === "ambitious" ? -2 : 3;
  const raw = Math.round(completionRate * 58 + signalBonus + placedBonus + loadAdjustment + 18);
  const score = Math.max(42, Math.min(raw, 96));

  return {
    score,
    label:
      score >= 82
        ? "High confidence. Aeonvera has enough execution memory to act cleanly."
        : score >= 66
          ? "Moderate confidence. Aeonvera is using recent signals but will keep control visible."
          : "Building confidence. Aeonvera will stay conservative until more feedback arrives.",
  };
}

function groupActionsByScope(actions: ProtocolAction[]) {
  return actions.reduce<Record<ActionScope, ScheduledProtocolAction[]>>(
    (groups, action, actionIndex) => {
      const scope = classifyActionScope(action);
      groups[scope].push({ ...action, actionIndex, scope });
      return groups;
    },
    {
      today: [],
      week: [],
      check_in: [],
      later: [],
    }
  );
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

function getReminderDate(
  scope: ActionScope,
  preset: ReminderPreset = "default",
  action?: ProtocolAction
) {
  const date = new Date();

  if (preset === "soon") {
    date.setMinutes(date.getMinutes() + 30);
    return date;
  }

  if (preset === "tomorrow") {
    date.setDate(date.getDate() + 1);
    date.setHours(scope === "check_in" ? 8 : 9, 0, 0, 0);
    return date;
  }

  const text = [action?.domain, action?.action, action?.cadence, action?.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (scope === "today") {
    return getRecommendedSameDaySlot(date, text);
  }

  if (scope === "week" || scope === "check_in") {
    date.setDate(date.getDate() + 1);
    const slot = getRecommendedHour(text, scope);
    date.setHours(slot.hour, slot.minute, 0, 0);
    return date;
  }

  date.setDate(date.getDate() + 2);
  const slot = getRecommendedHour(text, scope);
  date.setHours(slot.hour, slot.minute, 0, 0);
  return date;
}

async function findIntelligentCalendarSlot(
  calendarId: string,
  action: ScheduledProtocolAction,
  preset: ReminderPreset
) {
  const preferredFor = getReminderDate(action.scope, preset, action);
  const durationMinutes = getActionDurationMinutes(action);
  const candidates = buildScheduleCandidates(preferredFor, action);
  const busySlots = await getBusyCalendarSlots(calendarId, candidates);
  const selected =
    candidates.find((candidate) =>
      isSlotAvailable(candidate, durationMinutes, busySlots)
    ) || candidates[candidates.length - 1] || preferredFor;
  const reason = getScheduleReason(preferredFor, selected, action);

  return {
    preferredFor,
    scheduledFor: selected,
    reason,
  };
}

async function getBusyCalendarSlots(calendarId: string, candidates: Date[]) {
  if (!candidates.length) return [];

  const windowStart = new Date(Math.min(...candidates.map((date) => date.getTime())));
  const windowEnd = new Date(Math.max(...candidates.map((date) => date.getTime())));
  windowStart.setHours(0, 0, 0, 0);
  windowEnd.setDate(windowEnd.getDate() + 1);
  windowEnd.setHours(23, 59, 59, 999);

  const calendarIds = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
    .then((calendars) =>
      calendars
        .filter((calendar) => calendar.isVisible !== false)
        .map((calendar) => calendar.id)
    )
    .catch(() => [calendarId]);
  const uniqueCalendarIds = Array.from(new Set([calendarId, ...calendarIds]));
  const events = await Calendar.getEventsAsync(uniqueCalendarIds, windowStart, windowEnd).catch(
    () => []
  );

  return events
    .map((event) => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
        ? { start, end }
        : null;
    })
    .filter((slot): slot is BusySlot => Boolean(slot));
}

function buildScheduleCandidates(preferredFor: Date, action: ProtocolAction) {
  const candidates: Date[] = [];
  addCandidate(candidates, preferredFor);

  const windows = getActionWindows(action);
  for (const offset of [0, 1]) {
    const day = new Date(preferredFor);
    day.setDate(day.getDate() + offset);

    for (const window of windows) {
      for (let minutes = window.start; minutes <= window.end; minutes += 30) {
        const candidate = new Date(day);
        candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

        if (candidate.getTime() > Date.now() + 20 * 60 * 1000) {
          addCandidate(candidates, candidate);
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    const dayDistance = Math.abs(startOfDay(a).getTime() - startOfDay(preferredFor).getTime());
    const otherDayDistance = Math.abs(
      startOfDay(b).getTime() - startOfDay(preferredFor).getTime()
    );
    if (dayDistance !== otherDayDistance) return dayDistance - otherDayDistance;
    return (
      Math.abs(a.getTime() - preferredFor.getTime()) -
      Math.abs(b.getTime() - preferredFor.getTime())
    );
  });
}

function addCandidate(candidates: Date[], candidate: Date) {
  if (
    candidate.getTime() > Date.now() + 20 * 60 * 1000 &&
    !candidates.some((existing) => existing.getTime() === candidate.getTime())
  ) {
    candidates.push(new Date(candidate));
  }
}

function isSlotAvailable(candidate: Date, durationMinutes: number, busySlots: BusySlot[]) {
  const bufferMs = 10 * 60 * 1000;
  const start = candidate.getTime() - bufferMs;
  const end = candidate.getTime() + durationMinutes * 60 * 1000 + bufferMs;

  return !busySlots.some((slot) => start < slot.end.getTime() && end > slot.start.getTime());
}

function getActionWindows(action: ProtocolAction) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(sleep|bedtime|wind down|evening|night|recovery|relax|caffeine)/.test(text)) {
    return [{ start: 19 * 60, end: 21 * 60 + 30 }];
  }

  if (/(wake|morning|sunlight|weigh|weight|hrv|blood pressure|glucose|fasting)/.test(text)) {
    return [{ start: 7 * 60, end: 10 * 60 }];
  }

  if (/(zone 2|cardio|walk|steps|run|training|workout|strength|resistance|mobility)/.test(text)) {
    return [
      { start: 6 * 60 + 30, end: 8 * 60 + 30 },
      { start: 16 * 60 + 30, end: 19 * 60 + 30 },
    ];
  }

  if (/(meal|nutrition|protein|supplement|creatine|hydration|hydrate|food)/.test(text)) {
    return [
      { start: 11 * 60 + 30, end: 14 * 60 },
      { start: 17 * 60 + 30, end: 19 * 60 },
    ];
  }

  if (/(journal|meditation|breath|stress|mindfulness|reflection)/.test(text)) {
    return [{ start: 18 * 60 + 30, end: 21 * 60 }];
  }

  return [{ start: 9 * 60, end: 18 * 60 }];
}

function getActionDurationMinutes(action: ProtocolAction) {
  const text = [action.domain, action.action, action.cadence, action.why]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(zone 2|cardio|run|training|workout|strength|resistance)/.test(text)) return 45;
  if (/(meal|nutrition|protein|supplement|hydration|check|measure|log|record)/.test(text)) {
    return 20;
  }
  if (/(sleep|bedtime|wind down|recovery|breath|meditation|journal)/.test(text)) return 30;
  return 30;
}

function getScheduleReason(preferredFor: Date, selected: Date, action: ProtocolAction) {
  if (selected.getTime() === preferredFor.getTime()) {
    return "Placed in the recommended window for this action.";
  }

  const preferredDay = startOfDay(preferredFor).getTime();
  const selectedDay = startOfDay(selected).getTime();
  const actionType = getActionTypeLabel(action);

  if (selectedDay > preferredDay) {
    return `Today looked full, so Aeonvera moved this ${actionType} block to the next open window.`;
  }

  return `The preferred time was busy, so Aeonvera chose the nearest open ${actionType} window.`;
}

function getActionTypeLabel(action: ProtocolAction) {
  const text = [action.domain, action.action, action.why].filter(Boolean).join(" ").toLowerCase();
  if (/(training|workout|strength|cardio|zone 2|walk|run)/.test(text)) return "training";
  if (/(sleep|recovery|breath|meditation|stress|journal)/.test(text)) return "recovery";
  if (/(meal|nutrition|protein|food|hydration|supplement)/.test(text)) return "nutrition";
  if (/(check|measure|log|record|weight|hrv|blood)/.test(text)) return "check-in";
  return "execution";
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getRecommendedSameDaySlot(date: Date, text: string) {
  const slot = getRecommendedHour(text, "today");
  date.setHours(slot.hour, slot.minute, 0, 0);

  if (date.getTime() <= Date.now() + 30 * 60 * 1000) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
  }

  return date;
}

function getRecommendedHour(text: string, scope: ActionScope) {
  if (/(sleep|bedtime|wind down|evening|night|recovery|relax|caffeine)/.test(text)) {
    return { hour: 20, minute: 30 };
  }

  if (/(wake|morning|sunlight|weigh|weight|hrv|blood pressure|glucose|fasting)/.test(text)) {
    return { hour: 8, minute: 0 };
  }

  if (/(zone 2|cardio|walk|steps|run|training|workout|strength|resistance|mobility)/.test(text)) {
    return { hour: 17, minute: 30 };
  }

  if (/(meal|nutrition|protein|supplement|creatine|hydration|hydrate|food)/.test(text)) {
    return { hour: 12, minute: 30 };
  }

  if (/(journal|meditation|breath|stress|mindfulness|reflection)/.test(text)) {
    return { hour: 19, minute: 30 };
  }

  if (scope === "check_in") {
    return { hour: 8, minute: 30 };
  }

  if (scope === "week") {
    return { hour: 9, minute: 30 };
  }

  return { hour: 10, minute: 0 };
}

function getReminderTrigger(
  scheduledFor: Date,
  repeat: ReminderRepeat
): Notifications.NotificationTriggerInput {
  if (repeat === "daily") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: scheduledFor.getHours(),
      minute: scheduledFor.getMinutes(),
    };
  }

  if (repeat === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: scheduledFor.getDay() + 1,
      hour: scheduledFor.getHours(),
      minute: scheduledFor.getMinutes(),
    };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: scheduledFor,
  };
}

function getReminderKey(protocolId: string, action: ScheduledProtocolAction) {
  return `${protocolId}:${action.actionIndex}:${action.action}`;
}

async function getWritableDeviceCalendar() {
  try {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    if (defaultCalendar?.allowsModifications) {
      return defaultCalendar;
    }
  } catch {
    // Fall through to scanning writable calendars.
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return (
    calendars.find((calendar: Calendar.Calendar) => calendar.allowsModifications && calendar.isPrimary) ||
    calendars.find(
      (calendar: Calendar.Calendar) =>
        calendar.allowsModifications && calendar.isVisible !== false
    ) ||
    calendars.find((calendar: Calendar.Calendar) => calendar.allowsModifications) ||
    null
  );
}

function getActionKey(action: ScheduledProtocolAction) {
  return `${action.actionIndex}:${action.action || "action"}`;
}

function playSoftHaptic() {
  if (Platform.OS === "ios") {
    Vibration.vibrate(8);
    return;
  }

  if (Platform.OS === "android") {
    Vibration.vibrate(12);
  }
}

function formatReminderDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function usageMeterLabel(meter: string) {
  if (meter === "agent_question") return "AI";
  if (meter === "voice_question") return "Voice";
  if (meter === "report_generation") return "Reports";
  if (meter === "future_self_simulation") return "Simulator";
  if (meter === "optimization_protocol") return "Protocols";
  if (meter === "lab_import") return "Labs";
  return meter.replaceAll("_", " ");
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function updateUsageMeter(
  current: UsageLimitsPayload | null,
  next: UsageMeterSnapshot
): UsageLimitsPayload | null {
  if (!current) return current;

  return {
    ...current,
    usage: current.usage.map((item) => (item.meter === next.meter ? next : item)),
  };
}

function voicePhaseLabel(
  phase: VoicePhase,
  speaking: boolean,
  recording: boolean
) {
  if (recording || phase === "listening") return "Listening";
  if (speaking || phase === "speaking") return "Speaking";
  if (phase === "processing") return "Thinking";
  if (phase === "ready_follow_up") return "Ready for follow-up";
  return "Voice conversation";
}

function isNotificationPermissionGranted(permission: unknown) {
  const result = permission as { granted?: boolean; status?: string };
  return result.granted === true || result.status === "granted";
}

function isPermissionGranted(permission: unknown) {
  const result = permission as { granted?: boolean; status?: string };
  return result.granted === true || result.status === "granted";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    padding: 22,
    gap: 18,
  },
  hero: {
    paddingTop: 22,
    paddingBottom: 8,
  },
  eyebrow: {
    color: "rgba(218,188,115,0.92)",
    fontSize: 11,
    letterSpacing: 2.4,
    marginBottom: 18,
  },
  title: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 39,
    lineHeight: 42,
    fontWeight: "300",
  },
  copy: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
  },
  panel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.18)",
    backgroundColor: "rgba(218,188,115,0.045)",
    borderRadius: 10,
    padding: 18,
  },
  autopilotPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.26)",
    backgroundColor: "rgba(218,188,115,0.07)",
    borderRadius: 10,
    padding: 18,
  },
  statusRow: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  activeTab: {
    borderColor: "rgba(218,188,115,0.32)",
    backgroundColor: "rgba(218,188,115,0.12)",
  },
  tabText: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  activeTabText: {
    color: "rgba(238,214,154,0.94)",
  },
  cardLabel: {
    color: "rgba(218,188,115,0.82)",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  cardTitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 22,
    fontWeight: "300",
  },
  smallTitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 17,
    fontWeight: "400",
  },
  cardCopy: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  form: {
    gap: 10,
    marginTop: 16,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.24)",
    color: "rgba(255,255,255,0.88)",
    paddingHorizontal: 14,
  },
  button: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.92)",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  buttonText: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  textButton: {
    minHeight: 32,
    justifyContent: "center",
  },
  textButtonText: {
    color: "rgba(238,214,154,0.86)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  compactButton: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  compactButtonText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  actionList: {
    gap: 18,
    marginTop: 18,
  },
  dailyBriefPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.22)",
    backgroundColor: "rgba(218,188,115,0.065)",
    borderRadius: 10,
    padding: 18,
  },
  briefTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 30,
  },
  briefCopy: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  briefAction: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginTop: 16,
    padding: 12,
  },
  protocolStats: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  actionNotice: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.24)",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.075)",
    marginTop: 14,
    padding: 12,
  },
  actionNoticeLabel: {
    color: "rgba(238,214,154,0.82)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  actionNoticeText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.32)",
    borderRadius: 10,
    backgroundColor: "rgba(218,188,115,0.09)",
    padding: 18,
  },
  feedbackCopy: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  feedbackGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  feedbackButton: {
    minHeight: 42,
    minWidth: "48%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
  },
  feedbackButtonPrimary: {
    borderColor: "rgba(218,188,115,0.48)",
    backgroundColor: "rgba(218,188,115,0.92)",
  },
  feedbackButtonText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  feedbackButtonPrimaryText: {
    color: "#080808",
  },
  agentPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.26)",
    borderRadius: 10,
    backgroundColor: "rgba(218,188,115,0.065)",
    padding: 18,
  },
  agentSuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  voicePanel: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    gap: 14,
    marginTop: 16,
    padding: 14,
  },
  voiceSignal: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  voiceOrb: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  voiceOrbActive: {
    backgroundColor: "rgba(218,188,115,0.92)",
    shadowColor: "#dabc73",
    shadowOpacity: 0.7,
    shadowRadius: 14,
  },
  voiceOrbProcessing: {
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.44,
  },
  voiceCopyGroup: {
    flex: 1,
  },
  voiceTitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "700",
  },
  voiceHint: {
    color: "rgba(255,255,255,0.36)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  voiceControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  voiceTranscriptPanel: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.026)",
    gap: 6,
    padding: 12,
  },
  voiceTranscriptLabel: {
    color: "rgba(218,188,115,0.72)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: "uppercase",
  },
  voiceTranscriptText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    lineHeight: 18,
  },
  voiceButton: {
    minHeight: 42,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(218,188,115,0.92)",
    paddingHorizontal: 16,
  },
  voiceButtonSecondary: {
    minHeight: 42,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
  },
  voiceButtonText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  voiceButtonPrimaryText: {
    color: "#080808",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  mobileUsagePanel: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.026)",
    marginTop: 12,
    padding: 12,
  },
  mobileUsageHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  mobileUsagePlan: {
    color: "rgba(238,214,154,0.86)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  mobileUsageGrid: {
    flexDirection: "row",
    gap: 8,
  },
  mobileUsageItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.16)",
    padding: 10,
  },
  mobileUsageLabel: {
    color: "rgba(218,188,115,0.72)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  mobileUsageValue: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 7,
  },
  mobileUsageDetail: {
    color: "rgba(255,255,255,0.34)",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  mobileModalitiesPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.18)",
    borderRadius: 10,
    backgroundColor: "rgba(218,188,115,0.045)",
    marginTop: 12,
    padding: 12,
  },
  mobileModalitiesCopy: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  mobileModalityList: {
    gap: 9,
    marginTop: 12,
  },
  mobileModalityCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.18)",
    padding: 12,
  },
  mobileModalityIncluded: {
    borderColor: "rgba(218,188,115,0.28)",
    backgroundColor: "rgba(218,188,115,0.055)",
  },
  mobileModalityTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  mobileModalityName: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 19,
  },
  mobileModalityAccess: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    color: "rgba(255,255,255,0.42)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  mobileModalityAccessIncluded: {
    borderColor: "rgba(218,188,115,0.26)",
    color: "rgba(238,214,154,0.88)",
  },
  mobileModalityMeta: {
    color: "rgba(218,188,115,0.72)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 10,
    textTransform: "uppercase",
  },
  clinicalMemoryPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.18)",
    borderRadius: 10,
    backgroundColor: "rgba(218,188,115,0.052)",
    marginTop: 14,
    padding: 14,
  },
  clinicalMemoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  clinicalMemoryStatus: {
    color: "rgba(218,188,115,0.82)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  clinicalSafetyPill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    color: "rgba(255,255,255,0.44)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  clinicalMemoryTitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },
  clinicalMemoryCopy: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 9,
  },
  clinicalTrajectoryCopy: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.46)",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
    padding: 10,
  },
  clinicalAnswerPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.16)",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  clinicalAnswerLabel: {
    color: "rgba(218,188,115,0.78)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  clinicalAnswerInput: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.24)",
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  clinicalAnswerHint: {
    color: "rgba(255,255,255,0.36)",
    fontSize: 11,
    lineHeight: 17,
  },
  clinicalAnswerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  clinicalDomainRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  clinicalDomainPill: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.035)",
    color: "rgba(255,255,255,0.48)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  agentSuggestion: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  agentSuggestionText: {
    color: "rgba(238,214,154,0.82)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  agentMessageList: {
    gap: 10,
    marginTop: 18,
  },
  agentActionList: {
    gap: 8,
    marginTop: 16,
  },
  agentActionItem: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.22)",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.07)",
    padding: 12,
  },
  agentMessage: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    padding: 13,
  },
  agentUserMessage: {
    borderColor: "rgba(218,188,115,0.22)",
    backgroundColor: "rgba(218,188,115,0.075)",
  },
  agentMessageText: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 13,
    lineHeight: 21,
  },
  agentInputRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  agentInput: {
    minHeight: 50,
    maxHeight: 112,
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.24)",
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  agentSendButton: {
    width: 58,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.92)",
  },
  agentSendText: {
    color: "#080808",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  weeklyReviewPanel: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 18,
  },
  reviewScorePill: {
    minWidth: 58,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.28)",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewScore: {
    color: "rgba(238,214,154,0.94)",
    fontSize: 20,
    fontWeight: "400",
  },
  reviewScoreLabel: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  reviewStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  reviewStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  learningNote: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.2)",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.06)",
    marginTop: 14,
    padding: 12,
  },
  modePill: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.28)",
    borderRadius: 999,
    color: "rgba(238,214,154,0.88)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  schedulePreviewHeader: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  scheduleMetric: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  scheduleMetricValue: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 18,
    fontWeight: "400",
  },
  scheduleMetricLabel: {
    color: "rgba(218,188,115,0.58)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  schedulePreviewList: {
    gap: 8,
    marginTop: 16,
  },
  confidenceStrip: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.18)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.16)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    padding: 12,
  },
  confidenceText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 230,
  },
  confidenceValue: {
    color: "rgba(238,214,154,0.94)",
    fontSize: 24,
    fontWeight: "300",
  },
  schedulePreviewItem: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  scheduleTimeColumn: {
    width: 60,
  },
  autopilotTime: {
    color: "rgba(238,214,154,0.82)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  scheduleStatusText: {
    color: "rgba(255,255,255,0.36)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 5,
    textTransform: "uppercase",
  },
  schedulePreviewCopy: {
    flex: 1,
  },
  autopilotAction: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 18,
  },
  scheduleReason: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  scheduleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  scheduleStatusDotActive: {
    backgroundColor: "rgba(218,188,115,0.88)",
  },
  scheduleStatusDotPending: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  autopilotActions: {
    marginTop: 2,
  },
  autopilotPrimaryButton: {
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statValue: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 18,
    fontWeight: "400",
  },
  statLabel: {
    color: "rgba(218,188,115,0.58)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  actionSection: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    fontWeight: "400",
  },
  compactSectionTitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "400",
  },
  sectionCount: {
    minWidth: 28,
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.22)",
    borderRadius: 999,
    color: "rgba(238,214,154,0.82)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 24,
    overflow: "hidden",
    textAlign: "center",
  },
  sectionCopy: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: -6,
  },
  protocolOverview: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    gap: 14,
    paddingTop: 16,
  },
  compactSection: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.025)",
    gap: 12,
    padding: 12,
  },
  primaryActionCard: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.2)",
    borderRadius: 8,
    backgroundColor: "rgba(218,188,115,0.055)",
    padding: 14,
  },
  primaryActionTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 18,
    fontWeight: "300",
    lineHeight: 24,
  },
  actionItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.018)",
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  compactActionItem: {
    gap: 10,
    padding: 10,
  },
  expandedActionItem: {
    borderColor: "rgba(218,188,115,0.24)",
    backgroundColor: "rgba(218,188,115,0.055)",
  },
  actionIndex: {
    width: 26,
    height: 26,
    overflow: "hidden",
    borderRadius: 13,
    backgroundColor: "rgba(218,188,115,0.12)",
    color: "rgba(238,214,154,0.92)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 26,
    textAlign: "center",
  },
  actionBody: {
    flex: 1,
  },
  actionHeader: {
    alignItems: "flex-start",
    gap: 8,
  },
  actionTitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    lineHeight: 21,
  },
  actionMeta: {
    color: "rgba(218,188,115,0.62)",
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: "uppercase",
  },
  actionWhy: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  adherenceControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  adherenceButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  adherenceButtonText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  reminderButton: {
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  calendarButton: {
    borderColor: "rgba(218,188,115,0.38)",
    backgroundColor: "rgba(218,188,115,0.12)",
  },
  reminderText: {
    color: "rgba(218,188,115,0.64)",
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 10,
    textTransform: "uppercase",
  },
  adherencePill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  adherencePillDone: {
    borderColor: "rgba(218,188,115,0.34)",
    backgroundColor: "rgba(218,188,115,0.1)",
  },
  adherencePillText: {
    color: "rgba(238,214,154,0.86)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shortcut: {
    width: "48%",
    minHeight: 86,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 10,
    padding: 14,
    justifyContent: "space-between",
  },
  shortcutTitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 18,
  },
  mobileCommandPanel: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.028)",
    borderRadius: 10,
    padding: 18,
  },
  mobileCommandGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  mobileCommandStat: {
    width: "48%",
    minHeight: 116,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    padding: 12,
  },
  mobileCommandValue: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 28,
    fontWeight: "300",
    marginTop: 2,
  },
  mobileCommandDetail: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  mobileCommandCopy: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 16,
  },
  messageList: {
    gap: 12,
    marginTop: 18,
  },
  detailPanel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.24)",
    backgroundColor: "rgba(218,188,115,0.06)",
    borderRadius: 10,
    padding: 20,
  },
  detailHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailTitle: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 26,
    fontWeight: "300",
    lineHeight: 32,
    marginTop: 6,
  },
  detailCopy: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
  },
  detailActions: {
    marginTop: 8,
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  secondaryActionText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  messageItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 8,
    padding: 14,
  },
  featuredMessageItem: {
    borderColor: "rgba(218,188,115,0.28)",
    backgroundColor: "rgba(218,188,115,0.055)",
    padding: 16,
  },
  selectedMessageItem: {
    borderColor: "rgba(218,188,115,0.42)",
    backgroundColor: "rgba(218,188,115,0.09)",
  },
  selectedMessageLabel: {
    color: "rgba(238,214,154,0.9)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  inboxNotice: {
    color: "rgba(238,214,154,0.76)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  messageHeader: {
    gap: 8,
    marginBottom: 8,
  },
  messageTitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    lineHeight: 20,
  },
  messageDate: {
    color: "rgba(218,188,115,0.58)",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  messageCopy: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 13,
    lineHeight: 20,
  },
  recentMessages: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    gap: 10,
    paddingTop: 14,
  },
  compactMessageItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.025)",
    gap: 6,
    padding: 12,
  },
  compactMessageTitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 18,
  },
  moreText: {
    color: "rgba(218,188,115,0.58)",
    fontSize: 11,
    lineHeight: 17,
  },
  preferenceRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  preferenceLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    marginBottom: 6,
  },
  modeButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  activeModeButton: {
    borderColor: "rgba(218,188,115,0.34)",
    backgroundColor: "rgba(218,188,115,0.12)",
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  activeModeButtonText: {
    color: "rgba(238,214,154,0.9)",
  },
  quietHours: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 13,
    marginTop: 14,
  },
  diagnosticList: {
    gap: 10,
    marginTop: 16,
  },
  diagnosticItem: {
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.16)",
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  diagnosticDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 6,
  },
  diagnosticPass: {
    backgroundColor: "rgba(132,220,170,0.88)",
  },
  diagnosticWarn: {
    backgroundColor: "rgba(238,214,154,0.9)",
  },
  diagnosticFail: {
    backgroundColor: "rgba(255,118,118,0.88)",
  },
  diagnosticCopy: {
    flex: 1,
  },
  emptyText: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 14,
    lineHeight: 22,
  },
  warning: {
    color: "rgba(255,196,126,0.9)",
    fontSize: 13,
    lineHeight: 20,
  },
});
