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
import { useGetProfileQuery, useUpdateProfileMutation } from '@/store/api/authApi';

export default function ProfilScreen() {
  const router = useRouter();
  const { data: profile } = useGetProfileQuery();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

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
        <Text style={styles.hint}>Utilisé pour les alertes WhatsApp. Format : 221XXXXXXXXX.</Text>
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
