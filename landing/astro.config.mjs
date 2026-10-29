// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

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
  // astro-icon lit les jeux d'icônes installés en dépendance (@iconify-json/*)
  // et inline le SVG à la construction : aucun appel réseau au runtime, et
  // seuls les glyphes réellement utilisés entrent dans la page.
  integrations: [sitemap(), icon({ include: { "simple-icons": ["*"] } })],
});
