import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { biomarkerEntries } from "@/lib/resources/content";

type BiomarkerPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const detailedBiomarkers = biomarkerEntries.filter((biomarker) => biomarker.summary);

export function generateStaticParams() {
  return detailedBiomarkers.map((biomarker) => ({
    slug: biomarker.slug,
  }));
}

export async function generateMetadata({ params }: BiomarkerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const biomarker = detailedBiomarkers.find((entry) => entry.slug === slug);

  if (!biomarker) {
    return {
      title: "Biomarker Database",
    };
  }

  return {
    title: `${biomarker.name} Biomarker Guide`,
    description: `${biomarker.name}: what it measures, why it matters, how to interpret it, and which lifestyle or clinical levers can influence it.`,
    alternates: {
      canonical: `/resources/biomarkers/${biomarker.slug}`,
    },
    openGraph: {
      title: `${biomarker.name} Biomarker Guide`,
      description: biomarker.whyItMatters,
      url: `/resources/biomarkers/${biomarker.slug}`,
      images: [
        {
          url: "/marketing/rejuvenation-woman-top-extended.png",
          width: 1536,
          height: 1024,
          alt: "Aeonvera biomarker guide.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${biomarker.name} Biomarker Guide`,
      description: biomarker.whyItMatters,
      images: ["/marketing/rejuvenation-woman-top-extended.png"],
    },
  };
}

export default async function BiomarkerPage({ params }: BiomarkerPageProps) {
  const { slug } = await params;
  const biomarker = detailedBiomarkers.find((entry) => entry.slug === slug);

  if (!biomarker) notFound();

  const relatedBiomarkers = biomarker.relatedSlugs
    ? biomarkerEntries.filter((entry) => biomarker.relatedSlugs?.includes(entry.slug))
    : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `${biomarker.name} Biomarker Guide`,
    description: biomarker.whyItMatters,
    url: `https://www.aeonvera.com/resources/biomarkers/${biomarker.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Aeonvera",
      logo: "https://www.aeonvera.com/aeonvera-app-icon.svg",
    },
    reviewedBy: {
      "@type": "Organization",
      name: "Aeonvera Editorial",
    },
  };

  return (
    <main className="resources-page biomarker-detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="biomarker-detail">
        <header className="biomarker-detail-hero">
          <Link href="/resources/biomarkers" className="resource-inline-link">
            Biomarker Database
          </Link>
          <p className="resources-library-label">{biomarker.category}</p>
          <h1>{biomarker.name}</h1>
          <p>{biomarker.whyItMatters}</p>
          <div className="article-meta-row">
            <span>Educational guide</span>
            <span>Clinician context recommended</span>
          </div>
        </header>

        <div className="biomarker-detail-grid">
          <aside className="article-sidebar" aria-label={`${biomarker.name} guide contents`}>
            <p>In this guide</p>
            <a href="#overview">Overview</a>
            <a href="#useful-for">Useful for</a>
            <a href="#interpretation">Interpretation</a>
            <a href="#levers">Levers</a>
            <a href="#cautions">Cautions</a>
            <a href="#references">References</a>
          </aside>

          <div className="article-content">
            <section id="overview" className="article-section">
              <h2>What it measures</h2>
              <p>{biomarker.summary}</p>
              <div className="article-callout">
                <h3>How it is measured</h3>
                <p>{biomarker.measuredBy}</p>
              </div>
            </section>

            <section id="useful-for" className="article-section">
              <h2>What it is useful for</h2>
              <ul className="biomarker-check-list">
                {biomarker.usefulFor?.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={17} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="interpretation" className="article-section">
              <h2>How to interpret it</h2>
              <div className="biomarker-interpretation-grid">
                {biomarker.interpretation?.map((item) => (
                  <article key={item.label}>
                    <h3>{item.label}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="levers" className="article-section">
              <h2>What can move the signal</h2>
              <ul className="biomarker-check-list">
                {biomarker.improveLevers?.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={17} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="cautions" className="article-section article-disclaimer">
              <h2>Important cautions</h2>
              <ul className="biomarker-caution-list">
                {biomarker.cautions?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="article-section">
              <h2>Use this inside a system</h2>
              <p>
                A biomarker becomes useful when it connects to a decision:
                retest timing, training load, nutrition changes, sleep quality,
                medication discussion, or clinical follow-up. Aeonvera is built
                to place each signal in context with your labs, wearables,
                protocols, and physician-ready notes.
              </p>
              <Link href="/resources/science-of-living-longer-25-evidence-based-strategies" className="resource-inline-link">
                Read the healthspan strategy guide <ArrowRight size={16} />
              </Link>
            </section>

            {relatedBiomarkers.length > 0 ? (
              <section className="article-section">
                <h2>Related biomarkers</h2>
                <div className="related-biomarker-grid">
                  {relatedBiomarkers.map((related) => (
                    <Link href={`/resources/biomarkers/${related.slug}`} key={related.slug}>
                      <strong>{related.name}</strong>
                      <span>{related.category}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section id="references" className="article-section">
              <h2>References and further reading</h2>
              <ol className="article-references">
                {biomarker.references?.map((reference) => (
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
