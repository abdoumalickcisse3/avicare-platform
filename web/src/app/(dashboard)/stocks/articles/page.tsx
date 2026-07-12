"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { ArticleDialog } from "@/components/inventory/ArticleDialog";
import {
  useDeleteArticleMutation,
  useGetInventoryArticlesQuery,
} from "@/store/api/inventoryCatalogApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { ARTICLE_SOURCE_LABELS } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { InventoryCatalogItem } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const ALL = "Tous";

export default function ArticleLibraryPage() {
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const [category, setCategory] = useState(ALL);
  const { showToast } = useToast();

  const { data: articles, isLoading } = useGetInventoryArticlesQuery(
    { farmId: farmId as number },
    { skip: !hasFarm || !hasInventory },
  );

  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);
  const [deleteArticle] = useDeleteArticleMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCatalogItem | undefined>(undefined);
  const [toDelete, setToDelete] = useState<InventoryCatalogItem | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (a: InventoryCatalogItem) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const confirmDelete = async () => {
    if (!toDelete || farmId == null) return;
    try {
      await deleteArticle({ farmId, key: toDelete.articleKey }).unwrap();
      showToast("Article supprimé", "success");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    } finally {
      setToDelete(null);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    (articles ?? []).forEach((a) => a.subcategory && set.add(a.subcategory));
    return [ALL, ...Array.from(set).sort()];
  }, [articles]);

  const filtered = useMemo(
    () =>
      (articles ?? []).filter((a) => category === ALL || a.subcategory === category),
    [articles, category],
  );

  if (hasFarm && !hasInventory) {
    return <Alert severity="info">Activez le module Inventaire pour accéder à la bibliothèque.</Alert>;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Bibliothèque des articles
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Catalogue plateforme des articles stockables.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={openCreate}
          >
            Nouvel article
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap" }} useFlexGap>
        {categories.map((c) => (
          <Chip
            key={c}
            label={c}
            onClick={() => setCategory(c)}
            color={category === c ? "primary" : "default"}
            variant={category === c ? "filled" : "outlined"}
          />
        ))}
      </Stack>

      {isLoading && <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 3 }} />}

      {!isLoading && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Référence</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Sous-catégorie</TableCell>
                <TableCell>Unité</TableCell>
                <TableCell align="right">Prix moyen</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={`${a.articleSource}-${a.articleKey}`} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {a.label}
                    {a.custom && (
                      <Chip label="Perso" size="small" color="primary" variant="outlined" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{ARTICLE_SOURCE_LABELS[a.articleSource]}</TableCell>
                  <TableCell>
                    {a.subcategory ? (
                      <Chip label={a.subcategory} size="small" sx={{ bgcolor: colors.primary[50], color: colors.primary[700] }} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{a.unit ?? "—"}</TableCell>
                  <TableCell align="right" sx={mono}>
                    {a.typicalUnitPriceXof != null ? formatCurrency(a.typicalUnitPriceXof) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {a.custom && canManage && (
                      <>
                        <IconButton size="small" aria-label="Modifier" onClick={() => openEdit(a)}>
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton size="small" aria-label="Supprimer" onClick={() => setToDelete(a)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {farmId != null && (
        <ArticleDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          farmId={farmId}
          article={editing}
        />
      )}
      <Dialog open={toDelete != null} onClose={() => setToDelete(null)}>
        <DialogTitle>Supprimer l&apos;article ?</DialogTitle>
        <DialogContent>Supprimer « {toDelete?.label} » de la bibliothèque ?</DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
