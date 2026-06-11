import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";

const WEB_URL =
  process.env.EXPO_PUBLIC_AEONVERA_WEB_URL ||
  Constants.expoConfig?.extra?.webUrl ||
  "https://www.aeonvera.com";

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
  const appUrl = useMemo(() => WEB_URL.replace(/\/$/, ""), []);

  async function openPath(path: string) {
    await Linking.openURL(`${appUrl}${path}`);
  }

  async function prepareNotifications() {
    const current = await Notifications.getPermissionsAsync();
    const finalStatus =
      current.status === "granted"
        ? current.status
        : (await Notifications.requestPermissionsAsync()).status;

    if (finalStatus !== "granted") {
      setPushStatus("Permission not granted");
      Alert.alert("Notifications", "Notification permission was not granted.");
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync().catch(() => null);
    setPushStatus(token ? "Ready for native push" : "Permission granted");
    Alert.alert(
      "Notifications ready",
      "Native push permission is ready. The next backend step will sync this token into Aeonvera."
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
            and future iOS/Android push delivery.
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
          <Text style={styles.cardLabel}>Native Push</Text>
          <Text style={styles.cardTitle}>{pushStatus}</Text>
          <Text style={styles.cardCopy}>
            This prepares device permission. The backend token sync is the next
            bridge into Aeonvera's existing notification system.
          </Text>
          <Pressable style={styles.button} onPress={() => void prepareNotifications()}>
            <Text style={styles.buttonText}>Prepare notifications</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
});
