import type { Metadata } from "next";

import { ArticleList, ResourceSearch } from "../ResourceCards";
import { resourceArticles } from "@/lib/resources/content";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Browse Aeonvera Longevity Library articles on healthspan, biomarkers, prevention, nutrition, exercise, sleep, research, and AI medicine.",
  alternates: {
    canonical: "/resources/articles",
  },
};

type ArticlesPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const { q = "" } = await searchParams;
  const normalizedQuery = q.trim().toLowerCase();
  const articles = normalizedQuery
    ? resourceArticles.filter((article) => {
        const haystack = [
          article.title,
          article.subtitle,
          article.description,
          ...article.takeaways,
          ...article.strategies.map((strategy) => strategy.title),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : resourceArticles;

  return (
    <main className="resources-page">
      <section className="resources-archive-hero">
        <p className="resources-library-label">Articles</p>
        <h1>Read the Aeonvera Longevity Library.</h1>
        <p>
          Evidence-aware explanations for the behaviors, biomarkers, and systems
          that shape healthspan.
        </p>
        <ResourceSearch defaultValue={q} />
      </section>
      <section className="resources-section">
        <ArticleList articles={articles} />
      </section>
    </main>
  );
}
