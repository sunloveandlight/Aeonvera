import "react-native-url-polyfill/auto";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  View,
} from "react-native";
import { createClient, type Session } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";

type ActiveView = "today" | "inbox" | "settings";

type CoachMessage = {
  id: string;
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

type Preferences = {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
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

const shortcuts = [
  { label: "Twin", title: "Digital Twin", path: "/digital-twin" },
  { label: "Optimize", title: "Optimization", path: "/optimization" },
  { label: "Report", title: "Report", path: "/report" },
];

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>("today");
  const [pushStatus, setPushStatus] = useState("Not requested");
  const [authStatus, setAuthStatus] = useState("Signed out");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [adherenceEvents, setAdherenceEvents] = useState<AdherenceEvent[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const appUrl = useMemo(() => WEB_URL.replace(/\/$/, ""), []);

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

      const [messageResult, protocolResult, preferenceResult] = await Promise.all([
        supabase
          .from("notification_deliveries")
          .select("id,title,message,status,payload,created_at,sent_at")
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
    []
  );

  useEffect(() => {
    if (!supabase) {
      setAuthStatus("Mobile auth needs Supabase env vars");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthStatus(data.session ? "Signed in" : "Signed out");
      void loadCompanionData(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setAuthStatus(nextSession ? "Signed in" : "Signed out");
      if (nextSession) {
        void loadCompanionData(nextSession);
      } else {
        setProtocol(null);
        setAdherenceEvents([]);
        setCoachMessages([]);
        setPreferences(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadCompanionData]);

  useEffect(() => {
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | { path?: string; url?: string }
          | undefined;

        if (data?.url) {
          void Linking.openURL(data.url);
          return;
        }

        if (data?.path) {
          void openPath(data.path);
          return;
        }

        setActiveView("inbox");
      });

    return () => responseSubscription.remove();
  }, [openPath]);

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

  async function recordAdherence(
    action: ProtocolAction,
    actionIndex: number,
    outcome: AdherenceOutcome
  ) {
    if (!supabase || !session || !protocol?.id || !action.action) return;

    const notes =
      outcome === "success"
        ? "Completed from mobile."
        : outcome === "failure"
          ? "Skipped from mobile."
          : "Rescheduled from mobile.";
    const domain = action.domain || "Optimization";
    const measuredAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("intervention_outcomes")
      .insert({
        user_id: session.user.id,
        protocol_id: protocol.id,
        domain,
        action: action.action,
        outcome,
        success: outcome === "success",
        confidence: outcome === "unknown" ? 0.45 : 0.8,
        notes,
        measured_at: measuredAt,
        followup_snapshot: {
          source: "mobile",
          action_index: actionIndex,
          cadence: action.cadence || null,
          impact: action.impact || null,
        },
      })
      .select("id,protocol_id,domain,action,outcome,success,notes,measured_at,created_at")
      .single();

    if (error) {
      Alert.alert("Action not saved", error.message);
      return;
    }

    await supabase.from("behavior_events").insert({
      user_id: session.user.id,
      type: "protocol_action",
      event_type: `protocol_action_${outcome}`,
      domain,
      action: action.action,
      outcome,
      payload: {
        protocol_id: protocol.id,
        action_index: actionIndex,
        cadence: action.cadence || null,
        impact: action.impact || null,
        source: "mobile",
      },
    });

    setAdherenceEvents((current) => [
      data as AdherenceEvent,
      ...current.filter(
        (event) =>
          event.protocol_id !== protocol.id || event.action !== action.action
      ),
    ]);
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

        {!session ? (
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
              <Pressable style={styles.compactButton} onPress={() => void signOut()}>
                <Text style={styles.compactButtonText}>Sign out</Text>
              </Pressable>
            </View>

            <View style={styles.tabs}>
              {(["today", "inbox", "settings"] as ActiveView[]).map((view) => (
                <Pressable
                  key={view}
                  style={[styles.tab, activeView === view && styles.activeTab]}
                  onPress={() => setActiveView(view)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeView === view && styles.activeTabText,
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
                appUrl={appUrl}
                latestActions={latestActions}
                latestMessage={latestMessage}
                latestSummary={latestSummary}
                openPath={openPath}
                protocol={protocol}
                recordAdherence={recordAdherence}
              />
            ) : null}

            {activeView === "inbox" ? (
              <InboxView messages={coachMessages} openPath={openPath} />
            ) : null}

            {activeView === "settings" ? (
              <SettingsView
                preferences={preferences}
                pushStatus={pushStatus}
                prepareNotifications={prepareNotifications}
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
  adherenceEvents,
  latestActions,
  latestMessage,
  latestSummary,
  openPath,
  protocol,
  recordAdherence,
}: {
  adherenceEvents: AdherenceEvent[];
  appUrl: string;
  latestActions: ProtocolAction[];
  latestMessage: string;
  latestSummary: string;
  openPath: (path: string) => Promise<void>;
  protocol: Protocol | null;
  recordAdherence: (
    action: ProtocolAction,
    actionIndex: number,
    outcome: AdherenceOutcome
  ) => Promise<void>;
}) {
  const adherenceByAction = buildLatestAdherenceByAction(adherenceEvents);

  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Today&apos;s Protocol</Text>
        <Text style={styles.cardTitle}>{protocol ? "Active protocol" : "Build protocol"}</Text>
        <Text style={styles.cardCopy}>{latestSummary}</Text>
        <View style={styles.actionList}>
          {latestActions.length ? (
            latestActions.slice(0, 4).map((action, index) => (
              <View key={`${action.action}-${index}`} style={styles.actionItem}>
                <Text style={styles.actionIndex}>{index + 1}</Text>
                <View style={styles.actionBody}>
                  <View style={styles.actionHeader}>
                    <Text style={styles.actionTitle}>{action.action}</Text>
                    <AdherencePill event={adherenceByAction[action.action || ""]} />
                  </View>
                  <Text style={styles.actionMeta}>
                    {[action.domain, action.cadence, action.impact]
                      .filter(Boolean)
                      .join(" / ")}
                  </Text>
                  {action.why ? <Text style={styles.actionWhy}>{action.why}</Text> : null}
                  <View style={styles.adherenceControls}>
                    <Pressable
                      style={styles.adherenceButton}
                      onPress={() => void recordAdherence(action, index, "success")}
                    >
                      <Text style={styles.adherenceButtonText}>Done</Text>
                    </Pressable>
                    <Pressable
                      style={styles.adherenceButton}
                      onPress={() => void recordAdherence(action, index, "failure")}
                    >
                      <Text style={styles.adherenceButtonText}>Skip</Text>
                    </Pressable>
                    <Pressable
                      style={styles.adherenceButton}
                      onPress={() => void recordAdherence(action, index, "unknown")}
                    >
                      <Text style={styles.adherenceButtonText}>Later</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
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

      <View style={styles.panel}>
        <Text style={styles.cardLabel}>Coach Signal</Text>
        <Text style={styles.cardTitle}>Latest guidance</Text>
        <Text style={styles.cardCopy}>{latestMessage}</Text>
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
    </>
  );
}

function InboxView({
  messages,
  openPath,
}: {
  messages: CoachMessage[];
  openPath: (path: string) => Promise<void>;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.cardLabel}>Coach Inbox</Text>
      <Text style={styles.cardTitle}>{messages.length ? "Latest messages" : "No messages yet"}</Text>
      <View style={styles.messageList}>
        {messages.length ? (
          messages.map((message) => (
            <Pressable
              key={message.id}
              style={styles.messageItem}
              onPress={() => void openMessage(message, openPath)}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.messageTitle}>{message.title}</Text>
                <Text style={styles.messageDate}>{formatDate(message.created_at)}</Text>
              </View>
              <Text style={styles.messageCopy}>{message.message}</Text>
            </Pressable>
          ))
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

function SettingsView({
  preferences,
  prepareNotifications,
  pushStatus,
  savePreferences,
}: {
  preferences: Preferences | null;
  prepareNotifications: () => Promise<void>;
  pushStatus: string;
  savePreferences: (next: Partial<Preferences>) => Promise<void>;
}) {
  return (
    <>
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
  buttonText: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
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
    gap: 12,
    marginTop: 18,
  },
  actionItem: {
    flexDirection: "row",
    gap: 12,
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
    gap: 10,
  },
  shortcut: {
    flex: 1,
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
  messageList: {
    gap: 12,
    marginTop: 18,
  },
  messageItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 8,
    padding: 14,
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
