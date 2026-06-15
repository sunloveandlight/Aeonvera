"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, PhoneOff, Send, X } from "lucide-react";

type CommandMessage = {
  content: string;
  role: "assistant" | "user";
};

type ActionReceipt = {
  actionType: ActionType;
  createdAt: number;
  detail: string;
  id: string;
  title: string;
  tone: "caution" | "info" | "success";
};

type ActionType =
  | "action_error"
  | "billing"
  | "checkout"
  | "create_care_invite"
  | "create_physician_share"
  | "generate_report"
  | "navigation"
  | "open_care_network"
  | "open_oura"
  | "plan_change"
  | "plan_options"
  | "prepare_today"
  | "simplify_plan"
  | "sync_oura";

type ActivityEventRow = {
  action_type?: string;
  created_at?: string;
  detail?: string;
  id?: string;
  title?: string;
  tone?: string;
};

type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];
type PlanId = "core" | "elite" | "sovereign";
type ConfirmationIntent = Extract<
  ControlIntent,
  { type: "create_physician_share" | "manage_care_network" }
>;
type ControlIntent =
  | {
      type: "create_physician_share";
      expiresInDays?: number;
      includedSections?: string[];
      recipientEmail?: string;
      recipientLabel?: string;
    }
  | { type: "generate_report" }
  | {
      type: "manage_care_network";
      email?: string;
      expiresInDays?: number;
      memberName?: string;
      permissions?: string[];
      role?: CareRole;
    }
  | { type: "open_oura" }
  | { type: "prepare_today" }
  | { type: "simplify_plan" }
  | { type: "sync_oura" };
type CareRole = "coach" | "family" | "physician";
type PlannerAction =
  | { kind: "answer"; text: string }
  | { intent: ControlIntent; kind: "control" }
  | { intent: PlanIntent; kind: "plan" }
  | { href: string; kind: "navigation"; label: string };
type PlannerResult = {
  action?: PlannerAction | null;
  confidence?: number;
  handled?: boolean;
  message?: string;
  tool?: {
    confirmationRequired?: boolean;
    id?: string;
    label?: string;
    minimumPlan?: string;
    risk?: string;
  } | null;
};
type PendingRealtimeAction =
  | { intent: ControlIntent; type: "control" }
  | { intent: ControlIntent; type: "execute_control" }
  | { intent: PlanIntent; type: "plan" }
  | { href: string; label: string; type: "navigation" };

type RealtimeEvent = {
  error?: { message?: string };
  transcript?: string;
  type?: string;
};

const HIDDEN_ROUTES = [
  "/care-network/",
  "/future-self/",
  "/login",
  "/physician-share/",
  "/privacy",
  "/terms",
];

const STARTER_PROMPTS = [
  "What should I do first today?",
  "Open my Digital Twin",
  "Explain my plan like a coach",
];

const VOICE_OPTIONS = [
  { id: "marin", label: "Marin", tone: "Warm, calm, premium" },
  { id: "cedar", label: "Cedar", tone: "Grounded and steady" },
  { id: "alloy", label: "Alloy", tone: "Clear and neutral" },
  { id: "verse", label: "Verse", tone: "Expressive and conversational" },
  { id: "shimmer", label: "Shimmer", tone: "Bright and light" },
] as const;

const DEFAULT_VOICE: VoiceId = "marin";
const PLAN_ORDER: PlanId[] = ["core", "elite", "sovereign"];
const PLAN_LABEL: Record<PlanId, string> = {
  core: "Core",
  elite: "Elite",
  sovereign: "Sovereign",
};

const NAVIGATION_INTENTS = [
  {
    href: "/companion",
    label: "Ask Aeonvera",
    pattern: /\b(ask|companion|coach|chat|talk|voice)\b/i,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    pattern: /\b(dashboard|home|overview|command center)\b/i,
  },
  {
    href: "/digital-twin",
    label: "Digital Twin",
    pattern: /\b(digital twin|twin|simulation|timeline|future model)\b/i,
  },
  {
    href: "/life-os",
    label: "Life OS",
    pattern: /\b(life os|life operating system|purpose|productivity|trajectory)\b/i,
  },
  {
    href: "/plan",
    label: "Your Plan",
    pattern: /\b(plan|subscription|usage|membership|tier)\b/i,
  },
  {
    href: "/pricing",
    label: "Pricing",
    pattern: /\b(upgrade|downgrade|pricing|price|sovereign|elite|core|billing)\b/i,
  },
  {
    href: "/data-sources",
    label: "Data Sources",
    pattern: /\b(oura|whoop|wearable|device|data source|connect)\b/i,
  },
  {
    href: "/physician-export",
    label: "Physician Export",
    pattern: /\b(doctor|physician|clinician|clinical export|medical share)\b/i,
  },
  {
    href: "/network",
    label: "Care Network",
    pattern: /\b(care network|family|coach invite|invite)\b/i,
  },
  {
    href: "/report",
    label: "Report",
    pattern: /\b(report|longevity report|biological age report)\b/i,
  },
];

export default function AeonCommandOrb() {
  const pathname = usePathname();
  const router = useRouter();
  const pendingRealtimeActionRef = useRef<PendingRealtimeAction | null>(null);
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CommandMessage[]>([
    {
      role: "assistant",
      content:
        "I can answer, guide, and move through Aeonvera with you. Ask naturally.",
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>(getSavedVoice);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [idleDimmed, setIdleDimmed] = useState(false);
  const [actionReceipts, setActionReceipts] = useState<ActionReceipt[]>([]);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationIntent | null>(
    null
  );

  const hidden = useMemo(
    () => HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(route)),
    [pathname]
  );

  const selectedVoiceOption = useMemo(
    () => VOICE_OPTIONS.find((voice) => voice.id === selectedVoice) || VOICE_OPTIONS[0],
    [selectedVoice]
  );
  const latestReceipt = actionReceipts[0] || null;

  const stopRealtimeVoice = useCallback((updateState = true) => {
    realtimePeerRef.current?.close();
    realtimePeerRef.current = null;
    pendingRealtimeActionRef.current = null;

    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
    realtimeStreamRef.current = null;

    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.srcObject = null;
    }

    if (updateState) {
      setRealtimeActive(false);
      setRealtimeStatus(null);
      setSpeaking(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRealtimeVoice(false);
    };
  }, [stopRealtimeVoice]);

  useEffect(() => {
    if (open || realtimeActive || realtimeStatus || speaking || thinking) {
      setIdleDimmed(false);
      return;
    }

    const timeout = window.setTimeout(() => setIdleDimmed(true), 9000);
    return () => window.clearTimeout(timeout);
  }, [open, realtimeActive, realtimeStatus, speaking, thinking]);

  useEffect(() => {
    if (!receiptVisible) return;

    const timeout = window.setTimeout(() => setReceiptVisible(false), 7000);
    return () => window.clearTimeout(timeout);
  }, [latestReceipt?.id, receiptVisible]);

  useEffect(() => {
    if (hidden) return;

    let ignore = false;

    async function loadActivityHistory() {
      try {
        const response = await fetch("/api/agent/activity", {
          credentials: "include",
          method: "GET",
        });

        if (!response.ok) return;

        const data = (await response.json()) as { events?: ActivityEventRow[] };
        if (ignore || !Array.isArray(data.events)) return;

        const receipts = data.events.flatMap(mapActivityEventToReceipt);
        setActionReceipts(receipts.slice(0, 6));
      } catch {
        // Activity history is helpful, not required for the command orb to work.
      }
    }

    void loadActivityHistory();

    return () => {
      ignore = true;
    };
  }, [hidden]);

  if (hidden) return null;

  function pushActionReceipt(receipt: Omit<ActionReceipt, "createdAt" | "id">) {
    const nextReceipt: ActionReceipt = {
      ...receipt,
      createdAt: Date.now(),
      id:
        typeof window.crypto?.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    setActionReceipts((current) => [nextReceipt, ...current].slice(0, 6));
    setReceiptVisible(true);
    setIdleDimmed(false);
    void persistActionReceipt(nextReceipt);
  }

  async function submitCommand(command: string) {
    const question = command.trim();
    if (!question || thinking) return;

    setOpen(true);
    setInput("");
    setThinking(true);
    setMessages((current) => [...current, { role: "user", content: question }]);

    if (pendingConfirmation) {
      if (isConfirmationYes(question)) {
        const confirmed = pendingConfirmation;
        setPendingConfirmation(null);
        await executeControlIntent(confirmed);
        setThinking(false);
        return;
      }

      if (isConfirmationNo(question)) {
        setPendingConfirmation(null);
        setMessages((current) => [
          ...current,
          { role: "assistant", content: "Canceled. I did not create anything." },
        ]);
        setThinking(false);
        return;
      }
    }

    const plannedAction = await resolveServerPlannedAction(question);
    if (plannedAction) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: plannedAction.message },
      ]);
      await executePlannedAction(plannedAction.action);
      setThinking(false);
      return;
    }

    const controlIntent = resolveControlIntent(question);
    if (controlIntent) {
      await handleControlIntent(controlIntent);
      setThinking(false);
      return;
    }

    const planIntent = resolvePlanIntent(question);
    if (planIntent) {
      await handlePlanIntent(planIntent);
      setThinking(false);
      return;
    }

    const navigation = resolveNavigationIntent(question);
    if (navigation) {
      const answer = `Opening ${navigation.label}. I will stay here if you want to keep talking.`;
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      pushActionReceipt({
        actionType: "navigation",
        detail: "Aeonvera moved you to the requested area.",
        title: navigation.label,
        tone: "info",
      });
      router.push(navigation.href);
      setThinking(false);
      return;
    }

    try {
      const response = await fetch("/api/agent/chat", {
        body: JSON.stringify({
          history: messages.slice(-6),
          question,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Aeonvera could not answer right now.");
      }

      const answer =
        typeof data.answer === "string"
          ? data.answer
          : "I read the signal, but I need a little more context to answer well.";
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (error) {
      const answer =
        error instanceof Error
          ? error.message
          : "Aeonvera could not answer right now.";
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } finally {
      setThinking(false);
    }
  }

  async function startRealtimeVoice() {
    if (realtimeActive || thinking) return;

    setOpen(false);
    setRealtimeStatus("Opening a live voice line.");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        throw new Error("Realtime voice needs a browser with microphone and WebRTC support.");
      }

      const microphonePermission = await readMicrophonePermission();
      if (microphonePermission === "denied") {
        throw new Error(
          "Microphone access is blocked in this browser. Open site settings for Aeonvera and allow microphone access."
        );
      }

      setRealtimeStatus(
        microphonePermission === "prompt"
          ? "Your browser may ask for microphone access. Choose Allow once for this site."
          : "Opening the microphone."
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const peer = new RTCPeerConnection();
      const remoteStream = new MediaStream();
      const audio = new Audio();

      audio.autoplay = true;
      audio.srcObject = remoteStream;
      realtimeAudioRef.current = audio;
      realtimePeerRef.current = peer;
      realtimeStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        event.streams[0]?.getAudioTracks().forEach((track) => remoteStream.addTrack(track));
        if (!event.streams[0]) remoteStream.addTrack(event.track);
        setSpeaking(true);
        void audio.play().catch(() => undefined);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setRealtimeActive(true);
          setRealtimeStatus("Speak naturally. Aeonvera is listening.");
          return;
        }

        if (["closed", "disconnected", "failed"].includes(peer.connectionState)) {
          stopRealtimeVoice();
        }
      };

      const channel = peer.createDataChannel("aeonvera-realtime-events");
      channel.onopen = () => {
        setRealtimeStatus("Aeonvera is reading your current context.");
        setSpeaking(true);
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions:
                "Open the conversation in one short, specific sentence using the user's current Aeonvera context. Mention one concrete thing you can help with now, then ask what they want to do. Do not give a generic greeting.",
              output_modalities: ["audio"],
            },
          })
        );
      };
      channel.onmessage = (event) => handleRealtimeEvent(event.data);

      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      await peer.setLocalDescription(offer);

      const params = new URLSearchParams({
        page: pathname || "/",
        voice: selectedVoice,
      });
      const response = await fetch(`/api/agent/realtime?${params.toString()}`, {
        body: offer.sdp || "",
        credentials: "include",
        headers: { "Content-Type": "application/sdp" },
        method: "POST",
      });
      const answer = await response.text();

      if (!response.ok) {
        throw new Error(readRealtimeError(answer));
      }

      await peer.setRemoteDescription({ sdp: answer, type: "answer" });
      setRealtimeActive(true);
      setRealtimeStatus("Speak naturally. Aeonvera is listening.");
    } catch (error) {
      stopRealtimeVoice();
      const answer =
        error instanceof Error ? error.message : "Realtime voice could not start.";
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      setRealtimeStatus(answer);
      setOpen(false);
    }
  }

  function handleRealtimeEvent(rawEvent: string) {
    const event = parseRealtimeEvent(rawEvent);
    if (!event?.type) return;

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = event.transcript?.trim();
      if (transcript) {
        setMessages((current) => [...current, { role: "user", content: transcript }]);
        void planRealtimeTranscript(transcript);
      }
      return;
    }

    if (event.type === "response.output_audio_transcript.done") {
      const transcript = event.transcript?.trim();
      if (transcript) {
        setMessages((current) => [...current, { role: "assistant", content: transcript }]);
      }
      setSpeaking(false);
      setRealtimeStatus("Listening.");
      return;
    }

    if (event.type === "response.created") {
      setSpeaking(true);
      setRealtimeStatus("Aeonvera is answering.");
      return;
    }

    if (event.type === "response.done") {
      setSpeaking(false);
      setRealtimeStatus("Listening.");
      runPendingRealtimeAction();
      return;
    }

    if (event.type === "error") {
      setSpeaking(false);
      setRealtimeStatus(event.error?.message || "Realtime voice had trouble.");
    }
  }

  function handleVoiceChange(value: string) {
    const nextVoice = asVoiceId(value);
    setSelectedVoice(nextVoice);
    window.localStorage.setItem("aeonvera.voice", nextVoice);
    if (realtimeActive) {
      stopRealtimeVoice();
      setRealtimeStatus("Voice changed. Start the live line again.");
    }
  }

  async function planRealtimeTranscript(transcript: string) {
    if (pendingConfirmation) {
      if (isConfirmationYes(transcript)) {
        pendingRealtimeActionRef.current = {
          intent: pendingConfirmation,
          type: "execute_control",
        };
        setPendingConfirmation(null);
        setRealtimeStatus("I will do that after I finish.");
        return;
      }

      if (isConfirmationNo(transcript)) {
        setPendingConfirmation(null);
        setRealtimeStatus("Canceled.");
        return;
      }
    }

    const plannedAction = await resolveServerPlannedAction(transcript);
    if (plannedAction) {
      if (plannedAction.action.kind === "answer") {
        setRealtimeStatus("I answered that from your Aeonvera context.");
        return;
      }

      setRealtimeStatus("I will handle that after I finish.");
      pendingRealtimeActionRef.current = toPendingRealtimeAction(plannedAction.action);
      return;
    }

    const controlIntent = resolveControlIntent(transcript);
    const planIntent = resolvePlanIntent(transcript);
    const navigation = resolveNavigationIntent(transcript);
    if (controlIntent) {
      pendingRealtimeActionRef.current = { intent: controlIntent, type: "control" };
      setRealtimeStatus("I will handle that after I finish.");
    } else if (planIntent) {
      pendingRealtimeActionRef.current = { intent: planIntent, type: "plan" };
      setRealtimeStatus("I will open that after I finish.");
    } else if (navigation) {
      pendingRealtimeActionRef.current = {
        href: navigation.href,
        label: navigation.label,
        type: "navigation",
      };
      setRealtimeStatus(`I will open ${navigation.label} after I finish.`);
    }
  }

  function runPendingRealtimeAction() {
    const action = pendingRealtimeActionRef.current;
    if (!action) return;

    pendingRealtimeActionRef.current = null;
    window.setTimeout(() => {
      if (action.type === "control") {
        void handleControlIntent(action.intent);
        return;
      }

      if (action.type === "execute_control") {
        void executeControlIntent(action.intent);
        return;
      }

      if (action.type === "plan") {
        void handlePlanIntent(action.intent);
        return;
      }

      setRealtimeStatus(`Opening ${action.label}.`);
      pushActionReceipt({
        actionType: "navigation",
        detail: "Aeonvera moved you to the requested area.",
        title: action.label,
        tone: "info",
      });
      router.push(action.href);
    }, 650);
  }

  function closeOrb() {
    stopRealtimeVoice();
    setOpen(false);
  }

  async function executePlannedAction(action: PlannerAction) {
    if (action.kind === "answer") {
      return;
    }

    if (action.kind === "control") {
      await handleControlIntent(action.intent);
      return;
    }

    if (action.kind === "plan") {
      await handlePlanIntent(action.intent);
      return;
    }

    pushActionReceipt({
      actionType: "navigation",
      detail: "Aeonvera moved you to the requested area.",
      title: action.label,
      tone: "info",
    });
    router.push(action.href);
  }

  async function resolveServerPlannedAction(command: string) {
    try {
      const response = await fetch("/api/agent/planner", {
        body: JSON.stringify({
          command,
          currentPage: pathname || "/",
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) return null;

      const data = (await response.json()) as PlannerResult;
      if (!data.handled || !data.action || !isPlannerAction(data.action)) return null;

      return {
        action: data.action,
        message: data.message || "I can handle that.",
      };
    } catch {
      return null;
    }
  }

  async function handlePlanIntent(intent: PlanIntent) {
    try {
      const usageResponse = await fetch("/api/usage/limits", {
        credentials: "include",
        method: "GET",
      });

      if (usageResponse.status === 401) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: "I can do that after you sign in. Opening sign in now.",
          },
        ]);
        router.push("/login?mode=signin");
        return;
      }

      const usageData = await usageResponse.json().catch(() => ({}));
      const currentPlan = asPlanId(usageData.plan);
      const targetPlan = intent.targetPlan || inferPlanTarget(intent.direction, currentPlan);

      if (!targetPlan) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              "Opening your membership options. Choose Core, Elite, or Sovereign and I can handle the next step.",
          },
        ]);
        pushActionReceipt({
          actionType: "plan_options",
          detail: "Membership options opened for review.",
          title: "Plan options",
          tone: "info",
        });
        router.push("/pricing");
        return;
      }

      if (currentPlan === targetPlan && isActiveSubscription(usageData.subscriptionStatus)) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: `You are already on ${PLAN_LABEL[targetPlan]}. Opening billing so you can manage it.`,
          },
        ]);
        pushActionReceipt({
          actionType: "billing",
          detail: "Billing opened so you can manage the active membership.",
          title: `${PLAN_LABEL[targetPlan]} billing`,
          tone: "info",
        });
        await openBillingPortal(targetPlan);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: currentPlan
            ? `Opening Stripe to move you from ${PLAN_LABEL[currentPlan]} to ${PLAN_LABEL[targetPlan]}. You will confirm the billing effect before anything changes.`
            : `Opening checkout for ${PLAN_LABEL[targetPlan]}.`,
        },
      ]);

      if (currentPlan && isActiveSubscription(usageData.subscriptionStatus)) {
        pushActionReceipt({
          actionType: "plan_change",
          detail: `Stripe is opening to review the move to ${PLAN_LABEL[targetPlan]}.`,
          title: "Plan change",
          tone: "info",
        });
        await openBillingPortal(targetPlan);
      } else {
        pushActionReceipt({
          actionType: "checkout",
          detail: `Checkout is opening for ${PLAN_LABEL[targetPlan]}.`,
          title: "Checkout",
          tone: "info",
        });
        await openCheckout(targetPlan);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "I could not open the plan change flow right now.",
        },
      ]);
    }
  }

  async function handleControlIntent(intent: ControlIntent) {
    if (requiresConfirmation(intent)) {
      setPendingConfirmation(intent);
      setOpen(true);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: confirmationPromptForIntent(intent),
        },
      ]);
      return;
    }

    await executeControlIntent(intent);
  }

  async function executeControlIntent(intent: ControlIntent) {
    try {
      if (intent.type === "prepare_today") {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: "Preparing today's plan now." },
        ]);
        const data = await fetchJson("/api/autopilot/daily-plan", { method: "GET" });
        const summary =
          typeof data?.plan?.summary === "string"
            ? data.plan.summary
            : "Today's plan is prepared.";
        setMessages((current) => [...current, { role: "assistant", content: summary }]);
        pushActionReceipt({
          actionType: "prepare_today",
          detail: "Daily plan refreshed and opened.",
          title: "Today prepared",
          tone: "success",
        });
        router.push("/companion?focus=autopilot");
        return;
      }

      if (intent.type === "simplify_plan") {
        const data = await fetchJson("/api/agent/chat", {
          body: JSON.stringify({
            history: messages.slice(-6),
            question:
              "Simplify today's plan to the two highest-leverage actions and explain why.",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              typeof data.answer === "string"
                ? data.answer
                : "I simplified today's plan and kept the highest-leverage actions.",
          },
        ]);
        pushActionReceipt({
          actionType: "simplify_plan",
          detail: "Your plan was reduced to the highest-leverage actions.",
          title: "Plan simplified",
          tone: "success",
        });
        router.push("/companion?focus=autopilot");
        return;
      }

      if (intent.type === "sync_oura") {
        const data = await fetchJson("/api/wearables/oura/sync", { method: "POST" });
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: `Oura synced. I imported ${Number(data.inserted || 0)} new signal${Number(data.inserted || 0) === 1 ? "" : "s"} from ${data.startDate || "the sync window"} to ${data.endDate || "today"}.`,
          },
        ]);
        pushActionReceipt({
          actionType: "sync_oura",
          detail: `${Number(data.inserted || 0)} signal${Number(data.inserted || 0) === 1 ? "" : "s"} imported from Oura.`,
          title: "Oura synced",
          tone: "success",
        });
        router.push("/data-sources");
        return;
      }

      if (intent.type === "open_oura") {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: "Opening Oura connection and source intelligence.",
          },
        ]);
        pushActionReceipt({
          actionType: "open_oura",
          detail: "Wearable sources opened.",
          title: "Oura source",
          tone: "info",
        });
        router.push("/data-sources");
        return;
      }

      if (intent.type === "generate_report") {
        const data = await fetchJson("/api/longevity/report", { method: "POST" });
        const primaryGoal =
          typeof data?.report?.primary_goal === "string"
            ? data.report.primary_goal
            : "Your new longevity report is ready.";
        setMessages((current) => [
          ...current,
          { role: "assistant", content: `Report generated. ${primaryGoal}` },
        ]);
        pushActionReceipt({
          actionType: "generate_report",
          detail: "Longevity report generated and opened.",
          title: "Report ready",
          tone: "success",
        });
        router.push("/report");
        return;
      }

      if (intent.type === "create_physician_share") {
        const data = await fetchJson("/api/physician-share-links", {
          body: JSON.stringify({
            expiresInDays: intent.expiresInDays || 14,
            includedSections: intent.includedSections,
            recipientEmail: intent.recipientEmail,
            recipientLabel: intent.recipientLabel || "Physician",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const link = data.link;
        const url =
          typeof link?.url === "string"
            ? `${window.location.origin}${link.url}${link.accessCode ? `?code=${encodeURIComponent(link.accessCode)}` : ""}`
            : "Open Physician Export to copy the share link.";
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: `Secure physician link created. ${url}`,
          },
        ]);
        pushActionReceipt({
          actionType: "create_physician_share",
          detail: "A 14-day physician share link was created.",
          title: "Secure link created",
          tone: "success",
        });
        router.push("/physician-export");
        return;
      }

      if (intent.type === "manage_care_network") {
        if (intent.email) {
          const data = await fetchJson("/api/care-network/invitations", {
            body: JSON.stringify({
              expiresInDays: intent.expiresInDays || 14,
              memberEmail: intent.email,
              memberName: intent.memberName,
              permissions: intent.permissions,
              role: intent.role || "physician",
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const invitation = data.invitation;
          const url =
            typeof invitation?.url === "string"
              ? `${window.location.origin}${invitation.url}${invitation.accessCode ? `?code=${encodeURIComponent(invitation.accessCode)}` : ""}`
              : "Open Care Network to copy the invite.";
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: `Care network invite created for ${intent.email}. ${url}`,
            },
          ]);
          pushActionReceipt({
            actionType: "create_care_invite",
            detail: `${intent.email} was invited as ${intent.role || "physician"}.`,
            title: "Invite created",
            tone: "success",
          });
        } else {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content:
                "Opening Care Network. Tell me an email address next time and I can create the invite directly.",
            },
          ]);
          pushActionReceipt({
            actionType: "open_care_network",
            detail: "Care Network opened for invites and permissions.",
            title: "Care Network",
            tone: "info",
          });
        }
        router.push("/network");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "I could not complete that action right now.";
      setMessages((current) => [...current, { role: "assistant", content: message }]);
      pushActionReceipt({
        actionType: "action_error",
        detail: message,
        title: "Action paused",
        tone: "caution",
      });
      if (/unauthorized|sign in/i.test(message)) router.push("/login?mode=signin");
    }
  }

  async function openBillingPortal(targetPlan: PlanId) {
    const response = await fetch("/api/stripe/customer-portal", {
      body: JSON.stringify({ plan: targetPlan }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 404) {
      await openCheckout(targetPlan);
      return;
    }

    if (!response.ok || typeof data.url !== "string") {
      throw new Error(
        typeof data.error === "string" ? data.error : "Could not open billing management."
      );
    }

    stopRealtimeVoice();
    window.location.assign(data.url);
  }

  async function openCheckout(targetPlan: PlanId) {
    const response = await fetch("/api/stripe/checkout", {
      body: JSON.stringify({ plan: targetPlan }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      router.push("/login?mode=signup");
      return;
    }

    if (!response.ok || typeof data.url !== "string") {
      throw new Error(
        typeof data.error === "string" ? data.error : "Could not start checkout."
      );
    }

    stopRealtimeVoice();
    window.location.assign(data.url);
  }

  return (
    <div
      className={`aeon-orb-system fixed inset-x-0 bottom-6 z-40 mx-auto flex w-full max-w-2xl flex-col items-center px-3 ${
        idleDimmed ? "aeon-orb-system-idle" : ""
      }`}
      onFocusCapture={() => setIdleDimmed(false)}
      onPointerEnter={() => setIdleDimmed(false)}
    >
      {!open && !realtimeActive && !realtimeStatus && !speaking && receiptVisible && latestReceipt ? (
        <div
          className={`aeon-orb-receipt aeon-orb-receipt-${latestReceipt.tone} mb-4 max-w-[min(92vw,26rem)] rounded-full px-4 py-2`}
        >
          <span className="aeon-orb-receipt-dot" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-white/78">{latestReceipt.title}</span>
            <span className="block truncate text-xs text-white/42">{latestReceipt.detail}</span>
          </span>
        </div>
      ) : null}

      {!open && (realtimeStatus || realtimeActive || speaking) ? (
        <div className="aeon-orb-live-pill mb-4 inline-flex max-w-[min(92vw,28rem)] items-center gap-3 rounded-full px-4 py-2 text-sm text-white/72">
          <span
            className={`size-2 rounded-full ${
              speaking ? "bg-[#dabc73]" : realtimeActive ? "bg-emerald-300" : "bg-white/35"
            }`}
          />
          <span className="truncate">
            {speaking ? "Aeonvera is answering." : realtimeStatus || "Aeonvera is listening."}
          </span>
        </div>
      ) : null}

      {open ? (
        <section className="aeon-orb-panel mb-4 max-h-[min(72vh,34rem)] w-full max-w-2xl overflow-y-auto rounded-lg p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
            <div>
              <p className="micro-label">Aeonvera Intelligence</p>
              <h2 className="mt-2 text-2xl font-light text-white">Ask or adjust.</h2>
            </div>
            <button
              type="button"
              onClick={closeOrb}
              className="inline-flex size-9 items-center justify-center rounded-md border border-white/[0.08] text-white/52 transition hover:text-white"
              aria-label="Close Aeonvera command"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mb-4 grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.035] p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm text-white/72">Live voice: {selectedVoiceOption.label}</p>
              <p className="mt-1 text-xs leading-5 text-white/42">{selectedVoiceOption.tone}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/42">
              Voice
              <select
                value={selectedVoice}
                onChange={(event) => handleVoiceChange(event.target.value)}
                className="h-9 rounded-md border border-white/[0.1] bg-black/45 px-3 text-sm text-white/72 outline-none transition focus:border-[#dabc73]/45"
                aria-label="Choose Aeonvera voice"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="max-h-44 space-y-3 overflow-y-auto pr-1">
            {messages.slice(-3).map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                className={`rounded-lg border px-3 py-2 text-sm leading-6 ${
                  message.role === "assistant"
                    ? "border-[#dabc73]/16 bg-[#dabc73]/[0.045] text-white/68"
                    : "ml-auto max-w-[86%] border-white/[0.08] bg-white/[0.045] text-white/76"
                }`}
              >
                {message.content}
              </div>
            ))}
            {thinking ? (
              <div className="inline-flex rounded-lg border border-[#dabc73]/16 bg-[#dabc73]/[0.045] px-3 py-2 text-sm text-[#dabc73]/72">
                Aeonvera is reading the signal.
              </div>
            ) : null}
            {realtimeStatus ? (
              <div className="inline-flex rounded-lg border border-emerald-300/14 bg-emerald-300/[0.06] px-3 py-2 text-sm text-emerald-100/68">
                {realtimeStatus}
              </div>
            ) : null}
          </div>

          {actionReceipts.length ? (
            <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.028] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/36">
                  Recent actions
                </p>
                <span className="text-xs text-white/30">This session</span>
              </div>
              <div className="mt-3 grid gap-2">
                {actionReceipts.slice(0, 4).map((receipt) => (
                  <div
                    key={receipt.id}
                    className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <span
                      className={`mt-1 size-1.5 rounded-full ${
                        receipt.tone === "success"
                          ? "bg-emerald-300"
                          : receipt.tone === "caution"
                            ? "bg-[#dabc73]"
                            : "bg-white/36"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white/70">
                        {receipt.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-white/38">
                        {receipt.detail}
                      </span>
                    </span>
                    <span className="pt-0.5 text-xs text-white/24">
                      {formatReceiptTime(receipt.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void submitCommand(prompt)}
                className="rounded-md border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/52 transition hover:border-[#dabc73]/22 hover:text-white/78"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCommand(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md border border-white/[0.08] bg-black/25 px-3 text-sm text-white/76 outline-none placeholder:text-white/24 focus:border-[#dabc73]/45"
              placeholder={
                realtimeActive ? "Live voice is open..." : "Ask or command Aeonvera..."
              }
            />
            <button
              type="button"
              onClick={() =>
                realtimeActive ? stopRealtimeVoice() : void startRealtimeVoice()
              }
              className={`inline-flex size-11 items-center justify-center rounded-md border transition ${
                realtimeActive
                  ? "border-[#dabc73]/45 bg-[#dabc73]/[0.12] text-[#dabc73]"
                  : "border-white/[0.08] bg-white/[0.035] text-white/60 hover:text-white"
              }`}
              aria-label={realtimeActive ? "End live voice" : "Start live voice"}
              disabled={thinking}
            >
              {realtimeActive ? <PhoneOff size={17} /> : <Mic size={17} />}
            </button>
            <button
              type="submit"
              className="premium-action inline-flex size-11 items-center justify-center rounded-md"
              disabled={thinking}
              aria-label="Send command"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      ) : null}

      <div className="flex items-end justify-center">
        <button
          type="button"
          onClick={() => {
            if (open && !realtimeActive) {
              closeOrb();
            } else if (realtimeActive) {
              stopRealtimeVoice();
            } else {
              void startRealtimeVoice();
            }
          }}
          className={`aeon-command-orb ${open ? "aeon-command-orb-open" : ""} ${
            realtimeActive ? "aeon-command-orb-listening" : ""
          } ${speaking ? "aeon-command-orb-speaking" : ""}`}
          aria-label={realtimeActive ? "Stop Aeonvera voice" : "Talk to Aeonvera"}
        >
          <span className="aeon-command-orb-field" aria-hidden="true">
            <span className="aeon-command-orb-orbit aeon-command-orb-orbit-a" />
            <span className="aeon-command-orb-orbit aeon-command-orb-orbit-b" />
            <span className="aeon-command-orb-orbit aeon-command-orb-orbit-c" />
            <span className="aeon-command-orb-ribbon aeon-command-orb-ribbon-a" />
            <span className="aeon-command-orb-ribbon aeon-command-orb-ribbon-b" />
            <span className="aeon-command-orb-particle aeon-command-orb-particle-a" />
            <span className="aeon-command-orb-particle aeon-command-orb-particle-b" />
            <span className="aeon-command-orb-particle aeon-command-orb-particle-c" />
            <span className="aeon-command-orb-particle aeon-command-orb-particle-d" />
          </span>
          <span className="aeon-command-orb-core" aria-hidden="true">
            <span className="aeon-command-orb-plasma" />
            <span className="aeon-command-orb-wave">
              <span />
              <span />
              <span />
              <span />
            </span>
          </span>
          <span className="sr-only">
            {realtimeActive ? "Aeonvera voice is active" : "Aeonvera voice is ready"}
          </span>
        </button>
      </div>
    </div>
  );
}

function asVoiceId(value: string): VoiceId {
  return VOICE_OPTIONS.some((voice) => voice.id === value) ? (value as VoiceId) : DEFAULT_VOICE;
}

function getSavedVoice(): VoiceId {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  return asVoiceId(window.localStorage.getItem("aeonvera.voice") || DEFAULT_VOICE);
}

function parseRealtimeEvent(rawEvent: string): RealtimeEvent | null {
  try {
    return JSON.parse(rawEvent) as RealtimeEvent;
  } catch {
    return null;
  }
}

function readRealtimeError(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    return parsed.error || "OpenAI realtime voice session could not start.";
  } catch {
    return body || "OpenAI realtime voice session could not start.";
  }
}

function formatReceiptTime(createdAt: number) {
  const secondsAgo = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (secondsAgo < 10) return "now";
  if (secondsAgo < 60) return `${secondsAgo}s`;

  const minutesAgo = Math.floor(secondsAgo / 60);
  return minutesAgo < 60 ? `${minutesAgo}m` : "earlier";
}

async function persistActionReceipt(receipt: ActionReceipt) {
  await fetch("/api/agent/activity", {
    body: JSON.stringify({
      actionType: receipt.actionType,
      detail: receipt.detail,
      title: receipt.title,
      tone: receipt.tone,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

function mapActivityEventToReceipt(event: ActivityEventRow): ActionReceipt[] {
  const actionType = asActionType(event.action_type);
  const tone = asReceiptTone(event.tone);
  const title = typeof event.title === "string" ? event.title : "";
  const detail = typeof event.detail === "string" ? event.detail : "";
  const id = typeof event.id === "string" ? event.id : "";
  const createdAt =
    typeof event.created_at === "string" ? Date.parse(event.created_at) : Number.NaN;

  if (!actionType || !title || !detail || !id || Number.isNaN(createdAt)) return [];

  return [
    {
      actionType,
      createdAt,
      detail,
      id,
      title,
      tone,
    },
  ];
}

function asActionType(value: unknown): ActionType | null {
  const actionTypes: ActionType[] = [
    "action_error",
    "billing",
    "checkout",
    "create_care_invite",
    "create_physician_share",
    "generate_report",
    "navigation",
    "open_care_network",
    "open_oura",
    "plan_change",
    "plan_options",
    "prepare_today",
    "simplify_plan",
    "sync_oura",
  ];

  return typeof value === "string" && actionTypes.includes(value as ActionType)
    ? (value as ActionType)
    : null;
}

function asReceiptTone(value: unknown): ActionReceipt["tone"] {
  return value === "success" || value === "caution" || value === "info" ? value : "info";
}

function isPlannerAction(value: unknown): value is PlannerAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<PlannerAction>;

  if (action.kind === "control") {
    return isControlIntent(action.intent);
  }

  if (action.kind === "plan") {
    return isPlanIntent(action.intent);
  }

  if (action.kind === "navigation") {
    return (
      typeof action.href === "string" &&
      action.href.startsWith("/") &&
      typeof action.label === "string"
    );
  }

  if (action.kind === "answer") {
    return typeof action.text === "string";
  }

  return false;
}

function isControlIntent(value: unknown): value is ControlIntent {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "create_physician_share" ||
    type === "generate_report" ||
    type === "manage_care_network" ||
    type === "open_oura" ||
    type === "prepare_today" ||
    type === "simplify_plan" ||
    type === "sync_oura"
  );
}

function isPlanIntent(value: unknown): value is PlanIntent {
  if (!value || typeof value !== "object") return false;
  const intent = value as { direction?: unknown; targetPlan?: unknown };
  return (
    (intent.direction === "change" ||
      intent.direction === "downgrade" ||
      intent.direction === "upgrade") &&
    (intent.targetPlan === null || asPlanId(intent.targetPlan) !== null)
  );
}

function toPendingRealtimeAction(action: Exclude<PlannerAction, { kind: "answer" }>): PendingRealtimeAction {
  if (action.kind === "control") return { intent: action.intent, type: "control" };
  if (action.kind === "plan") return { intent: action.intent, type: "plan" };
  return {
    href: action.href,
    label: action.label,
    type: "navigation",
  };
}

type PlanIntent = {
  direction: "change" | "downgrade" | "upgrade";
  targetPlan: PlanId | null;
};

function resolvePlanIntent(question: string): PlanIntent | null {
  const text = question.toLowerCase();
  const targetPlan = extractPlanTarget(text);
  const hasBillingIntent =
    /\b(upgrade|downgrade|change|switch|move|subscribe|subscription|billing|membership|plan)\b/.test(text);

  if (!hasBillingIntent && !targetPlan) return null;

  if (/\b(downgrade|lower|cheaper|reduce)\b/.test(text)) {
    return { direction: "downgrade", targetPlan };
  }

  if (/\b(upgrade|higher|sovereign|elite|executive|unlock)\b/.test(text)) {
    return { direction: "upgrade", targetPlan };
  }

  if (targetPlan) {
    return { direction: "change", targetPlan };
  }

  return null;
}

function resolveControlIntent(question: string): ControlIntent | null {
  const text = question.toLowerCase();

  if (/\b(prepare|build|create|make|refresh)\b.*\b(today|daily|day)\b.*\b(plan|schedule)\b/.test(text)) {
    return { type: "prepare_today" };
  }

  if (/\b(simplify|lighter|less|too much|overwhelming|reduce)\b.*\b(plan|protocol|today|actions?)\b/.test(text)) {
    return { type: "simplify_plan" };
  }

  if (/\b(oura)\b.*\b(sync|refresh|update|pull|import)\b/.test(text)) {
    return { type: "sync_oura" };
  }

  if (/\b(oura)\b.*\b(connect|open|setup|set up)\b/.test(text)) {
    return { type: "open_oura" };
  }

  if (/\b(generate|create|build|make|refresh)\b.*\b(report|longevity report|health report)\b/.test(text)) {
    return { type: "generate_report" };
  }

  if (/\b(physician|doctor|clinician|medical)\b.*\b(share|link|export|send|create)\b/.test(text)) {
    return { type: "create_physician_share" };
  }

  if (/\b(care network|invite|family|coach|physician|doctor)\b.*\b(invite|network|share|access)\b/.test(text)) {
    return {
      email: extractEmail(question),
      role: extractCareRole(text),
      type: "manage_care_network",
    };
  }

  return null;
}

function requiresConfirmation(intent: ControlIntent): intent is ConfirmationIntent {
  return intent.type === "create_physician_share" || (intent.type === "manage_care_network" && Boolean(intent.email));
}

function confirmationPromptForIntent(intent: ConfirmationIntent) {
  if (intent.type === "create_physician_share") {
    const sections = intent.includedSections?.length
      ? ` with ${intent.includedSections.map((section) => section.replace(/_/g, " ")).join(", ")}`
      : "";
    const recipient = intent.recipientEmail
      ? ` for ${intent.recipientEmail}`
      : intent.recipientLabel
        ? ` for ${intent.recipientLabel}`
        : "";
    return `I can create a secure physician share link${recipient}${sections}. It expires in ${intent.expiresInDays || 14} days and includes an access code. Should I create it?`;
  }

  if (intent.email) {
    const permissions = intent.permissions?.length
      ? ` with ${intent.permissions.map((permission) => permission.replace(/_/g, " ")).join(", ")}`
      : "";
    return `I can invite ${intent.email} as a ${intent.role || "physician"}${permissions} using a secure ${intent.expiresInDays || 14}-day access link. Should I create the invite?`;
  }

  return "I can open Care Network now. If you want me to create an invite directly, include the person's email address.";
}

function isConfirmationYes(value: string) {
  return /\b(yes|yeah|yep|confirm|approve|do it|go ahead|create it|send it)\b/i.test(value);
}

function isConfirmationNo(value: string) {
  return /\b(no|nope|cancel|stop|don't|do not|not now)\b/i.test(value);
}

function extractPlanTarget(text: string): PlanId | null {
  if (/\bsovereign|soverign|soverigne|executive\b/.test(text)) return "sovereign";
  if (/\belite|optimization\b/.test(text)) return "elite";
  if (/\bcore|basic|starter|baseline\b/.test(text)) return "core";
  return null;
}

function inferPlanTarget(direction: PlanIntent["direction"], currentPlan: PlanId | null) {
  if (!currentPlan) return direction === "downgrade" ? null : "core";

  const index = PLAN_ORDER.indexOf(currentPlan);
  if (direction === "downgrade") return PLAN_ORDER[Math.max(0, index - 1)] || null;
  if (direction === "upgrade") return PLAN_ORDER[Math.min(PLAN_ORDER.length - 1, index + 1)] || null;
  return null;
}

function asPlanId(value: unknown): PlanId | null {
  return value === "core" || value === "elite" || value === "sovereign" ? value : null;
}

async function readMicrophonePermission() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const permission = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return permission.state;
  } catch {
    return "unknown";
  }
}

function isActiveSubscription(value: unknown) {
  return value === "active" || value === "trialing" || value === "past_due";
}

function extractCareRole(text: string): CareRole | undefined {
  if (/\b(coach|trainer|accountability)\b/.test(text)) return "coach";
  if (/\b(family|partner|spouse|wife|husband|parent|sibling)\b/.test(text)) return "family";
  if (/\b(doctor|physician|clinician|medical)\b/.test(text)) return "physician";
  return undefined;
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
}

async function fetchJson(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : response.status === 401
          ? "Sign in to continue."
          : "Aeonvera could not complete that action.";
    throw new Error(message);
  }

  return data;
}

function resolveNavigationIntent(question: string) {
  if (!/\b(open|show|take me|go to|navigate|bring me|where is|find|upgrade|downgrade)\b/i.test(question)) {
    return null;
  }

  return NAVIGATION_INTENTS.find((intent) => intent.pattern.test(question)) || null;
}
