"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AppBar, Box, Button, CircularProgress, Toolbar, Typography } from "@mui/material";
import { ArrowLeft, Download } from "lucide-react";
import { useGetInvoiceQuery } from "@/store/api/invoicesApi";
import { useGetClientQuery } from "@/store/api/clientsApi";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { InvoicePdfDocument } from "./InvoicePdfDocument";

/**
 * Invoice PDF screen. Replaces the old window.print() page: it shows a real
 * generated PDF (react-pdf) in an inline viewer plus a download button. No
 * browser print chrome, no app FAB — the CommercialFab hides itself on /imprimer.
 *
 * react-pdf is browser-only, so the viewer is loaded via next/dynamic with
 * `ssr: false` (Next 16 requires that inside a Client Component), and the
 * download defers the whole library to click time via `pdf().toBlob()`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFViewer = dynamic<any>(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
        <CircularProgress />
      </Box>
    ),
  },
);

interface Props {
  invoiceId: number;
}

export function InvoicePdfView({ invoiceId }: Props) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const skip = !hasFarm || !hasCommercial;
  const [downloading, setDownloading] = useState(false);

  const { data: invoice } = useGetInvoiceQuery(
    { farmId: farmId as number, id: invoiceId },
    { skip },
  );
  const { data: client } = useGetClientQuery(
    { farmId: farmId as number, id: invoice?.clientId as number },
    { skip: skip || invoice?.clientId == null },
  );
  const { data: farms } = useGetMyFarmsQuery();

  const farmName = farms?.find((f) => f.id === farmId)?.name ?? "—";

  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <InvoicePdfDocument invoice={invoice} client={client} farmName={farmName} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Facture-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const backHref = `/commercial/factures/${invoiceId}`;

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 1400, bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Button component={Link} href={backHref} startIcon={<ArrowLeft size={16} />} color="inherit">
            Retour à la facture
          </Button>
          <Typography sx={{ flex: 1, fontWeight: 600 }} noWrap>
            {invoice ? `Facture ${invoice.invoiceNumber}` : "Facture"}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Download size={16} />}
            onClick={handleDownload}
            disabled={!invoice || downloading}
          >
            Télécharger le PDF
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {invoice ? (
          <PDFViewer style={{ width: "100%", height: "100%", border: 0 }} showToolbar>
            <InvoicePdfDocument invoice={invoice} client={client} farmName={farmName} />
          </PDFViewer>
        ) : (
          <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
            {skip ? (
              <Typography color="text.secondary">
                Le module commercial n&apos;est pas actif sur cette ferme.
              </Typography>
            ) : (
              <CircularProgress />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
