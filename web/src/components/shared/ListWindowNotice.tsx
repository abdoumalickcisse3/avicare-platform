"use client";

import { Alert } from "@mui/material";
import { useAppSelector } from "@/store/hooks";

const nf = new Intl.NumberFormat("fr-FR");

interface ListWindowNoticeProps {
  /** RTK Query endpoint name, e.g. "getSales". */
  endpoint: string;
}

/**
 * Says so when the backend served only a window of a long list, instead of letting the screen pass
 * off the 500 newest rows as the whole history. Renders nothing for a list served whole, which is
 * every list on a farm that has not been running for years.
 */
export function ListWindowNotice({ endpoint }: ListWindowNoticeProps) {
  const window = useAppSelector((state) => state.listWindow[endpoint]);
  if (!window) return null;

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      Les {nf.format(window.size)} lignes les plus récentes sont affichées, sur{" "}
      {nf.format(window.total)} au total. Filtrez pour retrouver une ligne plus ancienne.
    </Alert>
  );
}
