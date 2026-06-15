"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Keyboard, Mic, PhoneOff, Send, X } from "lucide-react";

type CommandMessage = {
  content: string;
  role: "assistant" | "user";
};

type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];
type PlanId = "core" | "elite" | "sovereign";

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

  const hidden = useMemo(
    () => HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(route)),
    [pathname]
  );

  const selectedVoiceOption = useMemo(
    () => VOICE_OPTIONS.find((voice) => voice.id === selectedVoice) || VOICE_OPTIONS[0],
    [selectedVoice]
  );

  const stopRealtimeVoice = useCallback((updateState = true) => {
    realtimePeerRef.current?.close();
    realtimePeerRef.current = null;

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

  if (hidden) return null;

  async function submitCommand(command: string) {
    const question = command.trim();
    if (!question || thinking) return;

    setOpen(true);
    setInput("");
    setThinking(true);
    setMessages((current) => [...current, { role: "user", content: question }]);

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
      channel.onopen = () => setRealtimeStatus("Speak naturally. Aeonvera is listening.");
      channel.onmessage = (event) => handleRealtimeEvent(event.data);

      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      await peer.setLocalDescription(offer);

      const response = await fetch(
        `/api/agent/realtime?voice=${encodeURIComponent(selectedVoice)}`,
        {
          body: offer.sdp || "",
          credentials: "include",
          headers: { "Content-Type": "application/sdp" },
          method: "POST",
        }
      );
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
      setOpen(true);
    }
  }

  function handleRealtimeEvent(rawEvent: string) {
    const event = parseRealtimeEvent(rawEvent);
    if (!event?.type) return;

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = event.transcript?.trim();
      if (transcript) {
        setMessages((current) => [...current, { role: "user", content: transcript }]);
        const planIntent = resolvePlanIntent(transcript);
        const navigation = resolveNavigationIntent(transcript);
        if (planIntent) {
          void handlePlanIntent(planIntent);
        } else if (navigation) {
          router.push(navigation.href);
        }
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

  function closeOrb() {
    stopRealtimeVoice();
    setOpen(false);
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
        await openBillingPortal(targetPlan);
      } else {
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
    <div className="aeon-orb-system fixed inset-x-0 bottom-5 z-40 mx-auto flex w-full max-w-3xl flex-col items-center px-4">
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
        <section className="aeon-orb-panel mb-4 w-full max-w-2xl rounded-lg p-4 md:p-5">
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

      <div className="flex items-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="aeon-orb-text-toggle inline-flex size-11 items-center justify-center rounded-full"
          aria-label="Open Aeonvera text and voice settings"
        >
          <Keyboard size={17} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (realtimeActive) {
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

function isActiveSubscription(value: unknown) {
  return value === "active" || value === "trialing" || value === "past_due";
}

function resolveNavigationIntent(question: string) {
  if (!/\b(open|show|take me|go to|navigate|bring me|where is|find|upgrade|downgrade)\b/i.test(question)) {
    return null;
  }

  return NAVIGATION_INTENTS.find((intent) => intent.pattern.test(question)) || null;
}
