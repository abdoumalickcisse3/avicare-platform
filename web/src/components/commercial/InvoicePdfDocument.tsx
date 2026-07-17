import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Client, Invoice } from "@/types";
import { INVOICE_STATUS_META } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";

/**
 * Real generated invoice PDF (react-pdf) — replaces the old browser
 * window.print() page. Because it's a true PDF, there are NO browser print
 * headers/footers (no page title, no URL, no auto date/time) and no app chrome:
 * the farm controls exactly what appears. Helvetica (built-in) covers French
 * accents and the Œ ligature via WinAnsi, so no font registration is needed.
 */

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.neutral[800],
    lineHeight: 1.4,
  },
  // Thin orange accent bar at the very top (brand signature).
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.accent[400],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  farmName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.primary[600] },
  docLabel: {
    fontSize: 8,
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  invoiceNumber: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  statusPill: {
    marginTop: 6,
    alignSelf: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.neutral[200], marginBottom: 18 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  metaLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  strong: { fontFamily: "Helvetica-Bold" },
  muted: { color: colors.neutral[500] },
  // Table
  tHead: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  tRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: colors.neutral[600] },
  colProduct: { flex: 1 },
  colQty: { width: 90, textAlign: "right" },
  colUnit: { width: 100, textAlign: "right" },
  colTotal: { width: 100, textAlign: "right" },
  // Totals
  totals: { marginTop: 18, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: 240 },
  totalsLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsRule: { borderBottomWidth: 1, borderBottomColor: colors.neutral[300], marginVertical: 4 },
  totalsFinalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  totalsFinalValue: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  notes: {
    marginTop: 26,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: 10,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    textAlign: "center",
    fontSize: 8,
    color: colors.neutral[400],
  },
});

/**
 * Intl formats XOF with narrow no-break spaces (U+202F) as thousands separators
 * and a no-break space (U+00A0) before "F CFA". Helvetica/WinAnsi has neither
 * glyph and renders them as "/", so "2 200 F CFA" comes out "2/200F/CFA".
 * Collapse those to plain spaces for the PDF.
 */
const money = (n: number) => formatCurrency(n).replace(/[\u202F\u00A0\u2009]/g, " ");

interface Props {
  invoice: Invoice;
  client?: Client;
  farmName: string;
}

export function InvoicePdfDocument({ invoice, client, farmName }: Props) {
  const meta = INVOICE_STATUS_META[invoice.status];
  const billedTo =
    client?.displayName ?? (invoice.clientId ? `Client #${invoice.clientId}` : "Comptant");

  return (
    <Document
      title={`Facture ${invoice.invoiceNumber}`}
      author={farmName}
      subject={`Facture ${invoice.invoiceNumber} — ${billedTo}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.farmName}>{farmName}</Text>
            <Text style={s.docLabel}>Facture</Text>
          </View>
          <View>
            <Text style={s.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={[s.statusPill, { backgroundColor: meta.bg, color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={s.rule} />

        {/* Billed-to + dates */}
        <View style={s.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>Facturé à</Text>
            <Text style={s.strong}>{billedTo}</Text>
            {client?.address ? (
              <Text style={s.muted}>
                {client.address}
                {client.city ? `, ${client.city}` : ""}
              </Text>
            ) : null}
            {client?.phone ? <Text style={s.muted}>{client.phone}</Text> : null}
          </View>
          <View style={{ width: 200 }}>
            <Text style={s.metaLabel}>Dates</Text>
            <Text>
              <Text style={s.strong}>Émission : </Text>
              {formatDate(invoice.issueDate)}
            </Text>
            {invoice.dueDate ? (
              <Text>
                <Text style={s.strong}>Échéance : </Text>
                {formatDate(invoice.dueDate)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Line items */}
        <View style={s.tHead}>
          <Text style={[s.th, s.colProduct]}>Produit</Text>
          <Text style={[s.th, s.colQty]}>Qté</Text>
          <Text style={[s.th, s.colUnit]}>PU (HT)</Text>
          <Text style={[s.th, s.colTotal]}>Total (HT)</Text>
        </View>
        {invoice.items.map((it) => (
          <View style={s.tRow} key={it.id} wrap={false}>
            <Text style={s.colProduct}>{it.articleLabelSnapshot ?? it.articleKey}</Text>
            <Text style={s.colQty}>
              {it.quantity} {it.unit}
            </Text>
            <Text style={s.colUnit}>{money(it.unitPriceXof)}</Text>
            <Text style={[s.colTotal, s.strong]}>{money(it.lineTotalXof)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.totalsBox}>
            <View style={s.totalsLine}>
              <Text style={s.muted}>Total (HT)</Text>
              <Text>{money(invoice.totalXof)}</Text>
            </View>
            <View style={s.totalsLine}>
              <Text style={s.muted}>Payé</Text>
              <Text style={{ color: colors.success.main }}>
                {money(invoice.amountPaidXof)}
              </Text>
            </View>
            <View style={s.totalsRule} />
            <View style={s.totalsLine}>
              <Text style={s.totalsFinalLabel}>Reste dû</Text>
              <Text
                style={[
                  s.totalsFinalValue,
                  { color: invoice.outstandingXof > 0 ? colors.error.main : colors.success.main },
                ]}
              >
                {money(invoice.outstandingXof)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={s.notes}>
            <Text style={s.metaLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {farmName} — Facture {invoice.invoiceNumber} · générée le{" "}
          {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
