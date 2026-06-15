"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ARTICLE_SOURCE_LABELS, STOCK_STATE_META, stockState } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { StockItem } from "@/types";

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

export function StockItemsTable({ items }: { items: StockItem[] }) {
  const router = useRouter();

  return (
    <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Article</TableCell>
            <TableCell align="right">Quantité</TableCell>
            <TableCell>État</TableCell>
            <TableCell align="right">Prix unit.</TableCell>
            <TableCell align="right">Valeur</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const state = stockState(item);
            const meta = STOCK_STATE_META[state];
            const value =
              item.typicalUnitPriceXof != null
                ? item.currentQuantity * item.typicalUnitPriceXof
                : null;
            return (
              <TableRow
                key={item.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => router.push(`/stocks/articles/${item.id}`)}
              >
                <TableCell>
                  <Box sx={{ fontWeight: 600 }}>{item.articleKey}</Box>
                  <Box sx={{ fontSize: 12, color: colors.neutral[500] }}>
                    {ARTICLE_SOURCE_LABELS[item.articleSource]}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={mono}>
                  {formatNumber(item.currentQuantity)} {item.unit ?? ""}
                </TableCell>
                <TableCell>
                  <Chip
                    label={meta.label}
                    size="small"
                    sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right" sx={mono}>
                  {item.typicalUnitPriceXof != null
                    ? formatCurrency(item.typicalUnitPriceXof)
                    : "—"}
                </TableCell>
                <TableCell align="right" sx={mono}>
                  {value != null ? formatCurrency(value) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
