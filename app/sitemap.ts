import type { MetadataRoute } from "next";

const BASE_URL = "https://www.aeonvera.com";

// Public, indexable marketing/legal routes.
const ROUTES = ["", "/about", "/optimization", "/assessment", "/pricing", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
