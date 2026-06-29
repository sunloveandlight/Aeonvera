import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleList } from "../../ResourceCards";
import {
  getArticlesByCategory,
  getCategory,
  resourceCategories,
  type ResourceCategorySlug,
} from "@/lib/resources/content";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return resourceCategories.map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug as ResourceCategorySlug);

  if (!category) {
    return {
      title: "Resources",
    };
  }

  return {
    title: category.title,
    description: category.description,
    alternates: {
      canonical: `/resources/categories/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategory(slug as ResourceCategorySlug);

  if (!category) notFound();

  const articles = getArticlesByCategory(category.slug);

  return (
    <main className="resources-page">
      <section className="resources-archive-hero">
        <p className="resources-library-label">Category</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
      </section>
      <section className="resources-section">
        <ArticleList articles={articles} />
      </section>
    </main>
  );
}
