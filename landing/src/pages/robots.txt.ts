// Dynamic robots.txt so the sitemap URL always tracks PUBLIC_SITE_URL
// (astro.config.mjs `site`) instead of a value hand-copied into
// public/robots.txt that could silently drift from the real domain.
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL("sitemap-index.xml", site).toString();
  const body = `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
