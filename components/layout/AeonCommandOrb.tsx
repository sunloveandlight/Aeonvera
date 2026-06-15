"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, Send, Sparkles, Volume2, X } from "lucide-react";

type CommandMessage = {
  content: string;
  role: "assistant" | "user";
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: {
    readonly transcript: string;
  };
};

type SpeechRecognitionEventLike = Event & {
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CommandMessage[]>([
    {
      role: "assistant",
      content:
        "I can answer, guide, and move through Aeonvera with you. Ask naturally.",
    },
  ]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voiceAvailable] = useState(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  });
  const [speaking, setSpeaking] = useState(false);

  const hidden = useMemo(
    () => HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(route)),
    [pathname]
  );

  const stopListening = useCallback((updateState = true) => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (updateState) setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (hidden) return null;

  async function submitCommand(command: string) {
    const question = command.trim();
    if (!question || thinking) return;

    setOpen(true);
    setInput("");
    setThinking(true);
    setMessages((current) => [...current, { role: "user", content: question }]);

    const navigation = resolveNavigationIntent(question);
    if (navigation) {
      const answer = `Opening ${navigation.label}. I will stay here if you want to keep talking.`;
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      speak(answer);
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
      speak(answer);
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

  function toggleListening() {
    if (listening) {
      stopListening();
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Voice is not available in this browser yet. You can type to me here.",
        },
      ]);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || "";
        if (result?.isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }

      const next = finalTranscript || interimTranscript;
      if (next) setInput(next.trim());

      if (finalTranscript.trim()) {
        stopListening();
        void submitCommand(finalTranscript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setOpen(true);
    setListening(true);
  }

  function closeOrb() {
    stopListening();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setOpen(false);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 700));
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="aeon-orb-system fixed inset-x-0 bottom-5 z-40 mx-auto flex w-full max-w-3xl flex-col items-center px-4">
      {open ? (
        <section className="aeon-orb-panel mb-4 w-full rounded-lg p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
            <div>
              <p className="micro-label">Aeonvera Intelligence</p>
              <h2 className="mt-2 text-2xl font-light text-white">Command the system.</h2>
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

          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {messages.slice(-6).map((message, index) => (
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
              placeholder={listening ? "Listening..." : "Ask or command Aeonvera..."}
            />
            <button
              type="button"
              onClick={toggleListening}
              className={`inline-flex size-11 items-center justify-center rounded-md border transition ${
                listening
                  ? "border-[#dabc73]/45 bg-[#dabc73]/[0.12] text-[#dabc73]"
                  : "border-white/[0.08] bg-white/[0.035] text-white/60 hover:text-white"
              }`}
              aria-label={listening ? "Stop listening" : "Speak to Aeonvera"}
              disabled={!voiceAvailable && thinking}
            >
              <Mic size={17} />
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

      <button
        type="button"
        onClick={() => {
          if (open) {
            closeOrb();
          } else {
            setOpen(true);
          }
        }}
        className={`aeon-command-orb ${open ? "aeon-command-orb-open" : ""} ${
          listening ? "aeon-command-orb-listening" : ""
        } ${speaking ? "aeon-command-orb-speaking" : ""}`}
        aria-label="Open Aeonvera intelligence"
      >
        <span className="aeon-command-orb-core">
          {speaking ? <Volume2 size={22} /> : <Sparkles size={22} />}
        </span>
      </button>
    </div>
  );
}

function resolveNavigationIntent(question: string) {
  if (!/\b(open|show|take me|go to|navigate|bring me|where is|find|upgrade|downgrade)\b/i.test(question)) {
    return null;
  }

  return NAVIGATION_INTENTS.find((intent) => intent.pattern.test(question)) || null;
}
