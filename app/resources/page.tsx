import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Microscope } from "lucide-react";

import {
  ArticleCard,
  BiomarkerPreview,
  CategoryGrid,
  CategoryPill,
  ResourceSearch,
} from "./ResourceCards";
import {
  biomarkerEntries,
  getFeaturedArticle,
  resourceCategories,
} from "@/lib/resources/content";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Explore the Aeonvera Longevity Library: evidence-aware articles, beginner's guides, biomarker explainers, research reviews, and healthspan resources.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "Aeonvera Longevity Library",
    description:
      "Evidence-aware longevity education across healthspan, biomarkers, sleep, exercise, nutrition, disease prevention, and AI medicine.",
    url: "/resources",
    images: [
      {
        url: "/marketing/rejuvenation-woman-top-extended.png",
        width: 1536,
        height: 1024,
        alt: "Aeonvera Longevity Library.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aeonvera Longevity Library",
    description:
      "Evidence-aware longevity education from Aeonvera.",
    images: ["/marketing/rejuvenation-woman-top-extended.png"],
  },
};

export default function ResourcesPage() {
  const featured = getFeaturedArticle();

  return (
    <div className="resources-page">
      <section className="resources-hero">
        <div className="resources-hero-copy">
          <p className="resources-library-label">Aeonvera Longevity Library</p>
          <h1>Learn the science of living longer, then turn it into action.</h1>
          <p>
            Evidence-aware articles, beginner&apos;s guides, biomarker explainers,
            and research reviews for people building a longer, more capable life.
          </p>
          <ResourceSearch action="/resources/articles" />
          <div className="resources-hero-actions">
            <Link href={`/resources/${featured.slug}`} className="premium-action">
              Start with the flagship guide <ArrowRight size={16} />
            </Link>
            <Link href="/resources/biomarkers" className="premium-action-secondary">
              Browse biomarkers
            </Link>
          </div>
        </div>
        <div className="resources-hero-visual" aria-hidden="true">
          <Image
            alt=""
            className="resources-hero-image"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 42vw"
            src="/marketing/rejuvenation-woman-top-extended.png"
          />
          <div className="resources-hero-panel">
            <span><BookOpen size={16} /> Evidence library</span>
            <strong>25 strategies</strong>
            <p>Exercise, sleep, nutrition, prevention, biomarkers, and AI-supported health systems.</p>
          </div>
        </div>
      </section>

      <section className="resources-band">
        <div className="resources-section-heading">
          <p>Featured Article</p>
          <h2>The first pillar in the library.</h2>
        </div>
        <ArticleCard article={featured} featured />
      </section>

      <section className="resources-section">
        <div className="resources-section-heading">
          <p>Categories</p>
          <h2>Built as a library, not a feed.</h2>
        </div>
        <div className="resources-pill-row">
          {resourceCategories.map((category) => (
            <CategoryPill category={category} key={category.slug} />
          ))}
        </div>
        <CategoryGrid />
      </section>

      <section className="resources-split-section">
        <div>
          <div className="resources-section-heading align-left">
            <p>Biomarker Database</p>
            <h2>Signals you can understand before you optimize.</h2>
          </div>
          <p className="resources-section-copy">
            The database starts with core lab and wearable signals, then grows
            into a practical reference for what each marker can and cannot tell you.
          </p>
          <Link href="/resources/biomarkers" className="resource-inline-link">
            Open biomarker database <ArrowRight size={16} />
          </Link>
        </div>
        <BiomarkerPreview biomarkers={biomarkerEntries.slice(0, 3)} />
      </section>

      <section className="resources-band resources-next-band">
        <Microscope aria-hidden size={22} />
        <h2>Next in the library</h2>
        <p>
          Beginner guides, biomarker deep dives, research reviews, and disease
          prevention explainers will expand from this foundation.
        </p>
        <Link href="/resources/articles" className="resource-inline-link">
          View all articles <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
