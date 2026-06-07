/**
 * Default slaughter targets per broiler breed code. The backend `breeds.growth_curve`
 * is null in the V4 seed, so the create-batch dialog pre-fills these when a breed is
 * picked. TECH DEBT: source these from the breed reference data once it carries a curve.
 */
export interface BreedTargets {
  targetWeightG: number;
  targetAgeDays: number;
}

const BREED_TARGETS: Record<string, BreedTargets> = {
  cobb_500: { targetWeightG: 2100, targetAgeDays: 42 },
  ross_308: { targetWeightG: 2200, targetAgeDays: 42 },
};

export const DEFAULT_BREED_TARGETS: BreedTargets = {
  targetWeightG: 2000,
  targetAgeDays: 42,
};

export function targetsForBreed(code: string | undefined): BreedTargets {
  return (code && BREED_TARGETS[code]) || DEFAULT_BREED_TARGETS;
}
