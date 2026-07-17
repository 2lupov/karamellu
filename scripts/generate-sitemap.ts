// Generates public/sitemap.xml with all static routes + active products + categories from Supabase.
// Runs via predev / prebuild hooks.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://karamellu.org";
const SUPABASE_URL = "https://guqhdtcvkhusjsxcbnwj.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cWhkdGN2a2h1c2pzeGNibndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODQ4MjUsImV4cCI6MjA4ODU2MDgyNX0.OH291HI1YJG8ZhW2zgxjiICFus0OspGdku5GPiZskwI";

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const staticEntries: Entry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/shop", changefreq: "daily", priority: "0.9" },
  { path: "/loyalty", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.2" },
  { path: "/terms", changefreq: "yearly", priority: "0.2" },
];

async function fetchTable(table: string, query: string): Promise<any[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) {
      console.warn(`sitemap: failed to fetch ${table}: ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn(`sitemap: error fetching ${table}:`, e);
    return [];
  }
}

function xmlEscape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function render(entries: Entry[]) {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${xmlEscape(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ].filter(Boolean).join("\n")
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const products = await fetchTable(
    "products",
    "select=id,updated_at&is_active=eq.true"
  );
  const categories = await fetchTable(
    "categories",
    "select=slug,created_at"
  );

  const entries: Entry[] = [...staticEntries];

  for (const c of categories) {
    if (!c.slug) continue;
    entries.push({
      path: `/shop?category=${encodeURIComponent(c.slug)}`,
      lastmod: c.created_at?.slice(0, 10),
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  for (const p of products) {
    entries.push({
      path: `/product/${p.id}`,
      lastmod: p.updated_at?.slice(0, 10),
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  writeFileSync(resolve("public/sitemap.xml"), render(entries));
  console.log(`sitemap.xml written (${entries.length} entries: ${products.length} products, ${categories.length} categories)`);
}

main().catch((e) => {
  console.error("sitemap generation failed:", e);
  // Don't fail build — write a minimal sitemap so prebuild always succeeds.
  writeFileSync(resolve("public/sitemap.xml"), render(staticEntries));
});
