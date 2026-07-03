"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { CategoryConfig, FieldDescriptor } from "@/constants/catalogCategories";
import type { CatalogEntry } from "@/store/api/catalogApi";
import { useGetCatalogQuery, useDeleteCatalogEntryMutation } from "@/store/api/catalogApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { CatalogEntryDialog } from "./CatalogEntryDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";

/** Render a field's display value (option label for selects, raw string otherwise). */
function displayValue(field: FieldDescriptor, value: Record<string, unknown>): string {
  const raw = value[field.name];
  if (raw == null) return "—";
  if (field.type === "select") {
    return field.options?.find((o) => o.value === raw)?.label ?? String(raw);
  }
  return String(raw);
}

export function CatalogManager({ config, farmId }: { config: CategoryConfig; farmId: number }) {
  const { data: entries, isLoading, error } = useGetCatalogQuery({
    farmId,
    category: config.backendCategory,
  });
  const [deleteEntry, { isLoading: deleting }] = useDeleteCatalogEntryMutation();
  const { showToast } = useToast();
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);

  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CatalogEntry | null>(null);
  const [toRemove, setToRemove] = useState<CatalogEntry | null>(null);

  // Columns: the label field first, then the other non-const fields.
  const columns = config.fields.filter((f) => f.const === undefined);

  const handleRemove = async () => {
    if (!toRemove) return;
    try {
      await deleteEntry({ farmId, category: config.backendCategory, key: toRemove.key }).unwrap();
      showToast(toRemove.custom ? "Entrée supprimée." : "Entrée désactivée.", "success");
      setToRemove(null);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {config.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {config.description}
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setAddOpen(true)}
          >
            Ajouter
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />}

      {!isLoading && !error && entries && entries.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Aucune entrée. Ajoutez la première.
        </Typography>
      )}

      {!isLoading && !error && entries && entries.length > 0 && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.name}>{c.label}</TableCell>
                ))}
                <TableCell>Origine</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => {
                const name = String(entry.value[config.labelField] ?? entry.key);
                return (
                  <TableRow key={entry.key} hover>
                    {columns.map((c) => (
                      <TableCell key={c.name}>{displayValue(c, entry.value)}</TableCell>
                    ))}
                    <TableCell>
                      <Chip
                        label={entry.custom ? "Personnalisé" : "Plateforme"}
                        size="small"
                        sx={{
                          bgcolor: entry.custom ? colors.accent[50] : colors.primary[50],
                          color: entry.custom ? colors.accent[700] : colors.primary[700],
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <IconButton
                          aria-label={`Modifier ${name}`}
                          onClick={() => setEditEntry(entry)}
                          size="small"
                        >
                          <Pencil size={18} />
                        </IconButton>
                        <IconButton
                          aria-label={`${entry.custom ? "Supprimer" : "Désactiver"} ${name}`}
                          onClick={() => setToRemove(entry)}
                          size="small"
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {canManage && (
        <CatalogEntryDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          config={config}
          farmId={farmId}
        />
      )}
      {canManage && editEntry && (
        <CatalogEntryDialog
          open
          onClose={() => setEditEntry(null)}
          config={config}
          farmId={farmId}
          entry={editEntry}
        />
      )}
      <ConfirmDialog
        open={Boolean(toRemove)}
        title={toRemove?.custom ? "Supprimer cette entrée ?" : "Désactiver cette entrée ?"}
        message={
          toRemove?.custom
            ? "Cette entrée personnalisée sera définitivement supprimée."
            : "Cette entrée de la plateforme sera masquée pour votre ferme. Vous pourrez la réactiver en la ré-ajoutant."
        }
        confirmLabel={toRemove?.custom ? "Supprimer" : "Désactiver"}
        danger
        loading={deleting}
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
