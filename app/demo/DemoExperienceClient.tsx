"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const QUESTIONS = [
  {
    id: "priority",
    label: "What should I fix first?",
    answer:
      "Start with metabolic resilience, not supplement complexity. Your HbA1c, fasting glucose, triglycerides, late dinners, and inconsistent Zone 2 all point to the same lever: stabilize glucose and aerobic base for 14 days.",
    why: [
      "HbA1c is drifting above the ideal longevity range.",
      "Recovery improves after earlier sleep, so intensity should stay moderate.",
      "Zone 2 adherence is the weakest controllable behavior in the profile.",
    ],
    action: "Schedule two Zone 2 sessions and a 10-minute walk after dinner on four nights.",
  },
  {
    id: "changed",
    label: "What changed this week?",
    answer:
      "Sleep duration improved by 44 minutes and resting heart rate dropped 4 bpm, but glucose is only slightly better. The plan is working for recovery; the metabolic signal needs another week of consistent evening behavior.",
    why: [
      "HRV and resting heart rate moved in the right direction together.",
      "Fasting glucose changed from 101 to 98, which is promising but not durable yet.",
      "Strength stayed consistent without suppressing recovery.",
    ],
    action: "Keep training volume steady and add the post-meal walk before changing anything else.",
  },
  {
    id: "doctor",
    label: "What should I ask my clinician?",
    answer:
      "Ask whether the glucose trend, triglycerides, family history, and ApoB should be reviewed together. The appointment should focus on pattern and risk context, not one isolated lab.",
    why: [
      "The metabolic and cardiovascular markers are not severe, but they point in the same direction.",
      "Family history changes how aggressively a clinician may want to monitor lipids.",
      "Aeonvera should help you prepare questions, not replace medical judgment.",
    ],
    action: "Export a one-page packet with recent labs, trends, current protocol, and top questions.",
  },
] as const;

const SCENARIOS = [
  {
    id: "sleep",
    label: "Protect sleep",
    delta: "-0.4 yrs",
    detail: "Earlier sleep anchor plus lower evening glucose variability.",
  },
  {
    id: "zone2",
    label: "Add Zone 2",
    delta: "-0.6 yrs",
    detail: "Two weekly sessions improve aerobic base and metabolic flexibility.",
  },
  {
    id: "stack",
    label: "Do both",
    delta: "-1.1 yrs",
    detail: "Best projected gain because recovery and glucose move together.",
  },
] as const;

const WEEK = [
  ["Mon", "Zone 2, 42 min", "Build aerobic base without stressing recovery."],
  ["Tue", "Sleep anchor", "Lights out at 10:30 because HRV follows timing."],
  ["Wed", "Strength, lower volume", "Keep muscle stimulus while recovery catches up."],
  ["Fri", "Post-meal walk", "Target glucose with almost no extra complexity."],
];

export default function DemoExperienceClient() {
  const [questionId, setQuestionId] = useState<(typeof QUESTIONS)[number]["id"]>("priority");
  const [scenarioId, setScenarioId] = useState<(typeof SCENARIOS)[number]["id"]>("stack");

  const selectedQuestion = useMemo(
    () => QUESTIONS.find((question) => question.id === questionId) || QUESTIONS[0],
    [questionId]
  );
  const selectedScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === scenarioId) || SCENARIOS[2],
    [scenarioId]
  );

  return (
    <div className="space-y-4">
      <section className="aeon-demo-live-grid">
        <div className="aeon-demo-live-panel aeon-demo-live-panel-dark">
          <div className="aeon-demo-panel-topline">
            <span>Interactive sample</span>
            <ShieldCheck size={16} />
          </div>
          <h2>Ask the sample profile what matters now.</h2>
          <p>
            This is the moment the product has to earn trust: it should read the
            user&apos;s context, explain the pattern, and choose the next useful
            move.
          </p>
          <div className="aeon-demo-question-row">
            {QUESTIONS.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => setQuestionId(question.id)}
                className={question.id === questionId ? "is-active" : ""}
              >
                {question.label}
              </button>
            ))}
          </div>
        </div>

        <div className="aeon-demo-live-panel">
          <div className="aeon-demo-answer-head">
            <MessageSquareText size={20} />
            <span>Aeonvera answer</span>
          </div>
          <p className="aeon-demo-answer">{selectedQuestion.answer}</p>
          <div className="aeon-demo-reason-list">
            {selectedQuestion.why.map((reason) => (
              <div key={reason}>
                <CheckCircle2 size={16} />
                <span>{reason}</span>
              </div>
            ))}
          </div>
          <div className="aeon-demo-next-action">
            <Sparkles size={17} />
            <span>{selectedQuestion.action}</span>
          </div>
        </div>
      </section>

      <section className="aeon-demo-live-grid aeon-demo-live-grid-flipped">
        <div className="aeon-demo-live-panel">
          <div className="aeon-demo-panel-topline">
            <span>Future scenario</span>
            <Activity size={16} />
          </div>
          <h2>Show the tradeoff before the user commits.</h2>
          <p>
            A smart person can read protocols for free. The paid value is
            seeing which change is most likely to matter for their current
            pattern.
          </p>
          <div className="aeon-demo-scenario-row">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setScenarioId(scenario.id)}
                className={scenario.id === scenarioId ? "is-active" : ""}
              >
                <span>{scenario.label}</span>
                <strong>{scenario.delta}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="aeon-demo-live-panel aeon-demo-live-panel-dark">
          <div className="aeon-demo-projection">
            <div>
              <span>Projected biological-age shift</span>
              <strong>{selectedScenario.delta}</strong>
            </div>
            <TrendingDown size={28} />
          </div>
          <p>{selectedScenario.detail}</p>
          <div className="aeon-demo-metric-row">
            <div>
              <span>Sleep</span>
              <strong>+44m</strong>
              <TrendingUp size={16} />
            </div>
            <div>
              <span>Resting HR</span>
              <strong>-4 bpm</strong>
              <TrendingDown size={16} />
            </div>
            <div>
              <span>Glucose</span>
              <strong>101 to 98</strong>
              <Activity size={16} />
            </div>
          </div>
        </div>
      </section>

      <section className="aeon-demo-live-grid">
        <div className="aeon-demo-live-panel">
          <div className="aeon-demo-panel-topline">
            <span>Execution layer</span>
            <CalendarCheck size={16} />
          </div>
          <h2>A plan someone can actually follow this week.</h2>
          <div className="aeon-demo-week">
            {WEEK.map(([day, task, reason]) => (
              <div key={day}>
                <strong>{day}</strong>
                <span>{task}</span>
                <p>{reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="aeon-demo-live-panel">
          <div className="aeon-demo-panel-topline">
            <span>Clinical handoff</span>
            <Stethoscope size={16} />
          </div>
          <h2>Make the doctor conversation less chaotic.</h2>
          <div className="aeon-demo-packet">
            {[
              "One-page summary of labs, wearables, and protocol changes",
              "Top questions: glucose trend, ApoB context, family history",
              "Risk flags marked as informational, not diagnosis",
              "Share link with access code and expiry",
            ].map((item) => (
              <div key={item}>
                <FileText size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <a className="aeon-demo-inline-link" href="/physician-export">
            See export workflow <ArrowRight size={15} />
          </a>
        </div>
      </section>
    </div>
  );
}
