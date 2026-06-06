import { format } from "date-fns";
import { fr } from "date-fns/locale";

/** Locale-aware formatters for Senegal (fr-SN, XOF). doc 07 §7. */

export const formatCurrency = (amount: number, currency = "XOF") =>
  new Intl.NumberFormat("fr-SN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("fr-SN").format(n);

export const formatDate = (date: Date | string) =>
  format(new Date(date), "dd MMM yyyy", { locale: fr });
