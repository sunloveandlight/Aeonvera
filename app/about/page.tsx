import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import RenewalImage from "@/components/ui/RenewalImage";

export const metadata: Metadata = {
  title: "About",
  description:
    "Aeonvera exists to help you understand your body and guide it toward more years — and more life within them.",
};

const BELIEFS = [
  {
    title: "Your body is already speaking.",
    body: "Every night of sleep, every lab value, every heartbeat is a sentence in a story about how you are aging. We exist to translate it — gently, clearly, and entirely in your service.",
  },
  {
    title: "Aging is not fixed.",
    body: "Most of how you age is written not in your genes but in your days. Small, well-chosen changes compound quietly over years. We help you find the few that matter most.",
  },
  {
    title: "Your data is yours.",
    body: "Health is the most personal thing you own. Aeonvera keeps your story private, and treats the trust you place in us as the foundation of everything we build.",
  },
  {
    title: "Calm is a feature.",
    body: "We will never overwhelm you. Aeonvera keeps the noise out, holds only what matters in view, and moves the next right step quietly into your day.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* HERO */}
      <section className="px-6 pt-32 pb-20 text-center lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-eyebrow">Our mission</p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.04] tracking-tight text-white md:text-7xl">
            Time is not your opponent.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-white/70 md:text-2xl">
            Aeonvera was born from a simple, hopeful belief: that with the right
            understanding, your body can be guided toward more years — and far
            more life within them.
          </p>
        </div>
      </section>

      {/* RENEWAL IMAGES */}
      <section className="px-6 pb-24 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          <RenewalImage
            src="/marketing/rejuvenation-woman.png"
            alt="A woman, renewed"
            caption="Feeling years younger — not by chance, but by understanding."
          />
          <RenewalImage
            src="/marketing/rejuvenation-man.png"
            alt="A man, renewed"
            caption="Vitality is not given back by time. It is reclaimed."
          />
        </div>
      </section>

      {/* MISSION STATEMENT */}
      <section className="border-t border-white/[0.08] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            We are here to help you feel younger in the ways that matter.
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/64">
            Not a number on a chart, but how you wake, how you recover, how
            clearly you think, and how fully you live. Aeonvera draws your labs,
            your wearables, your habits, and your history into one calm,
            intelligent picture — then walks beside you, one considered step at a
            time, toward the longest, brightest version of your life.
          </p>
        </div>
      </section>

      {/* BELIEFS */}
      <section className="border-t border-white/[0.08] px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-eyebrow">What we believe</p>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
              A few quiet convictions.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {BELIEFS.map((belief) => (
              <div key={belief.title} className="premium-surface rounded-2xl p-8">
                <h3 className="text-xl font-semibold tracking-tight text-white">
                  {belief.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-white/64">
                  {belief.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING / INVITATION */}
      <section className="border-t border-white/[0.08] px-6 py-28 text-center lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
            Your longest, best years are still ahead.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/64">
            Wherever you are beginning from, you are welcome here. Let&rsquo;s
            understand your body together — and build the future it is capable
            of.
          </p>
          <Link
            href="/login?mode=signup"
            className="premium-action mt-10 inline-flex items-center justify-center gap-2 text-sm font-medium transition"
          >
            Begin your journey
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
