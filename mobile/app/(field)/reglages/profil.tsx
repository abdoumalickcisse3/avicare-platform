/**
 * Mon profil — the signed-in user edits their own name and WhatsApp phone
 * (Sprint C1 follow-up). The phone feeds WhatsApp alerts; without it, WhatsApp
 * notifications can't be delivered. Backend: GET/PUT /api/v1/account/profile.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import {
  useChangePasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
} from '@/store/api/authApi';
import { clearTokens } from '@/auth/tokens';

export default function ProfilScreen() {
  const router = useRouter();
  const { data: profile } = useGetProfileQuery();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: changingPassword }] = useChangePasswordMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const save = async () => {
    if (!fullName.trim()) {
      Alert.alert('Nom requis', 'Merci de renseigner votre nom.');
      return;
    }
    try {
      await updateProfile({ fullName: fullName.trim(), phone: phone.trim() || undefined }).unwrap();
      Alert.alert('Profil mis à jour');
    } catch {
      Alert.alert('Erreur', "La mise à jour a échoué. Réessayez.");
    }
  };

  const submitPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Mot de passe trop court', 'Huit caractères au minimum.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Confirmation différente', 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      // The server revoked every refresh token, this one included: staying would leave the app
      // running on a session that can no longer be renewed.
      await clearTokens();
      Alert.alert('Mot de passe modifié', 'Reconnectez-vous avec le nouveau mot de passe.');
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Échec', "Mot de passe actuel incorrect, ou nouveau mot de passe identique à l'ancien.");
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
        <Text style={styles.title}>Mon profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.readonly}>{profile?.email ?? '—'}</Text>

        <Text style={styles.label}>Nom complet</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
          placeholder="Votre nom"
          placeholderTextColor={tokens.colors.field.textMuted}
          accessibilityLabel="Nom complet"
        />

        <Text style={styles.label}>Téléphone (WhatsApp)</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          placeholder="221770000000"
          placeholderTextColor={tokens.colors.field.textMuted}
          keyboardType="phone-pad"
          accessibilityLabel="Téléphone"
        />
        <Text style={styles.hint}>
          Alertes WhatsApp — et seule façon de récupérer un mot de passe perdu. Format :
          221XXXXXXXXX.
        </Text>

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>Mot de passe</Text>
        <Text style={styles.label}>Mot de passe actuel</Text>
        <TextInput
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={styles.input}
          secureTextEntry
          autoComplete="current-password"
          accessibilityLabel="Mot de passe actuel"
        />
        <Text style={styles.label}>Nouveau mot de passe</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Nouveau mot de passe"
        />
        <Text style={styles.label}>Confirmer</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Confirmer le nouveau mot de passe"
        />
        <Text style={styles.hint}>
          Toutes vos sessions seront fermées, y compris celle-ci. Vous devrez vous reconnecter.
        </Text>
        <Pressable
          onPress={submitPassword}
          disabled={changingPassword || !currentPassword || !newPassword}
          style={[
            styles.passwordBtn,
            (changingPassword || !currentPassword || !newPassword) && styles.saveBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Changer mon mot de passe"
        >
          <Text style={styles.saveText}>
            {changingPassword ? 'Modification…' : 'Changer mon mot de passe'}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={save}
          disabled={isLoading}
          style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
        >
          <Text style={styles.saveText}>{isLoading ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  separator: {
    height: 1,
    backgroundColor: tokens.colors.neutral[200],
    marginVertical: tokens.spacing[5],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.field.text,
    marginBottom: tokens.spacing[2],
  },
  passwordBtn: {
    marginTop: tokens.spacing[4],
    backgroundColor: tokens.colors.field.text,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing[4],
    alignItems: 'center',
  },
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
  label: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[4],
    marginBottom: tokens.spacing[1],
  },
  readonly: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, fontWeight: '600' },
  input: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.text,
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
  },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  footer: {
    padding: tokens.layout.screenPadding,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  saveBtn: {
    backgroundColor: tokens.colors.primary[600],
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing[3],
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.neutral[0] },
});
