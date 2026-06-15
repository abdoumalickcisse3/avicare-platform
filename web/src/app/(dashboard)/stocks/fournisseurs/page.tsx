"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Mail, MoreVertical, Phone, Plus, User } from "lucide-react";
import {
  useDeleteSupplierMutation,
  useGetSuppliersQuery,
} from "@/store/api/suppliersApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { SupplierDialog } from "@/components/inventory/SupplierDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import type { Supplier } from "@/types";

export default function SuppliersPage() {
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const { showToast } = useToast();
  const { data: suppliers, isLoading } = useGetSuppliersQuery(
    { farmId: farmId as number },
    { skip: !hasFarm || !hasInventory },
  );
  const [deleteSupplier] = useDeleteSupplierMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuSupplier, setMenuSupplier] = useState<Supplier | null>(null);

  if (hasFarm && !hasInventory) {
    return <Alert severity="info">Activez le module Inventaire pour gérer les fournisseurs.</Alert>;
  }

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setDialogOpen(true);
    setMenuEl(null);
  };
  const remove = async (s: Supplier) => {
    setMenuEl(null);
    try {
      await deleteSupplier({ farmId: farmId as number, id: s.id }).unwrap();
      showToast("Fournisseur supprimé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Annuaire fournisseurs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Centralisez vos partenaires d&apos;approvisionnement.
          </Typography>
        </Box>
        <Button variant="contained" color="primary" startIcon={<Plus size={18} />} onClick={openCreate} disabled={!hasFarm}>
          Nouveau fournisseur
        </Button>
      </Stack>

      {isLoading && <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />}

      {!isLoading && (suppliers?.length ?? 0) === 0 && (
        <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucun fournisseur
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ajoutez votre premier partenaire pour centraliser vos achats.
          </Typography>
          <Button variant="contained" color="primary" startIcon={<Plus size={18} />} onClick={openCreate}>
            Nouveau fournisseur
          </Button>
        </Box>
      )}

      {!isLoading && (suppliers?.length ?? 0) > 0 && (
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
          }}
        >
          {suppliers!.map((s) => (
            <Card key={s.id}>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {s.commercialName}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Actions"
                    onClick={(e) => {
                      setMenuEl(e.currentTarget);
                      setMenuSupplier(s);
                    }}
                  >
                    <MoreVertical size={18} />
                  </IconButton>
                </Stack>
                <Stack spacing={0.5} sx={{ mt: 1, color: colors.neutral[600], fontSize: 14 }}>
                  {s.contactPerson && (
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <User size={14} /> <span>{s.contactPerson}</span>
                    </Stack>
                  )}
                  {s.phone && (
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Phone size={14} /> <span>{s.phone}</span>
                    </Stack>
                  )}
                  {s.email && (
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Mail size={14} /> <span>{s.email}</span>
                    </Stack>
                  )}
                </Stack>
                {s.types.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: "wrap" }} useFlexGap>
                    {s.types.map((t) => (
                      <Chip key={t} label={t} size="small" variant="outlined" />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        <MenuItem onClick={() => menuSupplier && openEdit(menuSupplier)}>Modifier</MenuItem>
        <MenuItem onClick={() => menuSupplier && remove(menuSupplier)} sx={{ color: colors.error.main }}>
          Supprimer
        </MenuItem>
      </Menu>

      {farmId && (
        <SupplierDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          farmId={farmId}
          supplier={editing}
        />
      )}
    </Box>
  );
}
