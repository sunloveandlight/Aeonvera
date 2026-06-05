import Header from "./Header";
import Footer from "./Footer";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col relative">

      {/* GLOBAL BACKGROUND (SYSTEM-WIDE) */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />
      </div>

      {/* HEADER */}
      <Header />

      {/* PAGE CONTENT WRAPPER (IMPORTANT CONSISTENCY LAYER) */}
      <main className="flex-1 w-full">
        {children}
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}