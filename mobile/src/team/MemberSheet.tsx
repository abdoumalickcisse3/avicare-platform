/**
 * Add or edit a member — the mobile counterpart of the web `AddMemberDialog` + `EditMemberDialog`,
 * merged, because on a phone the difference between them is which fields are editable.
 *
 * Two backend facts shape it:
 *
 * - OWNER cannot be assigned (422 OWNER_NOT_ASSIGNABLE), so it is not in the picker.
 * - `PUT` resets permissions to the role's defaults when they are omitted. The sheet therefore
 *   always submits the matrix explicitly, and reseeds it when the role changes — a role change
 *   that silently kept the previous role's custom grants would be the more surprising behaviour.
 *
 * Identity (name, e-mail, phone) is not editable here: the endpoint does not accept it. Showing
 * greyed-out fields would suggest otherwise, so edit mode states who the member is instead.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { FARM_ROLE_LABELS } from '@/lib/members';
import { Chip } from './Chip';
import { PermissionMatrix } from './PermissionMatrix';
import { expandPermissions, matchesRoleDefaults } from './permissions';
import type { AssignableFarmRole, Member, PermissionCatalog } from '@/types';

const ASSIGNABLE: AssignableFarmRole[] = ['MANAGER', 'FARMER', 'VETERINARIAN', 'BUYER'];

/** What each role is for, in the words of someone running a farm rather than a permission table. */
const ROLE_HINTS: Record<AssignableFarmRole, string> = {
  MANAGER: 'Gère tout au quotidien, sauf la facturation avancée.',
  FARMER: 'Saisit sur le terrain : mortalité, pesées, ponte, soins.',
  VETERINARIAN: 'Intervient sur le sanitaire, consulte les lots.',
  BUYER: 'Consulte ses commandes et ses factures.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MemberSheetProps = {
  open: boolean;
  /** The member being edited, or null to add one. */
  member: Member | null;
  catalog: PermissionCatalog | undefined;
  saving: boolean;
  onClose: () => void;
  onCreate: (body: {
    fullName: string;
    email: string;
    phone?: string;
    role: AssignableFarmRole;
    permissions: string[];
  }) => void;
  onUpdate: (body: { role: AssignableFarmRole; permissions: string[] }) => void;
  onResetPassword: () => void;
  onToggleActive: (active: boolean) => void;
};

export function MemberSheet({
  open,
  member,
  catalog,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onResetPassword,
  onToggleActive,
}: MemberSheetProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AssignableFarmRole>('FARMER');
  const [customize, setCustomize] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [touchedRole, setTouchedRole] = useState(false);

  // Edge-triggered on opening: a refetch behind the sheet must never overwrite what is typed.
  useEffect(() => {
    if (!open) return;
    setFullName('');
    setEmail('');
    setPhone('');
    setTouchedRole(false);
    const initialRole: AssignableFarmRole =
      member && member.role !== 'OWNER' ? (member.role as AssignableFarmRole) : 'FARMER';
    setRole(initialRole);
    const initial = member?.permissions ?? catalog?.roleDefaults[initialRole] ?? [];
    setPermissions(initial);
    setCustomize(
      member != null && catalog != null
        ? !matchesRoleDefaults(expandPermissions(initial, catalog), initialRole, catalog)
        : false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.userId]);

  const pickRole = (next: AssignableFarmRole) => {
    setRole(next);
    setTouchedRole(true);
    setPermissions(catalog?.roleDefaults[next] ?? []);
    setCustomize(false);
  };

  const selected = catalog ? expandPermissions(permissions, catalog) : new Set<string>();
  const emailValid = EMAIL.test(email.trim());
  const canSubmit = member
    ? !saving
    : fullName.trim().length > 0 && emailValid && !saving;

  const submit = () => {
    if (!canSubmit) return;
    const perms = [...selected].sort();
    if (member) {
      onUpdate({ role, permissions: perms });
    } else {
      onCreate({
        fullName: fullName.trim(),
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        role,
        permissions: perms,
      });
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{member ? member.fullName : 'Nouveau membre'}</Text>
        {member ? <Text style={styles.subtitle}>{member.email}</Text> : null}

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!member && (
            <>
              <FormField
                label="Nom complet"
                required
                value={fullName}
                onChangeText={setFullName}
                placeholder="Awa Ndiaye"
                maxLength={200}
              />
              <FormField
                label="Adresse e-mail"
                required
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="awa@exemple.sn"
                error={email.length > 0 && !emailValid ? 'Adresse e-mail invalide' : undefined}
                helperText="C'est avec elle que le membre se connectera."
              />
              <FormField
                label="Téléphone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="77 000 00 00"
                maxLength={30}
              />
            </>
          )}

          <View>
            <Text style={styles.label}>Rôle</Text>
            <View style={styles.chips}>
              {ASSIGNABLE.map((r) => (
                <Chip
                  key={r}
                  label={FARM_ROLE_LABELS[r]}
                  active={role === r}
                  accessibilityLabel={`Rôle ${FARM_ROLE_LABELS[r]}`}
                  onPress={() => pickRole(r)}
                />
              ))}
            </View>
            <Text style={styles.hint}>{ROLE_HINTS[role]}</Text>
            {touchedRole && member ? (
              <Text style={styles.hint}>
                Les accès ont été remis à ceux du rôle {FARM_ROLE_LABELS[role]}.
              </Text>
            ) : null}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ajuster les accès</Text>
              <Text style={styles.hint}>
                Sinon, le membre reçoit exactement les accès du rôle.
              </Text>
            </View>
            <Switch
              value={customize}
              onValueChange={setCustomize}
              accessibilityLabel="Ajuster les accès"
              trackColor={{ true: tokens.colors.primary[400], false: tokens.colors.neutral[300] }}
            />
          </View>

          {customize && catalog ? (
            <PermissionMatrix
              catalog={catalog}
              selected={selected}
              onChange={setPermissions}
            />
          ) : null}

          {member ? (
            <View style={styles.dangerZone}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Réinitialiser le mot de passe"
                onPress={onResetPassword}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryText}>Réinitialiser le mot de passe</Text>
              </Pressable>

              {member.active ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retirer ce membre"
                  onPress={() =>
                    Alert.alert(
                      `Retirer ${member.fullName} ?`,
                      "Son accès est coupé à sa prochaine connexion. Il reste dans la liste, marqué inactif, et vous pouvez le réactiver quand vous voulez. Ce qu'il a saisi n'est pas touché.",
                      [
                        { text: 'Annuler', style: 'cancel' },
                        {
                          text: 'Retirer',
                          style: 'destructive',
                          onPress: () => onToggleActive(false),
                        },
                      ],
                    )
                  }
                  style={styles.dangerBtn}
                >
                  <Text style={styles.dangerText}>Retirer de la ferme</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Réactiver ce membre"
                  onPress={() => onToggleActive(true)}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryText}>Réactiver ce membre</Text>
                </Pressable>
              )}
            </View>
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
            accessibilityLabel={member ? 'Enregistrer les accès' : 'Créer le compte'}
            style={[styles.save, !canSubmit && styles.saveDisabled]}
          >
            <Text style={styles.saveText}>
              {saving ? 'Enregistrement…' : member ? 'Enregistrer' : 'Créer le compte'}
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
  },
  subtitle: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    paddingHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[2],
  },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  hint: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    lineHeight: 18,
    marginTop: tokens.spacing[1],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[2],
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  dangerZone: {
    gap: tokens.spacing[2],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
    paddingTop: tokens.spacing[4],
  },
  secondaryBtn: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
  },
  secondaryText: { ...tokens.typography.button, color: tokens.colors.action.secondary.fg },
  dangerBtn: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.danger.border,
  },
  dangerText: {
    ...tokens.typography.button,
    color: tokens.colors.action.danger.border,
    fontFamily: fontFamily.sansSemiBold,
  },
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
  saveDisabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
