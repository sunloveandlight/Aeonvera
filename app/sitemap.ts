import type { MetadataRoute } from "next";

import {
  biomarkerEntries,
  resourceArticles,
  resourceCategories,
} from "@/lib/resources/content";

const BASE_URL = "https://www.aeonvera.com";

// Public, indexable marketing/legal routes.
const ROUTES = [
  "",
  "/about",
  "/demo",
  "/pricing",
  "/privacy",
  "/terms",
  "/resources",
  "/resources/articles",
  "/resources/guides",
  "/resources/biomarkers",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const resourceRoutes = [
    "/resources",
    "/resources/articles",
    "/resources/guides",
    "/resources/biomarkers",
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const categoryRoutes = resourceCategories.map((category) => ({
    url: `${BASE_URL}/resources/categories/${category.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const articleRoutes = resourceArticles.map((article) => ({
    url: `${BASE_URL}/resources/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  const biomarkerRoutes = biomarkerEntries
    .filter((biomarker) => biomarker.summary)
    .map((biomarker) => ({
      url: `${BASE_URL}/resources/biomarkers/${biomarker.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    }));

  if (process.env.AEONVERA_WAITLIST_MODE === "1") {
    return [
      {
        url: `${BASE_URL}/waitlist`,
        changeFrequency: "weekly",
        priority: 1,
      },
      ...resourceRoutes,
      ...categoryRoutes,
      ...articleRoutes,
      ...biomarkerRoutes,
    ];
  }

  const staticRoutes = ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" as const : "monthly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...articleRoutes, ...biomarkerRoutes];
}
