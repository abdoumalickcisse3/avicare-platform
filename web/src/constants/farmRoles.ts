import type { FarmRole } from "@/types";

/** French display labels for the backend FarmRole enum. */
export const FARM_ROLE_LABELS: Record<FarmRole, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gestionnaire",
  FARMER: "Éleveur",
  VETERINARIAN: "Vétérinaire",
  BUYER: "Acheteur",
};

/** Roles assignable via the invite dialog, in display order. */
export const FARM_ROLES: FarmRole[] = [
  "OWNER",
  "MANAGER",
  "FARMER",
  "VETERINARIAN",
  "BUYER",
];

/** Roles assignable to a created member (OWNER excluded — that is the farm creator). */
export const ASSIGNABLE_FARM_ROLES: FarmRole[] = [
  "MANAGER",
  "FARMER",
  "VETERINARIAN",
  "BUYER",
];
