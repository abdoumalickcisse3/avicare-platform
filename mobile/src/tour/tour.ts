/**
 * The first-run tour: what it says, and how it remembers it has been said.
 *
 * Kept separate from the component so the part that can be wrong — the step content, and the
 * "has this person already seen it" decision — is testable without rendering anything.
 *
 * The flag is per farm role, not global. An owner and a field worker open different apps: the
 * owner gets a farm to run, the worker gets three things to record. Someone promoted from FARMER
 * to MANAGER should be shown the tour again, because what the app is for has changed for them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TourStep = { title: string; body: string };

const OWNER_STEPS: TourStep[] = [
  {
    title: 'Votre ferme, en un écran',
    body: "L'accueil montre l'effectif, la mortalité, la ponte et l'aliment sur la période que vous choisissez. Changez-la avec les trois boutons sous les chiffres.",
  },
  {
    title: 'Saisir depuis le poulailler',
    body: "Mortalité, pesée, ramassage, soins : tout se saisit ici, même sans réseau. Ce qui n'est pas parti attend dans la file et repart tout seul.",
  },
  {
    title: 'Vendre et encaisser',
    body: "Chaque client est un compte courant : ce qu'il doit, ce qu'il a payé. Vente directe, facture, encaissement — sans repasser par l'ordinateur.",
  },
];

const FIELD_STEPS: TourStep[] = [
  {
    title: 'Trois gestes par jour',
    body: 'Mortalité, aliment, ramassage. Les gros boutons en bas de chaque écran sont faits pour être touchés avec des gants.',
  },
  {
    title: 'Le réseau ne vous bloque pas',
    body: "Saisissez même sans connexion : l'application garde tout et l'envoie dès que le réseau revient. Le bandeau en bas vous dit où ça en est.",
  },
  {
    title: 'Le sanitaire suit le lot',
    body: "Vaccinations, traitements, observations : l'application vous rappelle ce qui est en retard et le délai d'attente avant vente.",
  },
];

/** Owners and managers run a farm; everyone else records in it. */
export function stepsForRole(farmRole: string | undefined): TourStep[] {
  return farmRole === 'OWNER' || farmRole === 'MANAGER' ? OWNER_STEPS : FIELD_STEPS;
}

/** One key per role, so a promotion re-shows the tour that now applies. */
export function tourKey(farmRole: string | undefined): string {
  return `tour.seen.${farmRole ?? 'unknown'}`;
}

export async function hasSeenTour(farmRole: string | undefined): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(tourKey(farmRole))) === '1';
  } catch {
    // Storage unavailable: treat as already seen. Showing a tour on every launch because the
    // device cannot remember is worse than never showing it.
    return true;
  }
}

export async function markTourSeen(farmRole: string | undefined): Promise<void> {
  try {
    await AsyncStorage.setItem(tourKey(farmRole), '1');
  } catch {
    // Nothing to do: the tour will be offered again next launch, which is the harmless direction.
  }
}
