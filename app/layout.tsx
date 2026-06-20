import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import AppShell from "@/components/layout/AppShell";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Aeonvera",
    template: "%s | Aeonvera",
  },
  description:
    "Private longevity intelligence for labs, wearables, biological age, protocols, and adaptive health coaching.",
  applicationName: "Aeonvera",
  metadataBase: new URL("https://www.aeonvera.com"),
  appleWebApp: {
    capable: true,
    title: "Aeonvera",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/aeonvera-app-icon.svg",
    apple: "/aeonvera-app-icon.svg",
  },
  openGraph: {
    title: "Aeonvera",
    description:
      "Private longevity intelligence for labs, wearables, biological age, protocols, and adaptive health coaching.",
    siteName: "Aeonvera",
    type: "website",
    url: "https://www.aeonvera.com",
    images: [
      {
        url: "/marketing/rejuvenation-woman.png",
        width: 1536,
        height: 1024,
        alt: "Aeonvera longevity intelligence.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aeonvera",
    description:
      "Private longevity intelligence for labs, wearables, biological age, protocols, and adaptive health coaching.",
    images: ["/marketing/rejuvenation-woman.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <Script
          id="aeonvera-organization-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Aeonvera",
              url: "https://www.aeonvera.com",
              logo: "https://www.aeonvera.com/aeonvera-app-icon.svg",
              description: "Longevity Intelligence Platform",
            }),
          }}
        />
        <Script
          id="aeonvera-theme"
          strategy="beforeInteractive"
          // No-flash theme: apply stored/system theme before first paint.
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('aeonvera.theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
