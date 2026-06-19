import type { MetadataRoute } from "next";

const BASE_URL = "https://www.aeonvera.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/companion",
        "/plan",
        "/digital-twin",
        "/life-os",
        "/network",
        "/data-sources",
        "/report",
        "/memory",
        "/settings",
        "/login",
        "/physician-export",
        "/onboarding",
        "/success",
        "/care-network/",
        "/physician-share/",
        "/future-self/",
        "/api/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
