import { invoiceHtml } from '@/commerce/invoiceHtml';
import type { Client, Invoice } from '@/types';

const INVOICE = {
  id: 9,
  farmId: 7,
  invoiceNumber: 'F-2026-007',
  clientId: 3,
  sourceType: 'SALE',
  saleId: 5,
  deliveryId: null,
  status: 'PARTIALLY_PAID',
  issueDate: '2026-09-05',
  dueDate: '2026-10-05',
  totalXof: 42500,
  amountPaidXof: 12500,
  outstandingXof: 30000,
  items: [
    {
      id: 1,
      articleKey: 'eggs_consumption',
      articleSource: 'INVENTORY',
      articleLabelSnapshot: 'Œufs de consommation',
      unit: 'plateau (30)',
      quantity: 10,
      unitPriceXof: 3000,
      lineTotalXof: 30000,
    },
  ],
} as unknown as Invoice;

const CLIENT = {
  id: 3,
  displayName: 'Ets Diop & Fils',
  phone: '77 123 45 67',
  address: 'Marché Kermel',
  city: 'Dakar',
} as unknown as Client;

describe('invoiceHtml', () => {
  it('porte tout ce qui fait une facture', () => {
    const html = invoiceHtml({ invoice: INVOICE, client: CLIENT, farmName: 'Ferme Complète' });

    expect(html).toContain('Ferme Complète');
    expect(html).toContain('F-2026-007');
    expect(html).toContain('Partielle');
    expect(html).toContain('Œufs de consommation');
    expect(html).toContain('Marché Kermel, Dakar');
    // Dates au format français, comme le PDF du web.
    expect(html).toContain('05/09/2026');
    expect(html).toContain('05/10/2026');
    // Les trois totaux.
    expect(html).toMatch(/Total \(HT\)[\s\S]*?42/);
    expect(html).toMatch(/Reste dû[\s\S]*?30/);
  });

  it("échappe ce qui vient du serveur plutôt que de l'injecter", () => {
    // Un nom de client contient très légitimement une esperluette ; un libellé d'article ne doit
    // pas pouvoir fermer une balise et casser la mise en page.
    const html = invoiceHtml({
      invoice: {
        ...INVOICE,
        items: [{ ...INVOICE.items![0], articleLabelSnapshot: '<script>x</script>' }],
      } as unknown as Invoice,
      client: { ...CLIENT, displayName: 'Ets Diop & <b>Fils</b>' } as unknown as Client,
      farmName: 'Ferme',
    });

    expect(html).toContain('Ets Diop &amp; &lt;b&gt;Fils&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x</script>');
  });

  it('omet la ligne échéance quand il n\'y en a pas', () => {
    const html = invoiceHtml({
      invoice: { ...INVOICE, dueDate: null } as unknown as Invoice,
      client: CLIENT,
      farmName: 'Ferme',
    });

    expect(html).toContain('Émission :');
    expect(html).not.toContain('Échéance :');
  });

  it('dit « Comptant » sur une vente sans client', () => {
    const html = invoiceHtml({
      invoice: { ...INVOICE, clientId: null } as unknown as Invoice,
      client: null,
      farmName: 'Ferme',
    });

    expect(html).toContain('Comptant');
  });
});
