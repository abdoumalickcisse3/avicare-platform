"use client";

import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Plus, Truck, Users } from "lucide-react";
import { colors, radii } from "@/theme/tokens";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  useCreateSupplierMutation,
  useGetSuppliersQuery,
} from "@/store/api/suppliersApi";
import {
  useCreateClientMutation,
  useGetClientsQuery,
} from "@/store/api/clientsApi";
import type { ClientType } from "@/types";

/** Shared card shell for a quick-add section. */
function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Truck;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        bgcolor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: `${radii.lg}px`,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5 }}>
        <Box sx={{ color: colors.primary[600], display: "flex" }}>
          <Icon size={18} />
        </Box>
        <Typography sx={{ fontWeight: 700, color: colors.neutral[800] }}>{title}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 13, color: colors.neutral[500], mb: 2 }}>{hint}</Typography>
      {children}
    </Box>
  );
}

function EntityRow({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.5,
        py: 1,
        bgcolor: colors.neutral[50],
        borderRadius: `${radii.md}px`,
      }}
    >
      <Typography sx={{ fontWeight: 600, color: colors.neutral[800] }}>{primary}</Typography>
      {secondary && (
        <Typography sx={{ fontSize: 13, color: colors.neutral[500] }}>{secondary}</Typography>
      )}
    </Stack>
  );
}

/** Optional suppliers — quick-add for the Stock step. */
export function SupplierQuickAdd({ farmId }: { farmId: number }) {
  const { showToast } = useToast();
  const { data: suppliers } = useGetSuppliersQuery({ farmId });
  const [createSupplier, { isLoading }] = useCreateSupplierMutation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createSupplier({
        farmId,
        body: { commercialName: name.trim(), phone: phone.trim() || undefined },
      }).unwrap();
      setName("");
      setPhone("");
    } catch {
      showToast("Ajout du fournisseur impossible.", "error");
    }
  };

  return (
    <SectionCard
      icon={Truck}
      title="Vos fournisseurs"
      hint="Ajoutez vos fournisseurs d'aliments et d'intrants (optionnel)."
    >
      <Stack spacing={1.5}>
        {(suppliers ?? []).map((s) => (
          <EntityRow key={s.id} primary={s.commercialName} secondary={s.phone ?? undefined} />
        ))}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du fournisseur"
            size="small"
            fullWidth
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <TextField
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone"
            size="small"
            sx={{ width: { xs: "100%", sm: 160 } }}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <AddButton onClick={add} disabled={!name.trim() || isLoading} loading={isLoading} />
        </Stack>
      </Stack>
    </SectionCard>
  );
}

const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "INDIVIDUAL", label: "Particulier" },
  { value: "BUSINESS", label: "Entreprise" },
  { value: "WHOLESALER", label: "Grossiste" },
];

/** Clients — quick-add for the Commercial step. */
export function ClientQuickAdd({ farmId }: { farmId: number }) {
  const { showToast } = useToast();
  const { data: clients } = useGetClientsQuery({ farmId });
  const [createClient, { isLoading }] = useCreateClientMutation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<ClientType>("INDIVIDUAL");

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createClient({
        farmId,
        body: { displayName: name.trim(), clientType: type, phone: phone.trim() || undefined },
      }).unwrap();
      setName("");
      setPhone("");
      setType("INDIVIDUAL");
    } catch {
      showToast("Ajout du client impossible.", "error");
    }
  };

  return (
    <SectionCard
      icon={Users}
      title="Vos clients"
      hint="Enregistrez vos premiers clients pour vendre plus vite (optionnel)."
    >
      <Stack spacing={1.5}>
        {(clients ?? []).map((c) => (
          <EntityRow
            key={c.id}
            primary={c.displayName}
            secondary={CLIENT_TYPES.find((t) => t.value === c.clientType)?.label}
          />
        ))}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du client"
            size="small"
            fullWidth
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <TextField
            select
            value={type}
            onChange={(e) => setType(e.target.value as ClientType)}
            size="small"
            sx={{ width: { xs: "100%", sm: 150 } }}
          >
            {CLIENT_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone"
            size="small"
            sx={{ width: { xs: "100%", sm: 140 } }}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <AddButton onClick={add} disabled={!name.trim() || isLoading} loading={isLoading} />
        </Stack>
      </Stack>
    </SectionCard>
  );
}

function AddButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Plus size={16} />}
      sx={{
        flexShrink: 0,
        bgcolor: colors.primary[600],
        color: colors.neutral[0],
        fontWeight: 700,
        px: 2,
        "&:hover": { bgcolor: colors.primary[700] },
        "&.Mui-disabled": { bgcolor: colors.neutral[200], color: colors.neutral[400] },
      }}
    >
      Ajouter
    </Button>
  );
}
