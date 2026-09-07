/**
 * La facture, en HTML prêt pour `expo-print`.
 *
 * Même document que le PDF du web (`InvoicePdfDocument`) : barre orange, en-tête ferme + numéro,
 * « Facturé à », dates, lignes, totaux, pied de page. Le web le rend avec react-pdf, qui ne
 * tourne pas en React Native ; ici c'est du HTML que le moteur d'impression du téléphone
 * transforme en PDF. Deux moteurs, un seul document — les libellés et l'ordre des blocs se
 * suivent volontairement, pour qu'une facture soit reconnaissable quelle que soit sa provenance.
 *
 * Le HTML est **assemblé, jamais concaténé depuis des données brutes** : tout ce qui vient du
 * serveur passe par `esc()`. Un client nommé « Ets Diop & <fils> » ne doit pas casser la mise en
 * page, et un libellé d'article ne doit pas pouvoir injecter de balise.
 */
import type { Client, Invoice } from '@/types';
import { INVOICE_STATUS_LABELS } from '@/lib/commercial';

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
  return `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, '&nbsp;')}&nbsp;F`;
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

export function invoiceHtml({
  invoice,
  client,
  farmName,
}: {
  invoice: Invoice;
  client?: Client | null;
  farmName: string;
}): string {
  const tint = STATUS_TINT[invoice.status] ?? DEFAULT_TINT;
  const billedTo =
    client?.displayName ?? (invoice.clientId ? `Client #${invoice.clientId}` : 'Comptant');
  const outstandingColor = invoice.outstandingXof > 0 ? '#DC2626' : '#16A34A';

  const rows = (invoice.items ?? [])
    .map(
      (it) => `
      <tr>
        <td>${esc(it.articleLabelSnapshot ?? it.articleKey)}</td>
        <td class="num">${esc(it.quantity)} ${esc(it.unit ?? '')}</td>
        <td class="num">${money(it.unitPriceXof)}</td>
        <td class="num strong">${money(it.lineTotalXof)}</td>
      </tr>`,
    )
    .join('');

  const clientLines = [
    client?.address ? `${esc(client.address)}${client.city ? `, ${esc(client.city)}` : ''}` : '',
    client?.phone ? esc(client.phone) : '',
  ]
    .filter(Boolean)
    .map((l) => `<div class="muted">${l}</div>`)
    .join('');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Facture ${esc(invoice.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #292524; line-height: 1.45; }
  .sheet { padding: 44px; }
  .accent { height: 6px; background: #F8961E; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .farm { font-size: 19px; font-weight: bold; color: #2E6B2E; }
  .doclabel { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #78716C; margin-top: 2px; }
  .number { font-size: 15px; font-weight: bold; text-align: right; }
  .pill { display: inline-block; margin-top: 4px; padding: 3px 9px; border-radius: 10px; font-size: 10px; font-weight: bold;
          background: ${tint.bg}; color: ${tint.fg}; }
  .rule { border-top: 1px solid #E7E5E4; margin: 4px 0 16px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
  .label { font-size: 9px; letter-spacing: .8px; text-transform: uppercase; color: #78716C; margin-bottom: 3px; }
  .strong { font-weight: bold; }
  .muted { color: #78716C; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; letter-spacing: .8px; text-transform: uppercase; color: #78716C;
       border-bottom: 1px solid #E7E5E4; padding: 6px 4px; }
  td { padding: 7px 4px; border-bottom: 1px solid #F5F5F4; }
  .num { text-align: right; white-space: nowrap; }
  .totals { display: flex; justify-content: flex-end; margin-top: 18px; }
  .totalsBox { width: 240px; }
  .line { display: flex; justify-content: space-between; padding: 3px 0; }
  .totalsRule { border-top: 1px solid #E7E5E4; margin: 6px 0; }
  .final { font-size: 13px; font-weight: bold; }
  .notes { margin-top: 22px; }
  .footer { position: fixed; bottom: 24px; left: 44px; right: 44px; text-align: center;
            font-size: 9px; color: #A8A29E; }
</style></head>
<body>
  <div class="accent"></div>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="farm">${esc(farmName)}</div>
        <div class="doclabel">Facture</div>
      </div>
      <div>
        <div class="number">${esc(invoice.invoiceNumber)}</div>
        <div style="text-align:right"><span class="pill">${esc(INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status)}</span></div>
      </div>
    </div>
    <div class="rule"></div>

    <div class="meta">
      <div>
        <div class="label">Facturé à</div>
        <div class="strong">${esc(billedTo)}</div>
        ${clientLines}
      </div>
      <div style="width:200px">
        <div class="label">Dates</div>
        <div><span class="strong">Émission :</span> ${frDate(invoice.issueDate)}</div>
        ${invoice.dueDate ? `<div><span class="strong">Échéance :</span> ${frDate(invoice.dueDate)}</div>` : ''}
      </div>
    </div>

    <table>
      <thead><tr>
        <th>Produit</th><th class="num">Qté</th><th class="num">PU (HT)</th><th class="num">Total (HT)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals"><div class="totalsBox">
      <div class="line"><span class="muted">Total (HT)</span><span>${money(invoice.totalXof)}</span></div>
      <div class="line"><span class="muted">Payé</span><span style="color:#16A34A">${money(invoice.amountPaidXof)}</span></div>
      <div class="totalsRule"></div>
      <div class="line final"><span>Reste dû</span><span style="color:${outstandingColor}">${money(invoice.outstandingXof)}</span></div>
    </div></div>

  </div>
  <div class="footer">${esc(farmName)} — Facture ${esc(invoice.invoiceNumber)} · générée le ${frDate(new Date().toISOString())}</div>
</body></html>`;
}
