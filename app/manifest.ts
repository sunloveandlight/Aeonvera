import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aeonvera",
    short_name: "Aeonvera",
    description: "Private longevity intelligence.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      {
        src: "/aeonvera-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/aeonvera-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
