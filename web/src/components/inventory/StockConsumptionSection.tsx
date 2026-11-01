"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Collapse,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PackageMinus } from "lucide-react";
import {
  useGetAllArticlesQuery,
} from "@/store/api/inventoryCatalogApi";
import { useGetStockItemsQuery } from "@/store/api/inventoryStockApi";
import { findStockByArticle, formatQty, isMedicationArticle } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { InventoryCatalogItem, StockConsumption } from "@/types";

interface Props {
  farmId: number;
  /** Whether the host dialog is open (gates the queries). */
  open: boolean;
  onChange: (value: StockConsumption | null) => void;
  /**
   * Restrict the article picker to medications (for the treatment dialog). Judged on the article
   * itself, not on which catalog defines it: a medication the farm bought is an `INVENTORY`
   * article, and filtering on the source hid exactly the ones that held stock (ADR-020).
   */
  medicationsOnly?: boolean;
  /** Label of the toggle, defaults to a generic one. */
  label?: string;
}

/**
 * Optional D18 stock-coupling section, shared by the daily-record, vaccination
 * and treatment dialogs. Secondary by design (collapsed behind a toggle). When
 * enabled with a valid article + quantity it emits a {@link StockConsumption};
 * otherwise it emits null so the host action runs without coupling. Shows the
 * resulting stock in real time (orange when it would go negative — non-blocking,
 * Décision 19). The host must only render this when {@code module.inventory} is
 * active (useInventoryGating).
 */
export function StockConsumptionSection({
  farmId,
  open,
  onChange,
  medicationsOnly = false,
  label = "Décrémenter du stock",
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [article, setArticle] = useState<InventoryCatalogItem | null>(null);
  const [qty, setQty] = useState("");

  // The host dialog unmounts this section on close, so a mount = a fresh open:
  // clear any value the parent held from a previous use (event, not a reset loop).
  useEffect(() => {
    onChange(null);
  }, [onChange]);

  const { data: articles = [] } = useGetAllArticlesQuery(
    { farmId },
    { skip: !open || !enabled },
  );
  const { data: stockItems = [] } = useGetStockItemsQuery(
    { farmId },
    { skip: !open || !enabled },
  );

  const options = useMemo(
    () => (medicationsOnly ? articles.filter(isMedicationArticle) : articles),
    [articles, medicationsOnly],
  );

  const quantity = qty ? Number(qty.replace(",", ".")) : NaN;
  const current = article
    ? (findStockByArticle(stockItems, article.articleKey)?.currentQuantity ?? 0)
    : null;
  const after =
    current != null && Number.isFinite(quantity) ? current - quantity : null;

  const emit = (a: InventoryCatalogItem | null, q: string, on: boolean) => {
    const n = q ? Number(q.replace(",", ".")) : NaN;
    if (on && a && Number.isFinite(n) && n > 0) {
      onChange({ articleKey: a.articleKey, articleSource: a.articleSource, quantity: n });
    } else {
      onChange(null);
    }
  };

  const handleToggle = (on: boolean) => {
    setEnabled(on);
    emit(article, qty, on);
  };

  return (
    <Box
      sx={{
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 2,
        p: 2,
        bgcolor: enabled ? colors.accent[50] : "transparent",
        transition: "background-color 150ms",
      }}
    >
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            color="secondary"
          />
        }
        label={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <PackageMinus size={18} color={colors.accent[500]} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
          </Stack>
        }
      />

      <Collapse in={enabled} unmountOnExit>
        <Stack spacing={2} sx={{ pt: 1.5 }}>
          <Autocomplete
            options={options}
            getOptionLabel={(o) => o.label}
            value={article}
            onChange={(_e, v) => {
              setArticle(v);
              emit(v, qty, enabled);
            }}
            isOptionEqualToValue={(o, v) => o.articleKey === v.articleKey}
            renderInput={(params) => (
              <TextField {...params} label="Article à décompter" size="small" />
            )}
          />

          <TextField
            label="Quantité consommée"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              emit(article, e.target.value, enabled);
            }}
            type="number"
            size="small"
            slotProps={{
              htmlInput: { inputMode: "decimal", min: 0, step: "0.01" },
              input: article?.unit
                ? {
                    endAdornment: (
                      <InputAdornment position="end">{article.unit}</InputAdornment>
                    ),
                  }
                : undefined,
            }}
          />

          {after != null && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                color: after < 0 ? colors.warning.dark : colors.neutral[500],
                fontWeight: after < 0 ? 700 : 500,
              }}
            >
              Stock après : {formatQty(after, article?.unit)}
              {after < 0 ? " — stock négatif (autorisé, non bloquant)" : ""}
            </Typography>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}
