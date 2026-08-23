/**
 * Mon réseau (farmer-facing partner surface) — mirrors the web
 * `/reglages/partenaires` page. View partner memberships, adjust the five sharing
 * sliders (operational ON / finances OFF by default), declare a partner from the
 * directory, join by invite code, and leave a network. Reads need farm membership;
 * writes are OWNER / MANAGER (the backend is the authority — the UI hides the
 * controls for other roles). The farmer owns their data and can leave any time.
 */
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Handshake, KeyRound, Search, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import {
  useDeclarePartnerMutation,
  useGetAvailablePartnersQuery,
  useGetMyPartnersQuery,
  useJoinNetworkMutation,
  useLeaveNetworkMutation,
  useUpdateSharingMutation,
} from '@/store/api/partnersApi';
import type { FarmPartner, PartnerType, SharingScopes } from '@/types';

const TYPE_LABEL: Record<PartnerType, string> = {
  FEED_SUPPLIER: 'Provendier',
  VET: 'Vétérinaire',
};

const OPERATIONAL: { key: keyof SharingScopes; label: string }[] = [
  { key: 'activity', label: 'Activité de la ferme' },
  { key: 'flockHealth', label: 'Santé des lots' },
  { key: 'feedConsumption', label: "Consommation d'aliment" },
];
const COMMERCIAL: { key: keyof SharingScopes; label: string }[] = [
  { key: 'salesVolume', label: 'Volumes de vente' },
  { key: 'finances', label: 'Finances' },
];

function scopesOf(p: FarmPartner): SharingScopes {
  return {
    activity: p.shareActivity,
    flockHealth: p.shareFlockHealth,
    feedConsumption: p.shareFeedConsumption,
    salesVolume: p.shareSalesVolume,
    finances: p.shareFinances,
  };
}

function errorStatus(e: unknown): number | undefined {
  return typeof e === 'object' && e !== null && 'status' in e
    ? (e as { status?: number }).status
    : undefined;
}

export default function PartenairesScreen() {
  const router = useRouter();
  const farmId = useSelector(selectSelectedFarmId);
  const { farmRole, isAdmin } = useFarmAccess();
  const canManage = isAdmin || farmRole === 'OWNER' || farmRole === 'MANAGER';

  const { data: mine = [] } = useGetMyPartnersQuery(farmId === null ? skipToken : { farmId });
  const [updateSharing] = useUpdateSharingMutation();
  const [leaveNetwork] = useLeaveNetworkMutation();

  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [leaving, setLeaving] = useState<FarmPartner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<number, SharingScopes>>({});

  if (farmId === null) {
    return <Redirect href="/(field)" />;
  }

  const scopesFor = (p: FarmPartner): SharingScopes => override[p.membershipId] ?? scopesOf(p);

  const toggle = async (p: FarmPartner, key: keyof SharingScopes) => {
    const current = scopesFor(p);
    const next = { ...current, [key]: !current[key] };
    setOverride((o) => ({ ...o, [p.membershipId]: next }));
    try {
      await updateSharing({ farmId, membershipId: p.membershipId, scopes: next }).unwrap();
    } catch {
      setOverride((o) => ({ ...o, [p.membershipId]: current }));
      setError('Impossible de mettre à jour le partage. Réessayez.');
    }
  };

  const confirmLeave = async () => {
    if (!leaving) return;
    try {
      await leaveNetwork({ farmId, membershipId: leaving.membershipId }).unwrap();
      setLeaving(null);
    } catch {
      setError('Impossible de quitter le réseau. Réessayez.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.title}>Mon réseau</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Vos partenaires et ce que vous partagez avec eux. Vous restez propriétaire de vos données
          et pouvez quitter un réseau à tout moment.
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError(null)} accessibilityLabel="Fermer l'erreur" hitSlop={8}>
              <X size={16} color={tokens.colors.errorDark} />
            </Pressable>
          </View>
        )}

        {canManage && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => setJoinOpen(true)}
              style={[styles.actionBtn, styles.actionPrimary]}
              accessibilityRole="button"
              accessibilityLabel="Rejoindre par code"
            >
              <KeyRound size={16} color={tokens.colors.neutral[0]} />
              <Text style={styles.actionPrimaryText}>Rejoindre par code</Text>
            </Pressable>
            <Pressable
              onPress={() => setDirectoryOpen(true)}
              style={[styles.actionBtn, styles.actionOutline]}
              accessibilityRole="button"
              accessibilityLabel="Parcourir les partenaires"
            >
              <Search size={16} color={tokens.colors.primary[700]} />
              <Text style={styles.actionOutlineText}>Parcourir les partenaires</Text>
            </Pressable>
          </View>
        )}

        {mine.length === 0 ? (
          <View style={styles.emptyCard}>
            <Handshake size={40} color={tokens.colors.primary[400]} />
            <Text style={styles.emptyTitle}>Vous ne faites partie d&apos;aucun réseau</Text>
            <Text style={styles.emptyDesc}>
              Rejoignez le réseau d&apos;un partenaire par code d&apos;invitation, ou déclarez votre
              fournisseur depuis l&apos;annuaire.
            </Text>
          </View>
        ) : (
          mine.map((p) => {
            const s = scopesFor(p);
            return (
              <View key={p.membershipId} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partnerName}>{p.partnerName ?? 'Partenaire'}</Text>
                    <View style={styles.badges}>
                      {p.partnerType && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{TYPE_LABEL[p.partnerType]}</Text>
                        </View>
                      )}
                      <View style={[styles.badge, p.status === 'CONFIRMED' && styles.badgeOk]}>
                        <Text
                          style={[styles.badgeText, p.status === 'CONFIRMED' && styles.badgeOkText]}
                        >
                          {p.status === 'CONFIRMED' ? '✓ Confirmé' : '⏳ En attente'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {canManage && (
                    <Pressable
                      onPress={() => setLeaving(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitter ${p.partnerName ?? 'le réseau'}`}
                    >
                      <Text style={styles.leaveText}>Quitter</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={styles.groupLabel}>Opérationnel</Text>
                {OPERATIONAL.map((row) => (
                  <View key={row.key} style={styles.sliderRow}>
                    <Text style={styles.sliderLabel}>{row.label}</Text>
                    <Switch
                      value={s[row.key]}
                      disabled={!canManage}
                      onValueChange={() => toggle(p, row.key)}
                      accessibilityLabel={`${p.membershipId} ${row.key}`}
                    />
                  </View>
                ))}

                <Text style={styles.groupLabel}>Commercial &amp; Finances</Text>
                <Text style={styles.groupHint}>
                  Privé par défaut. N&apos;activez que pour partager vos chiffres.
                </Text>
                {COMMERCIAL.map((row) => (
                  <View key={row.key} style={styles.sliderRow}>
                    <Text style={styles.sliderLabel}>{row.label}</Text>
                    <Switch
                      value={s[row.key]}
                      disabled={!canManage}
                      onValueChange={() => toggle(p, row.key)}
                      accessibilityLabel={`${p.membershipId} ${row.key}`}
                    />
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <DirectoryModal
        farmId={farmId}
        visible={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        onError={setError}
      />
      <JoinModal
        farmId={farmId}
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onError={setError}
      />

      <Modal visible={leaving !== null} transparent animationType="fade" onRequestClose={() => setLeaving(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quitter ce réseau ?</Text>
            <Text style={styles.modalBody}>
              {leaving?.partnerName ?? 'Ce partenaire'} n&apos;aura plus accès à vos données
              partagées. Vous pourrez le rejoindre à nouveau plus tard.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setLeaving(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable onPress={confirmLeave} style={styles.modalDanger} accessibilityLabel="Confirmer quitter">
                <Text style={styles.modalDangerText}>Quitter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DirectoryModal({
  farmId,
  visible,
  onClose,
  onError,
}: {
  farmId: number;
  visible: boolean;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [type, setType] = useState<PartnerType | undefined>(undefined);
  const { data: partners = [] } = useGetAvailablePartnersQuery(
    visible ? { farmId, type } : skipToken,
  );
  const [declarePartner] = useDeclarePartnerMutation();

  const declare = async (partnerId: number) => {
    try {
      await declarePartner({ farmId, partnerId }).unwrap();
      onClose();
    } catch (e) {
      onError(
        errorStatus(e) === 409
          ? 'Vous faites déjà partie de ce réseau.'
          : 'Impossible de déclarer ce partenaire. Réessayez.',
      );
    }
  };

  const FILTERS: { value: PartnerType | undefined; label: string }[] = [
    { value: undefined, label: 'Tous' },
    { value: 'FEED_SUPPLIER', label: 'Provendiers' },
    { value: 'VET', label: 'Vétérinaires' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityLabel="Fermer" hitSlop={8} style={styles.backBtn}>
            <X size={22} color={tokens.colors.field.text} />
          </Pressable>
          <Text style={styles.title}>Partenaires</Text>
        </View>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f.value === type;
            return (
              <Pressable
                key={f.label}
                onPress={() => setType(f.value)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={f.label}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {partners.length === 0 ? (
            <Text style={styles.emptyDesc}>Aucun partenaire disponible pour l&apos;instant.</Text>
          ) : (
            partners.map((p) => (
              <View key={p.id} style={styles.dirRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>{p.name}</Text>
                  <Text style={styles.groupHint}>{TYPE_LABEL[p.type]}</Text>
                </View>
                <Pressable
                  onPress={() => declare(p.id)}
                  style={[styles.actionBtn, styles.actionOutline]}
                  accessibilityLabel={`Déclarer ${p.name}`}
                >
                  <Text style={styles.actionOutlineText}>Déclarer</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function JoinModal({
  farmId,
  visible,
  onClose,
  onError,
}: {
  farmId: number;
  visible: boolean;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [code, setCode] = useState('');
  const [joinNetwork, { isLoading }] = useJoinNetworkMutation();

  const submit = async () => {
    try {
      await joinNetwork({ farmId, code: code.trim() }).unwrap();
      setCode('');
      onClose();
    } catch (e) {
      onError(
        errorStatus(e) === 422
          ? 'Code invalide, expiré ou épuisé.'
          : errorStatus(e) === 409
            ? 'Vous faites déjà partie de ce réseau.'
            : 'Impossible de rejoindre le réseau. Réessayez.',
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Rejoindre par code</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Code d'invitation"
            autoCapitalize="characters"
            style={styles.input}
            accessibilityLabel="Code d'invitation"
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={isLoading || code.trim().length === 0}
              style={[styles.modalDanger, styles.modalPrimary, (isLoading || !code.trim()) && styles.disabled]}
              accessibilityLabel="Rejoindre"
            >
              <Text style={styles.modalDangerText}>Rejoindre</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[2],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[16] },
  subtitle: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    marginBottom: tokens.spacing[3],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
    backgroundColor: tokens.colors.errorLight,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing[3],
    marginBottom: tokens.spacing[3],
  },
  errorText: { ...tokens.typography.bodySm, color: tokens.colors.errorDark, flex: 1 },
  actions: { gap: tokens.spacing[2], marginBottom: tokens.spacing[4] },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing[3],
  },
  actionPrimary: { backgroundColor: tokens.colors.primary[600] },
  actionPrimaryText: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.neutral[0] },
  actionOutline: {
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.primary[300],
  },
  actionOutlineText: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.primary[700] },
  emptyCard: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[6],
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  emptyTitle: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text, textAlign: 'center' },
  emptyDesc: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    marginBottom: tokens.spacing[3],
    gap: tokens.spacing[1],
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: tokens.spacing[2] },
  partnerName: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  badges: { flexDirection: 'row', gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  badge: {
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 2,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.neutral[100],
  },
  badgeText: { ...tokens.typography.bodySm, fontSize: 12, color: tokens.colors.field.textMuted },
  badgeOk: { backgroundColor: tokens.colors.primary[50] },
  badgeOkText: { color: tokens.colors.primary[700], fontWeight: '700' },
  leaveText: { ...tokens.typography.bodySm, color: tokens.colors.errorDark, fontWeight: '700' },
  groupLabel: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.field.text, marginTop: tokens.spacing[2] },
  groupHint: { ...tokens.typography.bodySm, fontSize: 12, color: tokens.colors.field.textMuted },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  filterRow: { flexDirection: 'row', gap: tokens.spacing[2], paddingHorizontal: tokens.layout.screenPadding, marginBottom: tokens.spacing[3] },
  chip: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[50],
  },
  chipActive: { backgroundColor: tokens.colors.primary[50], borderColor: tokens.colors.primary[300] },
  chipText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  chipTextActive: { color: tokens.colors.primary[700], fontWeight: '700' },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[100],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing[6],
  },
  modalCard: {
    width: '100%',
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing[5],
    gap: tokens.spacing[3],
  },
  modalTitle: { ...tokens.typography.headingMd, fontSize: 18, color: tokens.colors.field.text },
  modalBody: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2], marginTop: tokens.spacing[2] },
  modalCancel: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2] },
  modalCancelText: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.field.textMuted },
  modalDanger: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.error,
  },
  modalPrimary: { backgroundColor: tokens.colors.primary[600] },
  modalDangerText: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.neutral[0] },
  disabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.text,
  },
});
