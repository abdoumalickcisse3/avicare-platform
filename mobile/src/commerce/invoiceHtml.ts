/**
 * La facture, en HTML prêt pour `expo-print`.
 *
 * Même document que le PDF du web (`InvoicePdfDocument`) : logo et mentions de la ferme en tête,
 * filet de rappel, cartes « Facturé à » et « Références & échéance », lignes avec leur précision,
 * totaux avec le reste dû en toutes lettres, accusé de réception, marque Jawdi en pied. Le web le
 * rend avec react-pdf, qui ne tourne pas en React Native ; ici c'est du HTML que le moteur
 * d'impression du téléphone transforme en PDF. Deux moteurs, un seul document — les libellés et
 * l'ordre des blocs se suivent volontairement, pour qu'une facture soit reconnaissable quelle que
 * soit sa provenance, et les règles communes (échéance, montant en lettres) viennent des mêmes
 * modules que le web.
 *
 * Le HTML est **assemblé, jamais concaténé depuis des données brutes** : tout ce qui vient du
 * serveur passe par `esc()`. Un client nommé « Ets Diop & <fils> » ne doit pas casser la mise en
 * page, et un libellé d'article ne doit pas pouvoir injecter de balise.
 */
import type { Client, Invoice } from '@/types';
import { INVOICE_STATUS_LABELS } from '@/lib/commercial';
import { amountInWordsXof } from '@/lib/amountInWords';
import { dueState } from '@/lib/invoiceDocument';
import { BRAND_MARK_PNG } from '@/brand/brandMark';

/** Échappe tout ce qui vient des données. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `12 000 F` — espaces insécables, comme `formatCurrency`, mais sûr en HTML. */
function money(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, '&nbsp;')}&nbsp;F`;
}

/** `2026-09-07` → `07/09/2026`. Une date déjà en clair ressort telle quelle. */
function frDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso);
}

const DEFAULT_TINT = { bg: '#DBEAFE', fg: '#1E3A8A' };
const STATUS_TINT: Record<string, { bg: string; fg: string }> = {
  ISSUED: { bg: '#DBEAFE', fg: '#1E3A8A' },
  PARTIALLY_PAID: { bg: '#FFE1B8', fg: '#9C4F03' },
  PAID: { bg: '#DCFCE7', fg: '#14532D' },
  CANCELLED: { bg: '#E7E5E4', fg: '#57534E' },
};

/** La ferme émettrice, telle qu'elle se présente à son client. */
export interface InvoiceIssuer {
  name: string;
  location?: string | null;
  ninea?: string | null;
  rccm?: string | null;
  /**
   * Nom du champ fiscal dans le pays de la ferme, résolu par le serveur.
   * Absent sur une ferme enregistrée avant que le pays n'existe : on dit NINEA.
   */
  taxIdLabel?: string | null;
  /** Son logo en data URI, quand elle en a posé un (depuis le web). */
  logo?: string | null;
}

export function invoiceHtml({
  invoice,
  client,
  issuer,
}: {
  invoice: Invoice;
  client?: Client | null;
  issuer: InvoiceIssuer;
}): string {
  const tint = STATUS_TINT[invoice.status] ?? DEFAULT_TINT;
  const billedTo =
    client?.displayName ?? (invoice.clientId ? `Client #${invoice.clientId}` : 'Comptant');
  const due = dueState(invoice);

  const rows = (invoice.items ?? [])
    .map(
      (it) => `
      <tr>
        <td>
          <div class="strong">${esc(it.articleLabelSnapshot ?? it.articleKey)}</div>
          ${it.notes ? `<div class="itemNote">${esc(it.notes)}</div>` : ''}
        </td>
        <td class="num">${esc(it.quantity)} ${esc(it.unit ?? '')}</td>
        <td class="num">${money(it.unitPriceXof)}</td>
        <td class="num strong">${money(it.lineTotalXof)}</td>
      </tr>`,
    )
    .join('');

  const clientLines = [
    client?.legalName && client.legalName !== client.displayName ? esc(client.legalName) : '',
    client?.address ? `${esc(client.address)}${client.city ? `, ${esc(client.city)}` : ''}` : '',
    client?.phone ? esc(client.phone) : '',
  ]
    .filter(Boolean)
    .map((l) => `<div class="muted">${l}</div>`)
    .join('');

  const legal = [
    issuer.ninea ? `${esc(issuer.taxIdLabel ?? 'NINEA')} : ${esc(issuer.ninea)}` : '',
    issuer.rccm ? `RC : ${esc(issuer.rccm)}` : '',
  ]
    .filter(Boolean)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const dueBadge =
    due.kind === 'overdue' || due.kind === 'due-soon'
      ? `<div class="dueBadge ${due.kind === 'overdue' ? 'late' : ''}">${esc(due.label)}</div>`
      : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Facture ${esc(invoice.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #292524; line-height: 1.45; }
  .sheet { padding: 40px; }

  /* En-tête : l'identité de la ferme à gauche, la pièce à droite. */
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .identity { display: flex; align-items: flex-start; flex: 1; padding-right: 18px; }
  .logo { width: 58px; height: 58px; object-fit: contain; margin-right: 13px; }
  .farm { font-size: 19px; font-weight: bold; color: #0C4434; }
  .farmLine { font-size: 10px; color: #78716C; margin-top: 2px; }
  .legalLine { font-size: 9px; color: #A8A29E; margin-top: 3px; }
  .docSide { text-align: right; width: 210px; }
  .docLabel { font-size: 10px; letter-spacing: 2px; color: #A8A29E; }
  .number { font-size: 21px; font-weight: bold; margin-top: 1px; }
  .pill { display: inline-block; margin-top: 5px; padding: 3px 9px; border-radius: 10px; font-size: 10px;
          font-weight: bold; background: ${tint.bg}; color: ${tint.fg}; }

  /* Filet de rappel : trois segments, comme sur le PDF du web. */
  .rule { display: flex; margin: 16px 0 18px; }
  .rule i { height: 3px; display: block; }
  .rule .a { flex: 4; background: #0C4434; }
  .rule .b { flex: 3; background: #3B8B3D; }
  .rule .c { flex: 1; background: #F2A31A; }

  /* Deux cartes : à qui, et pour quand. */
  .cards { display: flex; gap: 13px; margin-bottom: 20px; }
  .card { flex: 1; border: 1px solid #E7E5E4; border-radius: 5px; padding: 11px; }
  .cardLabel { font-size: 9px; letter-spacing: 1px; color: #78716C; font-weight: bold; margin-bottom: 6px; }
  .dateRow { display: flex; justify-content: space-between; margin-top: 3px; }
  .dueBadge { display: inline-block; margin-top: 7px; padding: 2px 7px; border-radius: 8px; font-size: 9px;
              font-weight: bold; background: #FFF4E6; color: #9C4F03; }
  .dueBadge.late { background: #FEE2E2; color: #991B1B; }

  .strong { font-weight: bold; }
  .muted { color: #78716C; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; letter-spacing: .8px; color: #78716C; font-weight: bold;
       border-bottom: 1px solid #D6D3D1; padding: 0 4px 6px; }
  td { padding: 8px 4px; border-bottom: 1px solid #F5F5F4; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .itemNote { font-size: 9px; color: #78716C; margin-top: 2px; }

  .bottom { display: flex; margin-top: 20px; align-items: flex-start; }
  .bottomLeft { flex: 1; padding-right: 18px; }
  .totalsBox { width: 250px; }
  .line { display: flex; justify-content: space-between; padding: 2px 0; }
  .totalsRule { border-top: 1px solid #E7E5E4; margin: 6px 0; }
  .dueBox { margin-top: 7px; padding: 10px; border-radius: 5px; background: #FFF4E6; border: 1px solid #FFCB85; }
  .dueLabel { font-size: 9px; letter-spacing: 1px; font-weight: bold; color: #9C4F03; text-align: right; }
  .dueValue { font-size: 19px; font-weight: bold; text-align: right; margin-top: 2px; }
  .inWords { font-size: 9px; color: #78716C; text-align: right; margin-top: 3px; }
  .sectionLabel { font-size: 9px; letter-spacing: 1px; color: #78716C; font-weight: bold; margin-bottom: 4px; }

  /* Accusé de réception : une facture remise en main propre se signe. */
  .signRow { display: flex; margin-top: 30px; }
  .signCell { flex: 1; padding-right: 26px; }
  .signLine { border-top: 1px solid #D6D3D1; margin-top: 38px; }

  .footer { position: fixed; bottom: 24px; left: 40px; right: 40px; text-align: center;
            font-size: 9px; color: #A8A29E; }
  /* Marque Jawdi : discrète, en pied de page. Le document appartient à la ferme. */
  .mark { height: 10px; width: auto; vertical-align: -1px; margin-left: 6px; opacity: .75; }
  .markName { font-weight: bold; color: #78716C; }
</style></head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="identity">
        ${issuer.logo ? `<img class="logo" src="${esc(issuer.logo)}" alt="">` : ''}
        <div>
          <div class="farm">${esc(issuer.name)}</div>
          ${issuer.location ? `<div class="farmLine">${esc(issuer.location)}</div>` : ''}
          ${legal ? `<div class="legalLine">${legal}</div>` : ''}
        </div>
      </div>
      <div class="docSide">
        <div class="docLabel">FACTURE</div>
        <div class="number">${esc(invoice.invoiceNumber)}</div>
        <span class="pill">${esc(INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status)}</span>
      </div>
    </div>

    <div class="rule"><i class="a"></i><i class="b"></i><i class="c"></i></div>

    <div class="cards">
      <div class="card">
        <div class="cardLabel">FACTURÉ À</div>
        <div class="strong">${esc(billedTo)}</div>
        ${clientLines}
      </div>
      <div class="card">
        <div class="cardLabel">RÉFÉRENCES &amp; ÉCHÉANCE</div>
        <div class="dateRow"><span class="muted">Date d'émission</span><span class="strong">${frDate(invoice.issueDate)}</span></div>
        ${invoice.deliveryId ? `<div class="dateRow"><span class="muted">Bon de livraison</span><span class="strong">n° ${esc(invoice.deliveryId)}</span></div>` : ''}
        ${invoice.dueDate ? `<div class="dateRow"><span class="muted">Date d'échéance</span><span class="strong">${frDate(invoice.dueDate)}</span></div>` : ''}
        ${dueBadge}
      </div>
    </div>

    <table>
      <thead><tr>
        <th>DÉSIGNATION</th><th class="num">QTÉ</th><th class="num">P.U.</th><th class="num">TOTAL</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="bottom">
      <div class="bottomLeft">
        ${invoice.notes ? `<div class="sectionLabel">NOTES</div><div class="muted">${esc(invoice.notes)}</div>` : ''}
      </div>
      <div class="totalsBox">
        <div class="line"><span class="muted">Total</span><span>${money(invoice.totalXof)}</span></div>
        <div class="line"><span class="muted">Déjà payé</span><span style="color:#16A34A">${money(invoice.amountPaidXof)}</span></div>
        <div class="totalsRule"></div>
        <div class="dueBox">
          <div class="dueLabel">RESTE DÛ</div>
          <div class="dueValue" style="color:${invoice.outstandingXof > 0 ? '#C46505' : '#16A34A'}">${money(invoice.outstandingXof)}</div>
          <!-- En lettres : sur une facture, c'est ce montant qui fait foi contre
               les chiffres, et il protège le document d'une retouche. -->
          <div class="inWords">${esc(amountInWordsXof(invoice.outstandingXof))}</div>
        </div>
      </div>
    </div>

    <div class="signRow">
      <div class="signCell"><div class="sectionLabel">POUR ACCORD &amp; RÉCEPTION</div><div class="signLine"></div></div>
      <div class="signCell"><div class="sectionLabel">SIGNATURE &amp; CACHET</div><div class="signLine"></div></div>
    </div>
  </div>
  <div class="footer">${esc(issuer.name)} — Facture ${esc(invoice.invoiceNumber)} · générée le ${frDate(new Date().toISOString())}<img class="mark" src="${BRAND_MARK_PNG}" alt=""> <span class="markName">Jawdi</span></div>
</body></html>`;
}
