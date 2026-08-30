/**
 * Turn a label into a catalog key.
 *
 * The key is what every other record points at — a flock's programme, a treatment row, a
 * withdrawal snapshot — so it has to survive being typed by someone in a hurry on a phone:
 * accents stripped, spaces collapsed, nothing but lowercase letters, digits and underscores.
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
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}
