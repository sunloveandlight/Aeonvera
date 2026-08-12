import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// ---- env ----
function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] !== undefined) continue;
    process.env[k] = v.trim().replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
  }
}
loadLocalEnv();

const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3001";
const OUT = path.join(process.cwd(), "scratchpad/visual-audit");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Missing supabase env");
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- routes ----
const PUBLIC_ROUTES = [
  "/", "/about", "/pricing", "/privacy", "/terms", "/login", "/demo",
  "/professional",
  "/resources", "/resources/articles", "/resources/guides", "/resources/biomarkers",
  "/resources/biomarkers/apob", "/resources/biomarkers/vo2-max",
  "/resources/categories/nutrition", "/resources/categories/sleep",
  "/resources/what-is-biological-age",
  "/resources/how-to-read-your-first-longevity-blood-panel",
];
const AUTHED_ROUTES = [
  "/dashboard", "/settings", "/ops", "/memory", "/network", "/onboarding",
  "/assessment", "/report", "/plan", "/companion", "/data-sources",
  "/digital-twin", "/life-autopilot", "/life-os", "/optimization",
  "/physician-export", "/concierge/success", "/success", "/professional/dashboard",
];

const VARIANTS = [
  { name: "desktop-light", viewport: { width: 1440, height: 900 }, theme: "light", mobile: false },
  { name: "desktop-dark", viewport: { width: 1440, height: 900 }, theme: "dark", mobile: false },
  { name: "mobile-light", viewport: { width: 390, height: 844 }, theme: "light", mobile: true },
  { name: "mobile-dark", viewport: { width: 390, height: 844 }, theme: "dark", mobile: true },
];

// ---- detectors run in-page ----
const DETECT_FN = () => {
  const out = { covered: [], broken: [], overflow: null, clipped: [], emptyBg: [] };
  const vw = window.innerWidth, vh = window.innerHeight;
  out.overflow = {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: vw,
    overflowing: document.documentElement.scrollWidth > vw + 2,
  };
  const desc = (el) => {
    if (!el) return "null";
    const cls = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    const txt = (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}${txt ? ` "${txt}"` : ""}`;
  };
  const imgs = Array.from(document.querySelectorAll("img"));
  for (const img of imgs) {
    const r = img.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const inView = r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0;
    // broken
    if (img.complete && img.naturalWidth === 0) {
      out.broken.push({ src: (img.currentSrc || img.src || "").slice(-80), alt: img.alt || "", rect: { w: Math.round(r.width), h: Math.round(r.height) } });
    }
    if (!inView) continue;
    // coverage: sample 5 points; if topmost element isn't the img or its descendant/ancestor, it's covered
    const pts = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + r.width * 0.25, r.top + r.height * 0.25],
      [r.left + r.width * 0.75, r.top + r.height * 0.25],
      [r.left + r.width * 0.25, r.top + r.height * 0.75],
      [r.left + r.width * 0.75, r.top + r.height * 0.75],
    ];
    let coveredPts = 0;
    let coverer = null;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const top = document.elementFromPoint(x, y);
      if (!top) continue;
      if (top === img || img.contains(top) || top.contains(img)) continue;
      coveredPts++;
      if (!coverer) coverer = top;
    }
    if (coveredPts >= 3 && coverer) {
      const cs = getComputedStyle(coverer);
      out.covered.push({
        src: (img.currentSrc || img.src || "").slice(-70),
        alt: img.alt || "",
        coveredPts,
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
        coverer: desc(coverer),
        covererBg: cs.backgroundColor,
        covererOpacity: cs.opacity,
      });
    }
  }
  // clipped text: element with overflow hidden and content wider/taller than box
  const all = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,span,a,button,li,td,th,label"));
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.overflow === "visible") continue;
    if (el.scrollWidth > el.clientWidth + 4 && cs.textOverflow !== "ellipsis" && cs.whiteSpace !== "nowrap") {
      const txt = (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 50);
      if (txt) out.clipped.push({ el: desc(el), txt, scrollW: el.scrollWidth, clientW: el.clientWidth });
    }
  }
  out.clipped = out.clipped.slice(0, 15);
  return out;
};

async function settle(page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// ---- seed QA user (sovereign, full data) ----
async function seedQaUser() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+visual-${suffix}@aeonvera.test`;
  const password = `Aeonvera-Visual-${suffix}!`;
  const { data: userData, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, password,
    user_metadata: { display_name: "QA Visual Audit" },
  });
  if (error || !userData.user) throw new Error(error?.message || "createUser failed");
  const userId = userData.user.id;
  try {
    await ins("profiles", {
      user_id: userId, email, display_name: "QA Visual", full_name: "QA Visual Audit",
      biological_age: 35.4, onboarding_completed: true, plan: "sovereign",
      subscription_status: "active", primary_goal: "Full visual audit",
    });
    const ws = await insOne("workspaces", {
      owner_user_id: userId, name: "QA Visual WS", plan: "sovereign",
      subscription_status: "active", max_health_profiles: 10, status: "active",
    });
    await ins("workspace_members", { workspace_id: ws.id, user_id: userId, role: "owner", status: "active" });
    const hp = await insOne("health_profiles", {
      workspace_id: ws.id, legacy_user_id: userId, created_by_user_id: userId,
      display_name: "QA Primary", relationship: "self", is_primary: true, status: "active",
    });
    await ins("health_profile_access", {
      workspace_id: ws.id, health_profile_id: hp.id, user_id: userId, role: "owner", status: "active",
    });
    await ins("longevity_assessments", {
      user_id: userId, health_profile_id: hp.id, age: "35", sex: "male", height_cm: "178",
      weight_kg: "76", sleep_hours: "7", sleep_quality: "good", exercise_days: "4",
      strength_training: "3", diet_type: "Mediterranean", alcohol_use: "rare", smoking: "never",
      stress_level: "moderate", primary_goal: "healthy longevity", resting_hr: "58", hrv: "62",
      fasting_glucose: "86", recovery_quality: "good",
    });
    await ins("health_states", {
      user_id: userId, health_profile_id: hp.id,
      baseline: { daily_steps: 9000, fasting_glucose: 86, heart_rate_variability: 62, resting_heart_rate: 58, sleep_hours: 7 },
      trends: { sleep_hours: { changePercent: 3, direction: "up" }, recovery_score: { changePercent: 5, direction: "up" } },
      risk_scores: { cardiovascular: 14, metabolic: 18, recovery: 15 },
      insights: ["Synthetic QA baseline for visual audit."],
      last_processed_at: new Date().toISOString(),
    });
    return { email, password, userId, workspaceId: ws.id, healthProfileId: hp.id };
  } catch (e) {
    await cleanup(userId);
    throw e;
  }
}
async function ins(table, payload) {
  const { error } = await admin.from(table).insert(payload);
  if (error) throw new Error(`${table}: ${error.message}`);
}
async function insOne(table, payload) {
  const { data, error } = await admin.from(table).insert(payload).select("id").single();
  if (error || !data) throw new Error(`${table}: ${error?.message || "no row"}`);
  return data;
}
async function cleanup(userId) {
  const dels = [
    ["life_os_priorities", "user_id"], ["notification_preferences", "user_id"],
    ["health_states", "user_id"], ["longevity_assessments", "user_id"],
    ["health_profile_access", "user_id"], ["health_profiles", "created_by_user_id"],
    ["workspace_members", "user_id"], ["workspaces", "owner_user_id"], ["profiles", "user_id"],
  ];
  for (const [t, c] of dels) await admin.from(t).delete().eq(c, userId).then(() => {}, () => {});
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

// ---- capture ----
async function capturePage(page, route, variant, report) {
  const problems = [];
  const onConsole = (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/webpack-hmr|Failed to load resource.*40[34]|ERR_CONNECTION|supabase_auth-js/.test(t)) return;
    problems.push(`console: ${t.slice(0, 200)}`);
  };
  const onErr = (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`);
  const on500 = (res) => {
    const u = new URL(res.url());
    if (u.pathname.startsWith("/api/") && res.status() >= 500) problems.push(`api ${res.status()}: ${u.pathname}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onErr);
  page.on("response", on500);

  let status = 0;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = resp ? resp.status() : 0;
  } catch (e) {
    problems.push(`navfail: ${e.message.slice(0, 120)}`);
  }
  await settle(page);
  const finalUrl = page.url().replace(BASE, "");
  let detect = {};
  try { detect = await page.evaluate(DETECT_FN); } catch (e) { detect = { error: e.message }; }
  const safe = route.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root";
  const file = `${variant.name}__${safe}.png`;
  try {
    await page.screenshot({ path: path.join(SHOTS, file), fullPage: true, timeout: 20000 });
  } catch { try { await page.screenshot({ path: path.join(SHOTS, file), fullPage: false }); } catch {} }

  page.off("console", onConsole);
  page.off("pageerror", onErr);
  page.off("response", on500);

  report.push({
    variant: variant.name, route, finalUrl, status,
    redirected: finalUrl !== route,
    overflow: detect.overflow?.overflowing ? detect.overflow : null,
    covered: detect.covered || [],
    broken: detect.broken || [],
    clipped: detect.clipped || [],
    problems,
    shot: file,
  });
  const flags = [];
  if (status >= 400) flags.push(`HTTP ${status}`);
  if (detect.overflow?.overflowing) flags.push("OVERFLOW");
  if ((detect.covered || []).length) flags.push(`covered:${detect.covered.length}`);
  if ((detect.broken || []).length) flags.push(`broken:${detect.broken.length}`);
  if (problems.length) flags.push(`prob:${problems.length}`);
  console.log(`  [${variant.name}] ${route} -> ${status}${finalUrl !== route ? ` (→${finalUrl})` : ""} ${flags.join(" ")}`);
}

async function run() {
  console.log("Seeding QA user...");
  const qa = await seedQaUser();
  console.log(`QA user: ${qa.email}`);
  const report = [];
  const browser = await chromium.launch();
  try {
    for (const variant of VARIANTS) {
      console.log(`\n=== ${variant.name} ===`);
      // shared init: force theme
      const ctx = await browser.newContext({
        viewport: variant.viewport,
        isMobile: variant.mobile,
        hasTouch: variant.mobile,
        deviceScaleFactor: 1,
        colorScheme: variant.theme,
      });
      await ctx.addInitScript((theme) => {
        try { localStorage.setItem("aeonvera.theme", theme); } catch {}
        if (document.documentElement) {
          document.documentElement.setAttribute("data-theme", theme);
        } else {
          window.addEventListener("DOMContentLoaded", () => {
            document.documentElement?.setAttribute("data-theme", theme);
          }, { once: true });
        }
      }, variant.theme);

      // ANON pass
      const anon = await ctx.newPage();
      for (const route of PUBLIC_ROUTES) await capturePage(anon, route, { ...variant, name: variant.name + "-anon" }, report);
      await anon.close();

      // AUTHED pass — login
      const authed = await ctx.newPage();
      await authed.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
      await settle(authed);
      try {
        await authed.getByRole("textbox", { name: "Email" }).fill(qa.email);
        await authed.getByRole("textbox", { name: "Password" }).fill(qa.password);
        await Promise.all([
          authed.waitForURL(/\/dashboard/, { timeout: 45000, waitUntil: "domcontentloaded" }),
          authed.getByRole("button", { name: "Sign in" }).click(),
        ]);
        await settle(authed);
        console.log(`  login OK`);
      } catch (e) {
        console.log(`  LOGIN FAILED: ${e.message.slice(0, 120)}`);
      }
      for (const route of AUTHED_ROUTES) await capturePage(authed, route, variant, report);
      await authed.close();
      await ctx.close();
    }
  } finally {
    await browser.close();
    console.log("\nCleaning up QA user...");
    await cleanup(qa.userId);
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  // summary
  const covered = report.filter((r) => r.covered.length);
  const broken = report.filter((r) => r.broken.length);
  const overflow = report.filter((r) => r.overflow);
  const errs = report.filter((r) => r.problems.length);
  const bad = report.filter((r) => r.status >= 400);
  console.log("\n======== SUMMARY ========");
  console.log(`captured: ${report.length}`);
  console.log(`HTTP>=400: ${bad.length}`, [...new Set(bad.map((r) => `${r.route}(${r.status})`))].join(", "));
  console.log(`overflow: ${overflow.length}`, [...new Set(overflow.map((r) => r.route))].join(", "));
  console.log(`covered-images: ${covered.length}`, [...new Set(covered.map((r) => r.route))].join(", "));
  console.log(`broken-images: ${broken.length}`, [...new Set(broken.map((r) => r.route))].join(", "));
  console.log(`console/api errors: ${errs.length}`, [...new Set(errs.map((r) => r.route))].join(", "));
  console.log("report.json written to", path.join(OUT, "report.json"));
}

run().catch((e) => { console.error("FATAL", e); process.exit(1); });
