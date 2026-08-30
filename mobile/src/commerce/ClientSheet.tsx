/**
 * Create or edit a commercial client.
 *
 * Like `PUT /farms/{id}`, `PUT /commercial/clients/{id}` is a REPLACEMENT: `ClientService.apply`
 * reassigns every column from the command. A form that submits only the fields it showed writes
 * null over the rest — so this sheet carries every erasable field, and the ones it does not put
 * on screen are still round-tripped from the loaded client.
 *
 * The credit limit deserves a word. The backend computes `overLimit` and exposes it, and never
 * blocks a sale on it (Décision D26). The helper text says so, because a farmer typing a limit is
 * entitled to know whether the app will stop them at it. It will not.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { Chip } from '@/team/Chip';
import { CLIENT_TYPE_LABELS } from '@/lib/commercial';
import type { ClientInput } from '@/store/api/clientsApi';
import type { Client, ClientType } from '@/types';

const TYPES: ClientType[] = ['INDIVIDUAL', 'BUSINESS', 'WHOLESALER'];
const digits = (s: string) => s.replace(/[^\d]/g, '');

export function ClientSheet({
  open,
  client,
  saving,
  onClose,
  onSubmit,
  onDeactivate,
}: {
  open: boolean;
  /** The client being edited, or null to create one. */
  client: Client | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: ClientInput) => void;
  onDeactivate?: () => void;
}) {
  const [clientType, setClientType] = useState<ClientType>('INDIVIDUAL');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientType(client?.clientType ?? 'INDIVIDUAL');
    setDisplayName(client?.displayName ?? '');
    setPhone(client?.phone ?? '');
    setCity(client?.city ?? '');
    setCreditLimit(client?.creditLimitXof != null ? String(client.creditLimitXof) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  const canSubmit = displayName.trim().length > 0 && !saving;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      clientType,
      displayName: displayName.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      creditLimitXof: creditLimit ? Number(creditLimit) : null,
      // Not editable on a phone, and a PUT would erase them.
      legalName: client?.legalName ?? null,
      email: client?.email ?? null,
      address: client?.address ?? null,
      defaultPaymentTerms: client?.defaultPaymentTerms ?? null,
      notes: client?.notes ?? null,
    });
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{client ? 'Modifier le client' : 'Nouveau client'}</Text>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chips}>
              {TYPES.map((t) => (
                <Chip
                  key={t}
                  label={CLIENT_TYPE_LABELS[t] ?? t}
                  active={clientType === t}
                  accessibilityLabel={`Type ${CLIENT_TYPE_LABELS[t] ?? t}`}
                  onPress={() => setClientType(t)}
                />
              ))}
            </View>
          </View>

          <FormField
            label="Nom"
            required
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Boutique Fatou"
            maxLength={200}
          />
          <FormField
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="77 000 00 00"
            maxLength={30}
            helperText="Le numéro que vous composerez pour relancer une facture."
          />
          <FormField
            label="Ville"
            value={city}
            onChangeText={setCity}
            placeholder="Thiès"
            maxLength={120}
          />
          <FormField
            label="Plafond de crédit (F)"
            value={creditLimit}
            onChangeText={(t) => setCreditLimit(digits(t))}
            keyboardType="number-pad"
            placeholder="200000"
            helperText="Indicatif : l'application signale le dépassement, elle ne bloque pas la vente."
          />

          {client && onDeactivate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retirer ce client"
              onPress={() =>
                Alert.alert(
                  `Retirer ${client.displayName} ?`,
                  "Le client sort de l'annuaire. Ses factures, ses paiements et son encours restent dans la comptabilité.",
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Retirer', style: 'destructive', onPress: onDeactivate },
                  ],
                )
              }
              style={styles.dangerBtn}
            >
              <Text style={styles.dangerText}>Retirer de l&apos;annuaire</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={client ? 'Enregistrer le client' : 'Créer le client'}
            style={[styles.save, !canSubmit && styles.disabled]}
          >
            <Text style={styles.saveText}>
              {saving ? 'Enregistrement…' : client ? 'Enregistrer' : 'Créer le client'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  sheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[5],
    maxHeight: '90%',
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[2],
  },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[2],
  },
  dangerBtn: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.danger.border,
    marginTop: tokens.spacing[2],
  },
  dangerText: { ...tokens.typography.button, color: tokens.colors.action.danger.border },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[6],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
  },
  cancel: {
    minHeight: tokens.touch.primaryButton,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[6],
  },
  cancelText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
  save: {
    flex: 1,
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
