/**
 * Commercial: keep/remove/add the seeded sales-channel catalog, then register
 * first clients. No gating.
 */
import { StyleSheet, View } from 'react-native';
import { tokens } from '@/theme';
import { getCategoryConfig } from '@/constants/catalogCategories';
import { useWizard } from '@/onboarding/wizardContext';
import { useCreateClientMutation, useGetClientsQuery } from '@/store/api/clientsApi';
import { ManagedCatalogList } from '../ManagedCatalogList';
import { QuickAddList } from '../QuickAddList';
import { StepScaffold } from '../StepScaffold';

const CLIENT_TYPES = [
  { value: 'INDIVIDUAL', label: 'Particulier' },
  { value: 'BUSINESS', label: 'Entreprise' },
  { value: 'WHOLESALER', label: 'Grossiste' },
] as const;

export function CommercialStep() {
  const { farmId } = useWizard();
  const config = getCategoryConfig('ventes');
  const { data: clients } = useGetClientsQuery(
    { farmId: farmId ?? 0 },
    { skip: farmId == null },
  );
  const [createClient, { isLoading }] = useCreateClientMutation();

  return (
    <StepScaffold
      eyebrow="Étape 5 · Commercial"
      title="Configurez votre commercial"
      subtitle="Gardez les circuits de vente utiles, ajoutez les vôtres — puis enregistrez vos premiers clients."
    >
      {farmId != null && config ? (
        <View style={styles.sections}>
          <ManagedCatalogList farmId={farmId} config={config} />
          <QuickAddList
            title="Vos clients"
            hint="Enregistrez vos premiers clients pour vendre plus vite (optionnel)."
            items={(clients ?? []).map((c) => ({
              id: c.id,
              primary: c.displayName,
              secondary: CLIENT_TYPES.find((t) => t.value === c.clientType)?.label,
            }))}
            fields={[
              { name: 'displayName', placeholder: 'Nom du client', kind: 'text', required: true },
              { name: 'clientType', placeholder: 'Type', kind: 'select', options: CLIENT_TYPES.map((t) => ({ ...t })) },
              { name: 'phone', placeholder: 'Téléphone', kind: 'text' },
            ]}
            adding={isLoading}
            onAdd={async (v) => {
              await createClient({
                farmId,
                body: {
                  displayName: (v.displayName ?? '').trim(),
                  clientType: (v.clientType || 'INDIVIDUAL') as 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALER',
                  phone: v.phone?.trim() || undefined,
                },
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
