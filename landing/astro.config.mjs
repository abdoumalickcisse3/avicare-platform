// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://jawdi.app",
  output: "static",
  // Phase collaborateurs : la tarification est retirée de la vitrine. La page
  // /tarifs existe toujours dans les sources (réversible) mais toute visite est
  // redirigée vers /contact. En sortie statique, Astro émet une page de
  // redirection HTML pour cette entrée.
  redirects: {
    "/tarifs": "/contact",
  },
  integrations: [sitemap()],
});
