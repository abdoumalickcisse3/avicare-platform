/**
 * Finance: keep/remove/add the seeded expense-category catalog. No gating.
 */
import { getCategoryConfig } from '@/constants/catalogCategories';
import { useWizard } from '@/onboarding/wizardContext';
import { ManagedCatalogList } from '../ManagedCatalogList';
import { StepScaffold } from '../StepScaffold';

export function FinanceStep() {
  const { farmId } = useWizard();
  const config = getCategoryConfig('comptabilite');

  return (
    <StepScaffold
      eyebrow="Étape 6 · Finance"
      title="Configurez vos dépenses"
      subtitle="Gardez les catégories utiles, ajoutez les vôtres pour suivre vos coûts dès le premier jour."
    >
      {farmId != null && config ? <ManagedCatalogList farmId={farmId} config={config} /> : null}
    </StepScaffold>
  );
}
