/** French display labels for the backend FarmRole enum (mirrors the web). */
import type { FarmRole } from '@/types';

export const FARM_ROLE_LABELS: Record<FarmRole, string> = {
  OWNER: 'Propriétaire',
  MANAGER: 'Gestionnaire',
  FARMER: 'Éleveur',
  VETERINARIAN: 'Vétérinaire',
  BUYER: 'Acheteur',
};

/** Two-letter initials from a full name, for member avatars. */
export function memberInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
