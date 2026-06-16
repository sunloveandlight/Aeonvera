import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  },
  twitter: {
    card: "summary",
    title: "Aeonvera",
    description:
      "Private longevity intelligence for labs, wearables, biological age, protocols, and adaptive health coaching.",
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
        <script
          // No-flash theme: apply a stored preference before paint; otherwise
          // CSS prefers-color-scheme matches the visitor's device.
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('aeonvera.theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
