"use client";

import { useCallback, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { PackagePlus, ClipboardCheck } from "lucide-react";
import { StockMovementDialog } from "./StockMovementDialog";
import { formatQty } from "@/lib/inventory";
import { missingQuantity, stockShortage, type StockShortage } from "@/lib/stockShortage";
import { colors } from "@/theme/tokens";

/**
 * Transforme un refus « stock insuffisant » (ADR-018) en deux gestes qui débloquent.
 *
 * <p>Refuser la sortie n'a de sens que si la porte de sortie est dans le même écran. Sans ça, la
 * garde est punitive : l'ouvrier est au poulailler, le produit est devant lui, et on lui demande
 * d'aller chercher un autre écran — il abandonnera la saisie, et c'est la donnée qu'on perd.
 *
 * <p>Usage dans un gestionnaire d'envoi :
 *
 * <pre>{@code
 * catch (e) {
 *   if (!shortage.handle(e)) showToast(apiErrorMessage(e), "error");
 * }
 * }</pre>
 *
 * et {@code {shortage.dialog}} dans le rendu.
 */
export function useStockShortage(farmId: number | null) {
  const [shortage, setShortage] = useState<StockShortage | null>(null);
  const [repair, setRepair] = useState<"IN" | "ADJUSTMENT" | null>(null);

  /** Rend `true` quand l'erreur était un manque de stock et que la fenêtre a pris le relais. */
  const handle = useCallback((error: unknown) => {
    const found = stockShortage(error);
    if (found) setShortage(found);
    return found !== null;
  }, []);

  const close = () => {
    setShortage(null);
    setRepair(null);
  };

  const dialog =
    shortage == null || farmId == null ? null : (
      <>
        <Dialog open={repair == null} onClose={close} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 700 }}>Stock insuffisant</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Il reste{" "}
              <Typography component="span" sx={{ fontWeight: 700 }}>
                {formatQty(shortage.available, shortage.unit)}
              </Typography>{" "}
              de {shortage.articleLabel}, et vous en sortez{" "}
              <Typography component="span" sx={{ fontWeight: 700 }}>
                {formatQty(shortage.requested, shortage.unit)}
              </Typography>
              .
            </Typography>
            <Typography variant="body2" sx={{ color: colors.neutral[600], mb: 2.5 }}>
              D&apos;où vient ce produit ?
            </Typography>

            <Stack spacing={1.25}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PackagePlus size={18} />}
                onClick={() => setRepair("IN")}
                sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.25 }}
              >
                Je l&apos;ai reçu, l&apos;achat n&apos;a pas été saisi
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<ClipboardCheck size={18} />}
                onClick={() => setRepair("ADJUSTMENT")}
                sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.25 }}
              >
                Je compte ce qu&apos;il y a dans le magasin
              </Button>
              <Button onClick={close} size="small" sx={{ alignSelf: "flex-start", mt: 0.5 }}>
                Annuler
              </Button>
            </Stack>

            <Typography variant="caption" sx={{ display: "block", mt: 2, color: colors.neutral[500] }}>
              Une fois le stock corrigé, reprenez votre saisie.
            </Typography>
          </DialogContent>
        </Dialog>

        <StockMovementDialog
          open={repair != null}
          onClose={close}
          farmId={farmId}
          preselectStockItemId={shortage.stockItemId}
          preselectType={repair ?? undefined}
          // À l'entrée, on pré-remplit ce qui MANQUE, pas ce qui était demandé : sur une ligne
          // déjà négative, saisir la demande seule laisserait le solde sous zéro. À l'inventaire,
          // le champ reste vide — tout l'intérêt est que la personne compte.
          preselectQuantity={repair === "IN" ? missingQuantity(shortage) : undefined}
        />
      </>
    );

  return { handle, dialog };
}
