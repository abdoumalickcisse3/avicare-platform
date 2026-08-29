"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowLeft, Lock, Plus } from "lucide-react";
import {
  useCreateCatalogItemMutation,
  useGetCatalogCategoriesQuery,
  useGetCatalogItemsQuery,
  useUpdateCatalogItemMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import type { AdminCatalogItemRow } from "@/types";

/** FR names for the categories that exist today; an unknown one falls back to its raw key. */
const CATEGORY_LABELS: Record<string, string> = {
  breeds: "Races et souches",
  vaccines: "Vaccins",
  treatments: "Traitements",
  vaccination_programs: "Programmes de vaccination",
  feed_formulas: "Formules d'aliment",
  inventory_items: "Articles de stock",
  expense_categories: "Catégories de dépenses",
  sales_channels: "Circuits de vente",
  egg_grades: "Calibres d'œufs",
  egg_timeslots: "Créneaux de ramassage",
  egg_collection: "Ramassage des œufs",
  modules: "Modules (plateforme)",
  bundles: "Offres (plateforme)",
  admin: "Seuils console (plateforme)",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

interface Draft {
  id: number | null;
  category: string;
  key: string;
  label: string;
  detail: string;
  active: boolean;
}

/** Everything except the label — the label has its own field and is folded back in on save. */
function detailOf(value: Record<string, unknown>): string {
  const rest = { ...value };
  delete rest.label;
  return JSON.stringify(rest, null, 2);
}

function newDraft(category: string): Draft {
  return { id: null, category, key: "", label: "", detail: "{}", active: true };
}

function draftOf(item: AdminCatalogItemRow): Draft {
  return {
    id: item.id,
    category: item.category,
    key: item.key,
    label: item.label ?? "",
    detail: detailOf(item.value),
    active: item.active,
  };
}

/**
 * Platform reference data, editable without a migration.
 *
 * The value is JSONB whose shape changes per category, so the editor is hybrid: the label and the
 * active flag get real fields because every screen shows them, and the rest stays JSON — which is
 * what lets a category nobody has modelled yet be edited the day it appears.
 *
 * Nothing is deleted here, only deactivated: catalog entries are referenced by key from flocks and
 * formulas, with no foreign key to catch a removal.
 */
export function CatalogEditor() {
  const { data: categories = [], isLoading } = useGetCatalogCategoriesQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: items = [], isFetching } = useGetCatalogItemsQuery(
    { category: selected ?? "" },
    { skip: !selected },
  );
  const [createItem, { isLoading: creating }] = useCreateCatalogItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateCatalogItemMutation();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (!draft) return { value: null as Record<string, unknown> | null, error: null as string | null };
    try {
      const v = JSON.parse(draft.detail) as unknown;
      if (v === null || typeof v !== "object" || Array.isArray(v)) {
        return { value: null, error: "Le détail doit être un objet JSON, entre accolades." };
      }
      return { value: v as Record<string, unknown>, error: null };
    } catch (e) {
      return { value: null, error: e instanceof Error ? e.message : "JSON invalide" };
    }
  }, [draft]);

  const currentCategory = categories.find((c) => c.category === selected);
  const canSave =
    draft !== null && parsed.error === null && draft.key.trim().length > 0 && !creating && !updating;

  const onSave = async () => {
    if (!draft || !parsed.value) return;
    setError(null);
    const value: Record<string, unknown> = { ...parsed.value };
    if (draft.label.trim()) value.label = draft.label.trim();
    const body = {
      category: draft.category,
      key: draft.key.trim(),
      value,
      active: draft.active,
    };
    try {
      if (draft.id === null) await createItem(body).unwrap();
      else await updateItem({ id: draft.id, ...body }).unwrap();
      setDraft(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  if (isLoading) return <CircularProgress size={24} />;

  if (!selected) {
    return (
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Catalogue plateforme
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Les données de référence partagées par toutes les fermes. Chaque modification est
            journalisée.
          </Typography>
        </Box>
        <Card variant="outlined">
          <CardContent sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Catégorie</TableCell>
                  <TableCell align="right">Entrées</TableCell>
                  <TableCell align="right">Actives</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.category} hover>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {categoryLabel(c.category)}
                        </Typography>
                        {!c.editable && (
                          <Tooltip title="Pilote la plateforme elle-même : consultable, non modifiable.">
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<Lock size={12} />}
                              label="lecture seule"
                            />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {c.category}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{c.total}</TableCell>
                    <TableCell align="right">{c.active}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setSelected(c.category)}>
                        Ouvrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Button startIcon={<ArrowLeft size={16} />} onClick={() => setSelected(null)}>
          Catégories
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          {categoryLabel(selected)}
        </Typography>
        {currentCategory?.editable && (
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setDraft(newDraft(selected))}
          >
            Nouvelle entrée
          </Button>
        )}
      </Stack>

      {currentCategory && !currentCategory.editable && (
        <Alert severity="info">
          Cette catégorie pilote la plateforme elle-même — modules activables, offres, seuils de la
          console. Elle se consulte ici et se modifie par un déploiement relu.
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent sx={{ overflowX: "auto" }}>
          {isFetching ? (
            <CircularProgress size={22} />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Clé</TableCell>
                  <TableCell>Libellé</TableCell>
                  <TableCell>État</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {item.key}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.label ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant={item.active ? "filled" : "outlined"}
                        color={item.active ? "success" : "default"}
                        label={item.active ? "Active" : "Inactive"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setDraft(draftOf(item))}>
                        {item.editable ? "Modifier" : "Voir"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!draft} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {draft?.id === null ? "Nouvelle entrée" : `${draft?.category} · ${draft?.key}`}
        </DialogTitle>
        <DialogContent dividers>
          {draft && (
            <Stack spacing={2.5}>
              {error && <Alert severity="error">{error}</Alert>}
              {draft.id !== null && (
                <Alert severity="info">
                  La catégorie et la clé ne se modifient pas : le reste de la plateforme désigne
                  cette entrée par sa clé.
                </Alert>
              )}
              <TextField
                label="Clé"
                value={draft.key}
                disabled={draft.id !== null}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                helperText="Minuscules, chiffres, tiret bas. Ex : cobb_500"
                fullWidth
              />
              <TextField
                label="Libellé"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                helperText="Ce que voient les éleveurs. Certaines catégories n'en ont pas."
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                }
                label="Active"
              />
              <TextField
                label="Détail (JSON)"
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                multiline
                minRows={6}
                fullWidth
                error={!!parsed.error}
                helperText={parsed.error ?? "Tout le reste du contenu, sans le libellé."}
                slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 13 } } }}
              />
              <Alert severity="warning">
                Une entrée ne se supprime pas : elle se désactive. Les lots et les formules la
                désignent par sa clé, sans contrainte de base pour rattraper une suppression.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>Fermer</Button>
          <Button variant="contained" onClick={onSave} disabled={!canSave}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
