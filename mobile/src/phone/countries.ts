/**
 * The countries a Jawdi phone number can belong to.
 *
 * Deliberately short. A picker holding all 250 countries is an obstacle on a phone held in one
 * hand under the sun, and production only ever contained four: Senegal, Benin, France and
 * Lebanon. The list is West Africa first — where the farms are — then the diaspora countries the
 * data already showed.
 *
 * This file is duplicated in `web/src/lib/phone/countries.ts`. The repo has an empty `shared/`
 * folder wired into neither Metro nor Next, and wiring it is an architecture decision nobody has
 * taken. Sixteen stable rows are cheaper to duplicate than a bundler change — but if a row is
 * added here, add it there.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, the picker's key. */
  readonly iso: string;
  readonly name: string;
  /** Calling code, digits only, no '+'. */
  readonly dial: string;
  readonly flag: string;
  /** A real-looking local number, shown as a placeholder. Never used to refuse input. */
  readonly example: string;
  /**
   * Whether a leading zero is a national trunk prefix to drop, or part of the number itself.
   *
   * This is NOT a global rule, and assuming it was cost a round-trip: France dials 06 81 01 37 59
   * for +33 681013759, so its zero goes — but Benin's 01 56 34 34 08 IS +229 0156343408, and
   * dropping that zero deletes a digit of a real subscriber. Senegal has no trunk prefix at all;
   * its flag is true only because people type one out of habit and nine-digit numbers never
   * legitimately open on a zero.
   */
  readonly trunkZero: boolean;
}

export const COUNTRIES: readonly Country[] = [
  { iso: 'SN', name: 'Sénégal', dial: '221', flag: '🇸🇳', example: '77 000 00 00' , trunkZero: true },
  { iso: 'BJ', name: 'Bénin', dial: '229', flag: '🇧🇯', example: '01 56 34 34 08' , trunkZero: false },
  { iso: 'CI', name: "Côte d'Ivoire", dial: '225', flag: '🇨🇮', example: '01 02 03 04 05' , trunkZero: false },
  { iso: 'ML', name: 'Mali', dial: '223', flag: '🇲🇱', example: '70 00 00 00' , trunkZero: false },
  { iso: 'BF', name: 'Burkina Faso', dial: '226', flag: '🇧🇫', example: '70 00 00 00' , trunkZero: false },
  { iso: 'GN', name: 'Guinée', dial: '224', flag: '🇬🇳', example: '620 00 00 00' , trunkZero: false },
  { iso: 'MR', name: 'Mauritanie', dial: '222', flag: '🇲🇷', example: '22 00 00 00' , trunkZero: false },
  { iso: 'GM', name: 'Gambie', dial: '220', flag: '🇬🇲', example: '300 0000' , trunkZero: false },
  { iso: 'GW', name: 'Guinée-Bissau', dial: '245', flag: '🇬🇼', example: '955 000 000' , trunkZero: false },
  { iso: 'TG', name: 'Togo', dial: '228', flag: '🇹🇬', example: '90 00 00 00' , trunkZero: false },
  { iso: 'NE', name: 'Niger', dial: '227', flag: '🇳🇪', example: '90 00 00 00' , trunkZero: false },
  { iso: 'CM', name: 'Cameroun', dial: '237', flag: '🇨🇲', example: '6 00 00 00 00' , trunkZero: false },
  { iso: 'FR', name: 'France', dial: '33', flag: '🇫🇷', example: '6 81 01 37 59' , trunkZero: true },
  { iso: 'BE', name: 'Belgique', dial: '32', flag: '🇧🇪', example: '470 00 00 00' , trunkZero: true },
  { iso: 'CA', name: 'Canada', dial: '1', flag: '🇨🇦', example: '416 000 0000' , trunkZero: false },
  { iso: 'LB', name: 'Liban', dial: '961', flag: '🇱🇧', example: '70 430 418' , trunkZero: true },
] as const;

/** Senegal: where the farms are, and where every field worker in the survey lives. */
export const DEFAULT_COUNTRY = COUNTRIES[0]!;

/**
 * Longest dial code first, so '221' wins over '22' when both could match. Without this a
 * Senegalese number would be read as Mauritanian.
 */
const BY_LONGEST_DIAL = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * Splits a stored E.164 number into the country that owns it and the subscriber part.
 *
 * Falls back to the default country and the raw digits when nothing matches — an unknown country
 * code must stay editable, never be silently rewritten.
 */
export function splitE164(value: string | null | undefined): { country: Country; local: string } {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return { country: DEFAULT_COUNTRY, local: '' };
  const match = BY_LONGEST_DIAL.find((c) => digits.startsWith(c.dial));
  if (!match) return { country: DEFAULT_COUNTRY, local: digits };
  return { country: match, local: digits.slice(match.dial.length) };
}

/** Builds the stored form: '+' + dial + subscriber, or '' when there is no subscriber part. */
export function toE164(country: Country, local: string): string {
  let digits = local.replace(/\D/g, '');
  if (country.trunkZero) {
    digits = digits.replace(/^0+/, '');
  }
  return digits ? `+${country.dial}${digits}` : '';
}
