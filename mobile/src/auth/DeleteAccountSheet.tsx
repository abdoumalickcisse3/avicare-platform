/**
 * Fermer son compte, depuis l'app.
 *
 * Exigé par la règle 5.1.1(v) de l'App Store : une app qui permet de créer un compte doit
 * permettre de le supprimer sans la quitter — ni par courriel, ni par le support.
 *
 * L'écran a une seule responsabilité qui compte : **dire ce qui disparaît avant de le demander.**
 * Supprimer le compte d'un propriétaire efface ses fermes et tout ce qui en dépend — bandes,
 * ventes, factures, dépenses — et retire l'accès aux autres membres. C'est une décision produit
 * assumée, et la plus lourde du produit ; l'annoncer vaguement reviendrait à la cacher.
 *
 * Deux garde-fous, tous deux délibérés : le mot de passe est redemandé (un jeton de session suffit
 * à consulter, pas à détruire — un téléphone posé déverrouillé sur une table est le cas ordinaire),
 * et le mot SUPPRIMER est retapé, parce qu'une case à cocher se coche par réflexe.
 */
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useDeleteAccountMutation, useGetDeletionPreviewQuery } from '@/store/api/authApi';
import { apiErrorMessage } from '@/lib/apiError';
import { signOut } from '@/auth/signOut';
import { tokens } from '@/theme';

/** Le mot à retaper. En français, en majuscules : il ne se tape pas par distraction. */
const CONFIRMATION = 'SUPPRIMER';

export function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // `skip` tant que la feuille est fermée : inutile d'interroger le serveur sur une suppression
  // que personne n'a encore envisagée.
  const { data: preview, isLoading: loadingPreview } = useGetDeletionPreviewQuery(undefined, {
    skip: !open,
  });
  const [deleteAccount, { isLoading: deleting }] = useDeleteAccountMutation();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ownedFarms = preview?.ownedFarmCount ?? 0;
  const canSubmit =
    password.length > 0 && confirmation.trim().toUpperCase() === CONFIRMATION && !deleting;

  const close = () => {
    setPassword('');
    setConfirmation('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await deleteAccount({ password }).unwrap();
      // Le compte n'existe plus : on ne revient pas à l'écran précédent, on quitte la session.
      await signOut();
    } catch (e) {
      setError(apiErrorMessage(e, "Le compte n'a pas pu être supprimé. Réessayez."));
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={close} />
      <View style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <AlertTriangle size={22} color={tokens.colors.error} />
            <Text style={styles.title}>Supprimer mon compte</Text>
          </View>

          <Text style={styles.body}>
            Cette action est <Text style={styles.strong}>définitive</Text>. Personne ne peut la
            remonter, nous non plus.
          </Text>

          {loadingPreview ? (
            <ActivityIndicator style={{ marginVertical: tokens.spacing[4] }} />
          ) : (
            <View style={styles.impact}>
              <Text style={styles.impactTitle}>Ce qui sera effacé</Text>
              {ownedFarms > 0 ? (
                <>
                  <Text style={styles.impactLine}>
                    • {ownedFarms === 1 ? 'Votre ferme' : `Vos ${ownedFarms} fermes`} et tout ce
                    qu&apos;{ownedFarms === 1 ? 'elle contient' : 'elles contiennent'} :{' '}
                    <Text style={styles.strong}>
                      bandes, ventes, factures, dépenses, historique complet
                    </Text>
                    .
                  </Text>
                  {/* Le point le plus grave, et celui qu'on oublie : d'autres personnes
                      travaillent peut-être sur cette ferme. */}
                  <Text style={styles.impactLine}>
                    • L&apos;accès de <Text style={styles.strong}>tous les autres membres</Text> de
                    {ownedFarms === 1 ? ' cette ferme' : ' ces fermes'} — gérant, ouvriers,
                    vétérinaire.
                  </Text>
                </>
              ) : (
                <Text style={styles.impactLine}>
                  • Votre compte et votre accès aux fermes dont vous êtes membre. Ces fermes ne vous
                  appartenant pas, <Text style={styles.strong}>elles ne sont pas supprimées</Text>.
                </Text>
              )}
              <Text style={styles.impactLine}>• Vos informations personnelles.</Text>
            </View>
          )}

          {ownedFarms > 0 && (
            <Text style={styles.advice}>
              Si quelqu&apos;un doit reprendre {ownedFarms === 1 ? 'la ferme' : 'les fermes'},
              transférez la propriété avant de supprimer votre compte.
            </Text>
          )}

          <Text style={styles.fieldLabel}>Votre mot de passe</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel="Mot de passe"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>
            Tapez <Text style={styles.strong}>{CONFIRMATION}</Text> pour confirmer
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Confirmation"
            style={styles.input}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Supprimer définitivement mon compte"
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.destroy, !canSubmit && styles.destroyDisabled]}
          >
            <Text style={styles.destroyLabel}>
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </Text>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel="Annuler" onPress={close} style={styles.cancel}>
            <Text style={styles.cancelLabel}>Annuler</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    padding: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  body: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  strong: { fontWeight: '700', color: tokens.colors.field.text },
  impact: {
    backgroundColor: '#FEE2E2',
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing[3],
    marginTop: tokens.spacing[3],
    gap: tokens.spacing[1],
  },
  impactTitle: {
    ...tokens.typography.bodySm,
    fontWeight: '700',
    color: '#7F1D1D',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  impactLine: { ...tokens.typography.bodySm, color: '#7F1D1D' },
  advice: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[3],
    fontStyle: 'italic',
  },
  fieldLabel: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[4],
    marginBottom: tokens.spacing[1],
  },
  input: {
    minHeight: 46,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
    color: tokens.colors.field.text,
    ...tokens.typography.bodyMd,
  },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error, marginTop: tokens.spacing[3] },
  destroy: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[5],
  },
  destroyDisabled: { opacity: 0.4 },
  destroyLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
  cancel: { alignItems: 'center', paddingVertical: tokens.spacing[4] },
  cancelLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
});
