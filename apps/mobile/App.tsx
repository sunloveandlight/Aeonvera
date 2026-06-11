import "react-native-url-polyfill/auto";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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
  {
    label: "Today",
    title: "Companion",
    detail: "Today's protocol, coach inbox, and twin status.",
    path: "/companion",
  },
  {
    label: "Twin",
    title: "Digital Twin",
    detail: "The living model of your healthspan.",
    path: "/digital-twin",
  },
  {
    label: "Optimize",
    title: "Optimization",
    detail: "Generate and refine your active protocol.",
    path: "/optimization",
  },
  {
    label: "Report",
    title: "Longevity Report",
    detail: "Open your latest intelligence report.",
    path: "/report",
  },
];

export default function App() {
  const [pushStatus, setPushStatus] = useState("Not requested");
  const [authStatus, setAuthStatus] = useState("Signed out");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const appUrl = useMemo(() => WEB_URL.replace(/\/$/, ""), []);

  useEffect(() => {
    if (!supabase) {
      setAuthStatus("Mobile auth needs Supabase env vars");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthStatus(data.session ? "Signed in" : "Signed out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setAuthStatus(nextSession ? "Signed in" : "Signed out");
    });

    return () => subscription.unsubscribe();
  }, []);

  async function openPath(path: string) {
    await Linking.openURL(`${appUrl}${path}`);
  }

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
    Alert.alert(
      "Notifications connected",
      "This device is now connected to Aeonvera coach notifications."
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>AEONVERA MOBILE</Text>
          <Text style={styles.title}>Your healthspan companion.</Text>
          <Text style={styles.copy}>
            Native shell for the daily protocol, coach messages, Digital Twin,
            and iOS/Android notification delivery.
          </Text>
        </View>

        <View style={styles.grid}>
          {shortcuts.map((item) => (
            <Pressable
              key={item.path}
              style={styles.card}
              onPress={() => void openPath(item.path)}
            >
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCopy}>{item.detail}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.cardLabel}>Aeonvera Account</Text>
          <Text style={styles.cardTitle}>{authStatus}</Text>
          <Text style={styles.cardCopy}>
            Sign in with the same account you use on the website so native push
            messages connect to your real coach feed.
          </Text>

          {!session ? (
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
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.cardLabel}>Native Push</Text>
          <Text style={styles.cardTitle}>{pushStatus}</Text>
          <Text style={styles.cardCopy}>
            Register this device so coach messages can reach you through iOS or
            Android notifications.
          </Text>
          <Pressable
            style={[styles.button, !session && styles.disabledButton]}
            onPress={() => void prepareNotifications()}
          >
            <Text style={styles.buttonText}>Connect notifications</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
    paddingBottom: 12,
  },
  eyebrow: {
    color: "rgba(218,188,115,0.92)",
    fontSize: 11,
    letterSpacing: 2.4,
    marginBottom: 18,
  },
  title: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 42,
    lineHeight: 45,
    fontWeight: "300",
  },
  copy: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
  },
  grid: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 10,
    padding: 18,
  },
  panel: {
    borderWidth: 1,
    borderColor: "rgba(218,188,115,0.18)",
    backgroundColor: "rgba(218,188,115,0.045)",
    borderRadius: 10,
    padding: 18,
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
  cardCopy: {
    color: "rgba(255,255,255,0.42)",
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
  disabledButton: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  secondaryButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    marginTop: 16,
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});
