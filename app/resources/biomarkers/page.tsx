import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BiomarkerPreview } from "../ResourceCards";
import { biomarkerEntries, getArticlesByCategory } from "@/lib/resources/content";

export const metadata: Metadata = {
  title: "Biomarker Database",
  description:
    "Explore Aeonvera biomarker explainers for ApoB, HbA1c, hs-CRP, VO2 max, resting heart rate, HRV, and healthspan signals.",
  alternates: {
    canonical: "/resources/biomarkers",
  },
};

export default function BiomarkersPage() {
  const articles = getArticlesByCategory("biomarker-database");

  return (
    <main className="resources-page">
      <section className="resources-archive-hero">
        <p className="resources-library-label">Biomarker Database</p>
        <h1>Understand the signals before you chase the numbers.</h1>
        <p>
          A growing reference for labs and wearable metrics: what they mean,
          where they are useful, and why trends matter more than isolated readings.
        </p>
      </section>
      <section className="resources-section">
        <BiomarkerPreview biomarkers={biomarkerEntries} />
      </section>
      <section className="resources-band resources-next-band">
        <h2>Biomarkers in context</h2>
        <p>
          The flagship guide explains how biomarkers fit alongside exercise,
          sleep, nutrition, and disease prevention.
        </p>
        <Link href={`/resources/${articles[0]?.slug || "science-of-living-longer-25-evidence-based-strategies"}`} className="resource-inline-link">
          Read the guide <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
