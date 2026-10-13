import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Client, Farm, Invoice } from "@/types";
import { INVOICE_STATUS_META } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { amountInWordsXof } from "@/lib/amountInWords";
import { colors } from "@/theme/tokens";
import { BRAND_MARK_PATHS, BRAND_MARK_VIEWBOX } from "@/theme/brandMark";
import { dueState } from "@/lib/invoiceDocument";
import { imageSource } from "./invoicePdfData";

/**
 * La facture, en PDF réel (react-pdf) — pas une page `window.print()`. Pas d'en-tête
 * ni de pied de page du navigateur, pas de chrome applicatif : la ferme contrôle
 * exactement ce qui s'imprime.
 *
 * C'est un document que l'éleveur remet à SON client : il porte donc son logo, son
 * nom et ses mentions légales en tête, et ne nomme Jawdi qu'en pied de page,
 * discrètement. Helvetica (intégrée) couvre les accents et la ligature Œ via
 * WinAnsi, donc aucune police à enregistrer.
 */

// react-pdf coupe les mots en fin de ligne (« vire-ment ») : sur un document
// remis à un client, ça se voit et ça fait négligé. On lui rend chaque mot entier.
Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: colors.neutral[800],
    lineHeight: 1.4,
  },

  // En-tête : l'identité de la ferme à gauche, la pièce à droite.
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  identity: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 16 },
  logo: { width: 52, height: 52, marginRight: 12, objectFit: "contain" },
  farmName: { fontFamily: "Helvetica-Bold", fontSize: 17, color: colors.primary[800] },
  farmLine: { fontSize: 8.5, color: colors.neutral[500], marginTop: 2 },
  legalLine: { fontSize: 7.5, color: colors.neutral[400], marginTop: 3 },

  docSide: { alignItems: "flex-end", width: 190 },
  docLabel: { fontSize: 8.5, letterSpacing: 2, color: colors.neutral[400] },
  invoiceNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 19,
    color: colors.neutral[800],
    marginTop: 1,
  },
  statusPill: {
    marginTop: 5,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 8,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },

  // Filet de rappel. react-pdf ne fait pas de dégradé : trois segments le
  // suggèrent, du vert profond à l'orange, sans tricher sur les couleurs.
  ruleRow: { flexDirection: "row", marginTop: 14, marginBottom: 16 },
  ruleDeep: { height: 2.5, flex: 4, backgroundColor: colors.primary[800] },
  ruleGreen: { height: 2.5, flex: 3, backgroundColor: colors.primary[500] },
  ruleSun: { height: 2.5, flex: 1, backgroundColor: colors.accent[400] },

  // Deux cartes côte à côte : à qui, et pour quand.
  cards: { flexDirection: "row", marginBottom: 18 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 4,
    padding: 10,
  },
  cardGap: { width: 12 },
  cardLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: colors.neutral[500],
    marginBottom: 5,
    fontFamily: "Helvetica-Bold",
  },
  strong: { fontFamily: "Helvetica-Bold" },
  muted: { color: colors.neutral[500] },
  dateRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  dueBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 7,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },

  // Lignes.
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[300],
    paddingBottom: 5,
  },
  th: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: colors.neutral[500],
    fontFamily: "Helvetica-Bold",
  },
  tRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  colProduct: { flex: 1, paddingRight: 8 },
  colQty: { width: 70, textAlign: "right" },
  colUnit: { width: 80, textAlign: "right" },
  colTotal: { width: 90, textAlign: "right" },
  itemNote: { fontSize: 7.5, color: colors.neutral[500], marginTop: 2 },

  // Totaux.
  bottom: { flexDirection: "row", marginTop: 18, alignItems: "flex-start" },
  bottomLeft: { flex: 1, paddingRight: 16 },
  totalsBox: { width: 230 },
  totalsLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsRule: { borderTopWidth: 1, borderTopColor: colors.neutral[200], marginVertical: 5 },
  dueBox: {
    marginTop: 6,
    padding: 9,
    borderRadius: 4,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  dueLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    fontFamily: "Helvetica-Bold",
    color: colors.accent[700],
    textAlign: "right",
  },
  dueValue: { fontFamily: "Helvetica-Bold", fontSize: 16, textAlign: "right", marginTop: 2 },
  inWords: { fontSize: 7.5, color: colors.neutral[500], textAlign: "right", marginTop: 3 },

  notesLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: colors.neutral[500],
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },

  // Accusé de réception : une facture remise en main propre se signe.
  signRow: { flexDirection: "row", marginTop: 26 },
  signCell: { flex: 1, paddingRight: 24 },
  signLine: { borderTopWidth: 1, borderTopColor: colors.neutral[300], marginTop: 34 },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 7.5,
    color: colors.neutral[400],
  },
  // Marque Jawdi, discrète et en pied de page : la facture appartient à la
  // ferme, qui la remet à son propre client — l'outil ne s'invite pas en tête.
  // Dessinée en vectoriel plutôt qu'en <Image> : react-pdf passe un data URI
  // décodé à pdfkit comme s'il s'agissait d'un chemin de fichier, et le
  // vectoriel reste net quelle que soit la résolution d'impression.
  footerMark: { width: 8, height: 9, marginLeft: 6, marginRight: 3 },
  footerMarkName: { fontFamily: "Helvetica-Bold", color: colors.neutral[500] },
});

/**
 * Intl formats XOF with narrow no-break spaces (U+202F) as thousands separators
 * and a no-break space (U+00A0) before "F CFA". Helvetica/WinAnsi has neither
 * glyph and renders them as "/", so "2 200 F CFA" comes out "2/200F/CFA".
 * Collapse those to plain spaces for the PDF.
 */
const money = (n: number) => formatCurrency(n).replace(/[   ]/g, " ");

interface Props {
  invoice: Invoice;
  client?: Client;
  /** La ferme émettrice : son nom, son lieu et ses mentions légales. */
  farm: Pick<Farm, "name" | "location" | "ninea" | "rccm">;
  /** Son logo en data URI, quand elle en a posé un. */
  logo?: string;
}

export function InvoicePdfDocument({ invoice, client, farm, logo }: Props) {
  const meta = INVOICE_STATUS_META[invoice.status];
  const billedTo =
    client?.displayName ?? (invoice.clientId ? `Client #${invoice.clientId}` : "Comptant");
  const due = dueState(invoice);
  const mark = imageSource(logo);
  const legal = [farm.ninea && `NINEA : ${farm.ninea}`, farm.rccm && `RC : ${farm.rccm}`]
    .filter(Boolean)
    .join("   ·   ");

  const dueTone =
    due.kind === "overdue"
      ? { backgroundColor: colors.error.light, color: colors.error.dark }
      : { backgroundColor: colors.accent[50], color: colors.accent[700] };

  return (
    <Document
      title={`Facture ${invoice.invoiceNumber}`}
      author={farm.name}
      subject={`Facture ${invoice.invoiceNumber} — ${billedTo}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.identity}>
            {/* Le type de react-pdf réclame un `Buffer`, mais pdfkit prend un
                Buffer pour un CHEMIN DE FICHIER et refuse les octets nuls : seul
                un `Uint8Array` nu rend réellement l'image. Vérifié en rendant un
                PDF avec chacune des trois formes. */}
            {mark ? <Image src={mark as unknown as string} style={s.logo} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.farmName}>{farm.name}</Text>
              {farm.location ? <Text style={s.farmLine}>{farm.location}</Text> : null}
              {legal ? <Text style={s.legalLine}>{legal}</Text> : null}
            </View>
          </View>
          <View style={s.docSide}>
            <Text style={s.docLabel}>FACTURE</Text>
            <Text style={s.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={[s.statusPill, { backgroundColor: meta.bg, color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={s.ruleRow}>
          <View style={s.ruleDeep} />
          <View style={s.ruleGreen} />
          <View style={s.ruleSun} />
        </View>

        <View style={s.cards}>
          <View style={s.card}>
            <Text style={s.cardLabel}>FACTURÉ À</Text>
            <Text style={s.strong}>{billedTo}</Text>
            {client?.legalName && client.legalName !== client.displayName ? (
              <Text style={s.muted}>{client.legalName}</Text>
            ) : null}
            {client?.address ? (
              <Text style={s.muted}>
                {client.address}
                {client.city ? `, ${client.city}` : ""}
              </Text>
            ) : null}
            {client?.phone ? <Text style={s.muted}>{client.phone}</Text> : null}
          </View>
          <View style={s.cardGap} />
          <View style={s.card}>
            <Text style={s.cardLabel}>RÉFÉRENCES &amp; ÉCHÉANCE</Text>
            <View style={s.dateRow}>
              <Text style={s.muted}>Date d&apos;émission</Text>
              <Text style={s.strong}>{formatDate(invoice.issueDate)}</Text>
            </View>
            {invoice.deliveryId ? (
              <View style={s.dateRow}>
                <Text style={s.muted}>Bon de livraison</Text>
                <Text style={s.strong}>n° {invoice.deliveryId}</Text>
              </View>
            ) : null}
            {invoice.dueDate ? (
              <View style={s.dateRow}>
                <Text style={s.muted}>Date d&apos;échéance</Text>
                <Text style={s.strong}>{formatDate(invoice.dueDate)}</Text>
              </View>
            ) : null}
            {due.kind === "overdue" || due.kind === "due-soon" ? (
              <Text style={[s.dueBadge, dueTone]}>{due.label}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.colProduct]}>DÉSIGNATION</Text>
          <Text style={[s.th, s.colQty]}>QTÉ</Text>
          <Text style={[s.th, s.colUnit]}>P.U.</Text>
          <Text style={[s.th, s.colTotal]}>TOTAL</Text>
        </View>
        {invoice.items.map((it) => (
          <View style={s.tRow} key={it.id} wrap={false}>
            <View style={s.colProduct}>
              <Text style={s.strong}>{it.articleLabelSnapshot ?? it.articleKey}</Text>
              {it.notes ? <Text style={s.itemNote}>{it.notes}</Text> : null}
            </View>
            <Text style={s.colQty}>
              {it.quantity} {it.unit}
            </Text>
            <Text style={s.colUnit}>{money(it.unitPriceXof)}</Text>
            <Text style={[s.colTotal, s.strong]}>{money(it.lineTotalXof)}</Text>
          </View>
        ))}

        <View style={s.bottom}>
          <View style={s.bottomLeft}>
            {invoice.notes ? (
              <>
                <Text style={s.notesLabel}>NOTES</Text>
                <Text style={s.muted}>{invoice.notes}</Text>
              </>
            ) : null}
          </View>

          <View style={s.totalsBox}>
            <View style={s.totalsLine}>
              <Text style={s.muted}>Total</Text>
              <Text>{money(invoice.totalXof)}</Text>
            </View>
            <View style={s.totalsLine}>
              <Text style={s.muted}>Déjà payé</Text>
              <Text style={{ color: colors.success.main }}>{money(invoice.amountPaidXof)}</Text>
            </View>
            <View style={s.totalsRule} />
            <View style={s.dueBox}>
              <Text style={s.dueLabel}>RESTE DÛ</Text>
              <Text
                style={[
                  s.dueValue,
                  { color: invoice.outstandingXof > 0 ? colors.accent[600] : colors.success.main },
                ]}
              >
                {money(invoice.outstandingXof)}
              </Text>
              {/* En lettres : sur une facture, c'est ce montant qui fait foi
                  contre les chiffres, et il protège le document d'une retouche. */}
              <Text style={s.inWords}>{amountInWordsXof(invoice.outstandingXof)}</Text>
            </View>
          </View>
        </View>

        <View style={s.signRow}>
          <View style={s.signCell}>
            <Text style={s.notesLabel}>POUR ACCORD &amp; RÉCEPTION</Text>
            <View style={s.signLine} />
          </View>
          <View style={s.signCell}>
            <Text style={s.notesLabel}>SIGNATURE &amp; CACHET</Text>
            <View style={s.signLine} />
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {farm.name} — Facture {invoice.invoiceNumber} · générée le{" "}
            {formatDate(new Date().toISOString())}
          </Text>
          <Svg viewBox={BRAND_MARK_VIEWBOX} style={s.footerMark}>
            {BRAND_MARK_PATHS.map((p, i) => (
              <Path key={i} d={p.d} fill={p.fill} />
            ))}
          </Svg>
          <Text style={s.footerMarkName}>Jawdi</Text>
        </View>
      </Page>
    </Document>
  );
}
