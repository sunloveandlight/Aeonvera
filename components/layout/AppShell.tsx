"use client";

import Header from "./Header";
import Footer from "./Footer";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen flex flex-col antialiased">

      {/* HEADER */}
      <Header />

      {/* PAGE CONTENT */}
      <div className="flex-1">
        {children}
      </div>

      {/* FOOTER */}
      <Footer />

    </main>
  );
}