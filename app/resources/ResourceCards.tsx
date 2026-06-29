import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  getCategory,
  resourceArticles,
  resourceCategories,
  type BiomarkerEntry,
  type ResourceArticle,
  type ResourceCategory,
} from "@/lib/resources/content";

export function CategoryPill({ category }: { category: ResourceCategory }) {
  return (
    <Link className="resource-pill" href={`/resources/categories/${category.slug}`}>
      {category.title}
    </Link>
  );
}

export function ArticleCard({
  article,
  featured = false,
}: {
  article: ResourceArticle;
  featured?: boolean;
}) {
  const category = getCategory(article.category);

  return (
    <article className={featured ? "resource-article-card is-featured" : "resource-article-card"}>
      <div>
        {category ? <p className="resource-card-kicker">{category.title}</p> : null}
        <h2>{article.title}</h2>
        <p>{article.description}</p>
      </div>
      <div className="resource-card-meta">
        <span>{article.readingTime}</span>
        <span>{formatDate(article.publishedAt)}</span>
      </div>
      <Link className="resource-card-link" href={`/resources/${article.slug}`}>
        Read article <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export function CategoryGrid({ categories = resourceCategories }: { categories?: ResourceCategory[] }) {
  return (
    <div className="resource-category-grid">
      {categories.map((category) => (
        <Link className="resource-category-tile" href={`/resources/categories/${category.slug}`} key={category.slug}>
          <span>{category.title}</span>
          <p>{category.description}</p>
        </Link>
      ))}
    </div>
  );
}

export function ArticleList({ articles = resourceArticles }: { articles?: ResourceArticle[] }) {
  if (articles.length === 0) {
    return (
      <div className="resource-empty">
        <h2>More entries are being prepared.</h2>
        <p>
          This shelf is part of the Aeonvera Longevity Library roadmap. The
          first flagship pieces are live now, with deeper references coming next.
        </p>
      </div>
    );
  }

  return (
    <div className="resource-article-list">
      {articles.map((article) => (
        <ArticleCard article={article} key={article.slug} />
      ))}
    </div>
  );
}

export function BiomarkerPreview({ biomarkers }: { biomarkers: BiomarkerEntry[] }) {
  return (
    <div className="resource-biomarker-grid">
      {biomarkers.map((biomarker) => (
        <Link
          aria-label={`Read the ${biomarker.name} biomarker guide`}
          className="resource-biomarker-card"
          href={biomarker.summary ? `/resources/biomarkers/${biomarker.slug}` : "/resources/biomarkers"}
          key={biomarker.slug}
        >
          <article>
            <p>{biomarker.category}</p>
            <h2>{biomarker.name}</h2>
            <span>{biomarker.whyItMatters}</span>
            <ul>
              {biomarker.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </article>
        </Link>
      ))}
    </div>
  );
}

export function ResourceSearch({
  defaultValue = "",
  action = "/resources/articles",
}: {
  defaultValue?: string;
  action?: string;
}) {
  return (
    <form action={action} className="resource-search">
      <label className="sr-only" htmlFor="resource-search">
        Search resources
      </label>
      <input
        defaultValue={defaultValue}
        id="resource-search"
        name="q"
        placeholder="Search healthspan, biomarkers, sleep, exercise..."
        type="search"
      />
      <button type="submit">Search</button>
    </form>
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
