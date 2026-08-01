/**
 * Stock: keep/remove/add the seeded article catalog, then optionally register
 * suppliers. No gating — configuration is optional.
 */
import { StyleSheet, View } from 'react-native';
import { tokens } from '@/theme';
import { getCategoryConfig } from '@/constants/catalogCategories';
import { useWizard } from '@/onboarding/wizardContext';
import { useCreateSupplierMutation, useGetSuppliersQuery } from '@/store/api/suppliersApi';
import { ManagedCatalogList } from '../ManagedCatalogList';
import { QuickAddList } from '../QuickAddList';
import { StepScaffold } from '../StepScaffold';

export function StockStep() {
  const { farmId } = useWizard();
  const config = getCategoryConfig('stock');
  const { data: suppliers } = useGetSuppliersQuery(
    { farmId: farmId ?? 0 },
    { skip: farmId == null },
  );
  const [createSupplier, { isLoading }] = useCreateSupplierMutation();

  return (
    <StepScaffold
      eyebrow="Étape 4 · Stock"
      title="Configurez votre stock"
      subtitle="Gardez les articles qui vous conviennent, retirez les autres, ajoutez les vôtres — puis vos fournisseurs."
    >
      {farmId != null && config ? (
        <View style={styles.sections}>
          <ManagedCatalogList farmId={farmId} config={config} />
          <QuickAddList
            title="Vos fournisseurs"
            hint="Ajoutez vos fournisseurs d'aliments et d'intrants (optionnel)."
            items={(suppliers ?? []).map((s) => ({ id: s.id, primary: s.commercialName, secondary: s.phone ?? undefined }))}
            fields={[
              { name: 'commercialName', placeholder: 'Nom du fournisseur', kind: 'text', required: true },
              { name: 'phone', placeholder: 'Téléphone', kind: 'text' },
            ]}
            adding={isLoading}
            onAdd={async (v) => {
              await createSupplier({
                farmId,
                body: { commercialName: (v.commercialName ?? '').trim(), phone: v.phone?.trim() || undefined },
              }).unwrap();
            }}
          />
        </View>
      ) : null}
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  sections: { gap: tokens.spacing[4] },
});
