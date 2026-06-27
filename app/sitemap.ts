import type { MetadataRoute } from "next";

const BASE_URL = "https://www.aeonvera.com";

// Public, indexable marketing/legal routes.
const ROUTES = ["", "/about", "/demo", "/pricing", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.AEONVERA_WAITLIST_MODE === "1") {
    return [
      {
        url: `${BASE_URL}/waitlist`,
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
