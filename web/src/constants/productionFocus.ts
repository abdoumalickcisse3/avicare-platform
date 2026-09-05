/**
 * The production types a farm can declare — one source of truth.
 *
 * <p>The tokens are validated server-side (`FarmService.ALLOWED_FOCUS`) and decide which sections
 * the menu shows, so they are not free text. They were listed twice, and the two copies had already
 * drifted: the create-farm dialog said "Volaille chair" where the onboarding wizard said "Chair",
 * and only the wizard offered the mixed option. A third species (doc 00, wave V2) would have been
 * added to one of them.
 *
 * <p>`label` is the standalone name, `short` the one used inside a picker where the context already
 * says what is being chosen.
 */
export const PRODUCTION_FOCUS = [
  {
    token: "broiler",
    label: "Volaille chair",
    short: "Chair",
    hint: "Poulets de chair",
    module: "module.poultry.broiler",
  },
  {
    token: "layer",
    label: "Volaille ponte",
    short: "Ponte",
    hint: "Poules pondeuses",
    module: "module.poultry.layer",
  },
] as const;

export type ProductionFocusToken = (typeof PRODUCTION_FOCUS)[number]["token"];

/** Every token, in declaration order — what "mixed" expands to. */
export const ALL_FOCUS_TOKENS: readonly string[] = PRODUCTION_FOCUS.map((o) => o.token);
