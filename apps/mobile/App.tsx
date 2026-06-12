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
import Constants from "expo-constants";
import * as Calendar from "expo-calendar";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";

type ActiveView = "today" | "inbox" | "message" | "settings";

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
  calendarTitle: string;
  scheduledFor: string;
};

type NotificationTapData = {
  path?: string;
  url?: string;
  target?: string;
  alertId?: string;
  alert_id?: string;
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
    principles?: string[];
  } | null;
  scheduled_event_ids?: string[] | null;
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
  const [dataMessage, setDataMessage] = useState<string | null>(null);
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
      }
    });

    return () => subscription.unsubscribe();
  }, [loadCompanionData]);

  const handleNotificationTap = useCallback(
    (data?: NotificationTapData) => {
      const alertId = data?.alertId || data?.alert_id || null;

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
        setActiveView(path.includes("focus=coach") ? "message" : "today");
        if (path.includes("focus=coach")) {
          selectedMessageOffsetY.current = null;
          setNotificationFocusTick((current) => current + 1);
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

  async function updateDailyPlanStatus(status: DailyExecutionPlan["status"]) {
    if (!session) return;

    const response = await fetch(`${appUrl}/api/autopilot/daily-plan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
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

  async function acceptDailyPlan() {
    if (acceptingDailyPlan) return;

    if (!dailyPlan?.plan?.items?.length) {
      Alert.alert("Autopilot", "There is no prepared plan to accept yet.");
      return;
    }

    if (dailyPlan.status === "accepted" || dailyPlan.status === "auto_scheduled") {
      setActionNotice("Today is already prepared. Aeonvera will not duplicate calendar events.");
      Alert.alert(
        "Already prepared",
        "Today’s Autopilot plan has already been created. Aeonvera will not add duplicate calendar events."
      );
      return;
    }

    const preferences = autopilotPreferences || defaultAutopilotPreferences(session?.user.id || "");
    const items = dailyPlan.plan.items.slice(0, 5);
    let scheduled = 0;
    let notified = 0;
    let skippedExisting = 0;

    setAcceptingDailyPlan(true);

    try {
      for (const item of items) {
        if (!item.action || !protocol?.id) continue;

        const actionKey = getReminderKey(protocol.id, item);
        if (nativeCalendarEvents[actionKey] || localReminders[actionKey]) {
          skippedExisting += 1;
          continue;
        }

        if (preferences.calendar_enabled && item.execution_mode !== "notify") {
          const eventId = await scheduleActionToNativeCalendar(item, "default", true);
          if (eventId) scheduled += 1;
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
          : "accepted"
      );

      const confirmation =
        scheduled || notified
          ? `Created ${scheduled} calendar block${scheduled === 1 ? "" : "s"}${
              notified ? ` and ${notified} phone notification${notified === 1 ? "" : "s"}` : ""
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
  ) {
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

    const scheduledFor = getReminderDate(action.scope, preset, action);
    const endDate = new Date(scheduledFor.getTime() + 30 * 60 * 1000);
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
        duration_minutes: 30,
        recurrence: "none",
        status: "scheduled",
        payload: {
          source: "mobile_device_calendar",
          calendar_title: calendar.title || null,
          platform: Platform.OS,
          action_index: action.actionIndex,
        },
      })
      .select("id")
      .maybeSingle();

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
          calendar_event_id: calendarRecordResult.data?.id || null,
          provider,
          provider_event_id: eventId,
          action_scope: action.scope,
          scheduled_for: scheduledFor.toISOString(),
          source: "mobile_device_calendar",
        },
      });
    }

    const calendarAppName = Platform.OS === "ios" ? "Apple Calendar" : "Android Calendar";
    if (!silent) {
      setActionNotice(
        `${calendarAppName} event added ${formatReminderDate(scheduledFor)} in ${
          calendar.title || "your calendar"
        }.`
      );
      playSoftHaptic();
    }
    if (!silent) {
      Alert.alert(
        "Added to calendar",
        `Scheduled ${formatReminderDate(scheduledFor)} in ${calendar.title || "your calendar"}. Open ${calendarAppName} to see it.`
      );
    }

    return eventId;
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
              {(["today", "inbox", "settings"] as ActiveView[]).map((view) => (
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
                setActionNotice={setActionNotice}
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
                preferences={preferences}
                pushStatus={pushStatus}
                prepareNotifications={prepareNotifications}
                saveAutopilotPreferences={saveAutopilotPreferences}
                savePreferences={savePreferences}
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
  latestActions,
  latestMessage,
  latestSummary,
  localReminders,
  nativeCalendarEvents,
  openPath,
  protocol,
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
  latestActions: ProtocolAction[];
  latestMessage: string;
  latestSummary: string;
  localReminders: Record<string, LocalReminder>;
  nativeCalendarEvents: Record<string, NativeCalendarEvent>;
  openPath: (path: string) => Promise<void>;
  protocol: Protocol | null;
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
        preferences={autopilotPreferences}
        skipDailyPlan={skipDailyPlan}
      />

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

function AutopilotPlanCard({
  acceptDailyPlan,
  acceptingDailyPlan,
  adjustAutopilot,
  autopilotMessage,
  dailyPlan,
  preferences,
  skipDailyPlan,
}: {
  acceptDailyPlan: () => Promise<void>;
  acceptingDailyPlan: boolean;
  adjustAutopilot: () => void;
  autopilotMessage: string | null;
  dailyPlan: DailyExecutionPlan | null;
  preferences: AutopilotPreferences | null;
  skipDailyPlan: () => Promise<void>;
}) {
  const items = dailyPlan?.plan?.items || [];
  const mode = preferences?.mode || dailyPlan?.autopilot_mode || "approve";
  const status = dailyPlan?.status || "prepared";
  const primaryItems = items.slice(0, 3);

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
      <Text style={styles.cardCopy}>
        {dailyPlan?.summary ||
          dailyPlan?.plan?.summary ||
          autopilotMessage ||
          "Aeonvera will prepare your day after your first active protocol."}
      </Text>
      {autopilotMessage ? <Text style={styles.warning}>{autopilotMessage}</Text> : null}
      {primaryItems.length ? (
        <View style={styles.autopilotItems}>
          {primaryItems.map((item) => (
            <View key={getActionKey(item)} style={styles.autopilotItem}>
              <Text style={styles.autopilotTime}>{item.recommended_time || "Smart"}</Text>
              <Text style={styles.autopilotAction}>{item.action}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.autopilotActions}>
        <Pressable
          style={[
            styles.button,
            styles.autopilotPrimaryButton,
            (acceptingDailyPlan ||
              status === "accepted" ||
              status === "auto_scheduled") &&
              styles.buttonDisabled,
          ]}
          disabled={
            acceptingDailyPlan || status === "accepted" || status === "auto_scheduled"
          }
          onPress={() => void acceptDailyPlan()}
        >
          <Text style={styles.buttonText}>
            {acceptingDailyPlan
              ? "Preparing"
              : status === "accepted" || status === "auto_scheduled"
                ? "Prepared"
                : "Accept Today"}
          </Text>
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
  preferences,
  prepareNotifications,
  pushStatus,
  saveAutopilotPreferences,
  savePreferences,
}: {
  autopilotPreferences: AutopilotPreferences | null;
  preferences: Preferences | null;
  prepareNotifications: () => Promise<void>;
  pushStatus: string;
  saveAutopilotPreferences: (next: Partial<AutopilotPreferences>) => Promise<void>;
  savePreferences: (next: Partial<Preferences>) => Promise<void>;
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
  autopilotItems: {
    gap: 8,
    marginTop: 16,
  },
  autopilotItem: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  autopilotTime: {
    width: 48,
    color: "rgba(238,214,154,0.82)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  autopilotAction: {
    flex: 1,
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 18,
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
