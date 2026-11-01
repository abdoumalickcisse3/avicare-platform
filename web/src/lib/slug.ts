/**
 * URL/key-safe slug: lowercase, accent-stripped, non-alphanumerics collapsed to single hyphens.
 *
 * Must stay identical to `mobile/src/health/slug.ts`: a medication typed on either app has to land
 * on the same key, or one product ends up with two catalog entries and two stock balances
 * (ADR-020). Capped at the 100 characters the catalog column accepts.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
