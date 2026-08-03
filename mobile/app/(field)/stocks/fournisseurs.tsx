/**
 * Fournisseurs — the suppliers directory, mirroring the web `/stocks/fournisseurs`
 * (same `getSuppliers`/`createSupplier`). List + add a supplier (commercial name
 * + phone). Edit/delete stay web-side for now. `inventory:write` gates adding.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Phone, Plus, Truck } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useCreateSupplierMutation, useGetSuppliersQuery } from '@/store/api/suppliersApi';

export default function FournisseursScreen() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: suppliers, isLoading } = useGetSuppliersQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const [createSupplier, { isLoading: saving }] = useCreateSupplierMutation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await createSupplier({ farmId: selectedFarmId, body: { commercialName: name.trim(), phone: phone.trim() || undefined } }).unwrap();
      setName('');
      setPhone('');
      setSheetOpen(false);
    } catch {
      Alert.alert('Fournisseur', "Le fournisseur n’a pas pu être ajouté. Réessayez.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Fournisseurs</Text>
          <Text style={styles.subtitle}>{suppliers?.length ?? 0} fournisseur(s)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (suppliers ?? []).length === 0 ? (
          <Text style={styles.muted}>Aucun fournisseur.</Text>
        ) : (
          <View style={styles.list}>
            {(suppliers ?? []).map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.avatar}>
                  <Truck size={18} color={tokens.colors.primary[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.commercialName}</Text>
                  {s.phone ? (
                    <View style={styles.phoneRow}>
                      <Phone size={12} color={tokens.colors.field.textMuted} />
                      <Text style={styles.phone}>{s.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {canWrite && (
        <Pressable accessibilityRole="button" accessibilityLabel="Ajouter un fournisseur" onPress={() => setSheetOpen(true)} style={styles.fab}>
          <Plus size={24} color={tokens.colors.primary[900]} />
        </Pressable>
      )}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Nouveau fournisseur</Text>
          <Text style={styles.fieldLabel}>Nom commercial *</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Ex. Sénégal Aliments" accessibilityLabel="Nom commercial" style={styles.input} />
          <Text style={styles.fieldLabel}>Téléphone</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="Optionnel" keyboardType="phone-pad" accessibilityLabel="Téléphone" style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel="Enregistrer le fournisseur" onPress={submit} disabled={!name.trim() || saving} style={[styles.commit, (!name.trim() || saving) && styles.commitDisabled]}>
            <Text style={styles.commitLabel}>Enregistrer</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[2] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  list: { gap: tokens.spacing[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4] },
  avatar: { width: 40, height: 40, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  name: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  phone: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },

  fab: { position: 'absolute', right: tokens.layout.screenPadding, bottom: tokens.spacing[6], width: 56, height: 56, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', shadowColor: tokens.colors.primary[900], shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: { backgroundColor: tokens.colors.neutral[0], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8], gap: tokens.spacing[2] },
  sheetTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  input: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[3] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
