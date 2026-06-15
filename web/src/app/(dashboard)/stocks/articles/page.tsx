"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { Plus } from "lucide-react";
import { useGetInventoryArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { formatCurrency } from "@/lib/format";
import { ARTICLE_SOURCE_LABELS } from "@/lib/inventory";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const ALL = "Tous";

export default function ArticleLibraryPage() {
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const [category, setCategory] = useState(ALL);

  const { data: articles, isLoading } = useGetInventoryArticlesQuery(
    { farmId: farmId as number },
    { skip: !hasFarm || !hasInventory },
  );

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
        <Tooltip title="Les articles personnalisés arrivent en V2">
          <span>
            <Button variant="contained" color="primary" startIcon={<Plus size={18} />} disabled>
              Nouvel article
            </Button>
          </span>
        </Tooltip>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={`${a.articleSource}-${a.articleKey}`} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{a.label}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
