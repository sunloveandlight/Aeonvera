import type { Metadata } from "next";

import { ArticleList } from "../ResourceCards";
import { getArticlesByCategory } from "@/lib/resources/content";

export const metadata: Metadata = {
  title: "Beginner's Guides",
  description:
    "Start here for clear Aeonvera beginner's guides to healthspan, biomarkers, longevity habits, and prevention.",
  alternates: {
    canonical: "/resources/guides",
  },
};

export default function GuidesPage() {
  const articles = getArticlesByCategory("beginners-guides");

  return (
    <main className="resources-page">
      <section className="resources-archive-hero">
        <p className="resources-library-label">Beginner&apos;s Guides</p>
        <h1>Start with the principles that compound.</h1>
        <p>
          Plain-language foundations for people beginning longevity work without
          drowning in jargon.
        </p>
      </section>
      <section className="resources-section">
        <ArticleList articles={articles} />
      </section>
    </main>
  );
}
