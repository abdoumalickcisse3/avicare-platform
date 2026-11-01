/**
 * Turn a label into a catalog key.
 *
 * The key is what every other record points at — a flock's programme, a treatment row, a
 * withdrawal snapshot — so it has to survive being typed by someone in a hurry on a phone:
 * accents stripped, spaces collapsed, nothing but lowercase letters, digits and hyphens.
 *
 * The separator must stay a hyphen, identical to `web/src/lib/slug.ts`. It was an underscore
 * here, so the same medication typed on the phone and on the web produced two keys — two catalog
 * entries and two stock balances for one bottle (ADR-020).
 *
 * Editing an entry reuses its existing key rather than re-deriving one, because a renamed
 * label would otherwise create a second entry and orphan everything that referenced the first.
 */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    // Strip the combining marks NFD just separated: "Amoxicilline" and "Amoxicillíne" must not
    // become two different medications.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
