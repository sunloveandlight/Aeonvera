import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { formatDate } from "../ResourceCards";
import {
  getArticle,
  getCategory,
  resourceArticles,
} from "@/lib/resources/content";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return resourceArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return {
      title: "Resources",
    };
  }

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `/resources/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      url: `/resources/${article.slug}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author],
      images: [
        {
          url: article.heroImage,
          width: 1536,
          height: 1024,
          alt: article.heroAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [article.heroImage],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) notFound();

  const articleUrl = `https://www.aeonvera.com/resources/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: `https://www.aeonvera.com${article.heroImage}`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Organization",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Aeonvera",
      logo: {
        "@type": "ImageObject",
        url: "https://www.aeonvera.com/aeonvera-app-icon.svg",
      },
    },
    mainEntityOfPage: articleUrl,
  };

  return (
    <main className="resources-page article-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <header className="article-hero">
          <div className="article-hero-copy">
            <Link href="/resources" className="resource-inline-link">
              Aeonvera Longevity Library
            </Link>
            <h1>{article.title}</h1>
            <p>{article.subtitle}</p>
            <div className="article-meta-row">
              <span>{article.author}</span>
              <span>{formatDate(article.publishedAt)}</span>
              <span>{article.readingTime}</span>
            </div>
          </div>
          <div className="article-hero-image">
            <Image
              alt={article.heroAlt}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 42vw"
              src={article.heroImage}
            />
          </div>
        </header>

        <div className="article-shell">
          <aside className="article-sidebar" aria-label="Article contents">
            <p>In this guide</p>
            <a href="#summary">Summary</a>
            <a href="#strategies">25 strategies</a>
            <a href="#biomarkers">Biomarkers to track</a>
            <a href="#aeonvera">How Aeonvera helps</a>
            <a href="#references">References</a>
          </aside>

          <div className="article-content">
            <section id="summary" className="article-section">
              <h2>Healthspan is the real goal.</h2>
              <p>
                Lifespan asks how long you live. Healthspan asks how many of
                those years are lived with strength, clarity, mobility, and
                metabolic resilience. The best longevity system begins with
                ordinary inputs measured consistently: movement, sleep, food,
                blood pressure, labs, recovery, relationships, and prevention.
              </p>
              <div className="article-callout">
                <h3>What to remember</h3>
                <ul>
                  {article.summary.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="article-section">
              <h2>Before the list: evidence strength matters.</h2>
              <p>
                Some interventions are supported by decades of population,
                clinical, and mechanistic evidence. Others are promising but
                still early. This guide marks each strategy as strong, moderate,
                or emerging so you can prioritize the highest-confidence moves first.
              </p>
            </section>

            <section id="strategies" className="article-section">
              <h2>25 evidence-based healthspan strategies</h2>
              <div className="strategy-list">
                {article.strategies.map((strategy, index) => {
                  const category = getCategory(strategy.category);

                  return (
                    <section className="strategy-item" key={strategy.title}>
                      <div className="strategy-number">{String(index + 1).padStart(2, "0")}</div>
                      <div>
                        <div className="strategy-tags">
                          <span>{strategy.evidence} evidence</span>
                          {category ? <span>{category.title}</span> : null}
                        </div>
                        <h3>{strategy.title}</h3>
                        <p>{strategy.body}</p>
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>

            <section id="biomarkers" className="article-section">
              <h2>Biomarkers worth knowing first</h2>
              <p>
                The most useful biomarkers are the ones that change decisions.
                Start with blood pressure, lipids such as LDL-C and ApoB,
                glucose regulation markers such as HbA1c, body composition
                context, cardiorespiratory fitness, sleep, and recovery trends.
              </p>
              <p>
                No single marker is destiny. The signal becomes useful when it
                is interpreted with baseline context, symptoms, family history,
                medications, and clinician guidance.
              </p>
              <Link href="/resources/biomarkers" className="resource-inline-link">
                Browse the biomarker database <ArrowRight size={16} />
              </Link>
            </section>

            <section id="aeonvera" className="article-section">
              <h2>Where Aeonvera fits</h2>
              <p>
                Aeonvera is designed around the feedback loop most people are
                missing: collect the signal, understand what changed, choose the
                next action, and learn whether it worked. The platform brings
                labs, wearables, biological-age modeling, protocols, and
                physician-ready context into one private system.
              </p>
              <div className="article-takeaways">
                {article.takeaways.map((takeaway) => (
                  <div key={takeaway}>{takeaway}</div>
                ))}
              </div>
            </section>

            <section className="article-section article-disclaimer">
              <h2>Medical note</h2>
              <p>
                This article is educational and is not medical advice,
                diagnosis, or treatment. Decisions about screening, medications,
                supplements, and disease management should be made with a
                qualified clinician who knows your health history.
              </p>
            </section>

            <section id="references" className="article-section">
              <h2>References and further reading</h2>
              <ol className="article-references">
                {article.references.map((reference) => (
                  <li key={reference.url}>
                    <a href={reference.url} rel="noreferrer" target="_blank">
                      {reference.label}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
