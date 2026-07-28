/** Farm-role labels (mirrors the web `farmRoles`). Used for the drawer header. */
export const FARM_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  MANAGER: 'Gestionnaire',
  FARMER: 'Éleveur',
  VETERINARIAN: 'Vétérinaire',
  BUYER: 'Acheteur',
};

export function roleLabel(farmRole: string | undefined, isAdmin: boolean): string {
  if (farmRole && FARM_ROLE_LABELS[farmRole]) return FARM_ROLE_LABELS[farmRole];
  return isAdmin ? 'Administrateur' : 'Utilisateur';
}
