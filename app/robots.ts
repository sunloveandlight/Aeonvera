import type { MetadataRoute } from "next";

const BASE_URL = "https://www.aeonvera.com";

export default function robots(): MetadataRoute.Robots {
  if (process.env.AEONVERA_WAITLIST_MODE === "1") {
    return {
      rules: [
        {
          userAgent: "*",
          allow: ["/waitlist", "/resources", "/resources/"],
          disallow: ["/api/", "/"],
        },
      ],
      sitemap: `${BASE_URL}/sitemap.xml`,
    };
  }

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
        "/ops",
        "/optimization",
        "/physician-export",
        "/onboarding",
        "/success",
        "/concierge",
        "/care-network/",
        "/physician-share/",
        "/future-self/",
        "/api/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
