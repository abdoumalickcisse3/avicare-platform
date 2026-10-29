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
    const html = invoiceHtml({ invoice: INVOICE, client: CLIENT, issuer: { name: 'Ferme Complète' } });

    expect(html).toContain('Ferme Complète');
    expect(html).toContain('F-2026-007');
    expect(html).toContain('Partielle');
    expect(html).toContain('Œufs de consommation');
    expect(html).toContain('Marché Kermel, Dakar');
    // Dates au format français, comme le PDF du web.
    expect(html).toContain('05/09/2026');
    expect(html).toContain('05/10/2026');
    // Les trois totaux.
    expect(html).toMatch(/Total<[\s\S]*?42/);
    expect(html).toMatch(/RESTE DÛ[\s\S]*?30/);
    // Et le reste dû en toutes lettres, qui fait foi contre les chiffres.
    expect(html).toContain('Trente mille francs CFA');
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
      issuer: { name: 'Ferme' },
    });

    expect(html).toContain('Ets Diop &amp; &lt;b&gt;Fils&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x</script>');
  });

  it('omet la ligne échéance quand il n\'y en a pas', () => {
    const html = invoiceHtml({
      invoice: { ...INVOICE, dueDate: null } as unknown as Invoice,
      client: CLIENT,
      issuer: { name: 'Ferme' },
    });

    expect(html).toContain("Date d'émission");
    expect(html).not.toContain("Date d'échéance");
  });

  it('dit « Comptant » sur une vente sans client', () => {
    const html = invoiceHtml({
      invoice: { ...INVOICE, clientId: null } as unknown as Invoice,
      client: null,
      issuer: { name: 'Ferme' },
    });

    expect(html).toContain('Comptant');
  });
  it("porte l'identité de la ferme en tête : logo, lieu et mentions légales", () => {
    const html = invoiceHtml({
      invoice: INVOICE,
      client: CLIENT,
      issuer: {
        name: 'Ferme Complète',
        location: 'Thiès',
        ninea: '008492019 2V2',
        rccm: 'SN-KLK-2021-A-1402',
        logo: 'data:image/png;base64,AAAA',
      },
    });

    const header = html.slice(html.indexOf('class="header"'), html.indexOf('class="footer"'));
    expect(header).toContain('Thiès');
    expect(header).toContain('NINEA : 008492019 2V2');
    expect(header).toContain('RC : SN-KLK-2021-A-1402');
    expect(header).toContain('src="data:image/png;base64,AAAA"');
  });

  it("n'affiche ni logo ni mentions quand la ferme n'en a pas, sans laisser de trou", () => {
    const html = invoiceHtml({ invoice: INVOICE, client: CLIENT, issuer: { name: 'Ferme Nue' } });

    const header = html.slice(html.indexOf('class="header"'), html.indexOf('class="footer"'));
    expect(header).toContain('Ferme Nue');
    expect(header).not.toContain('class="logo"');
    expect(header).not.toContain('NINEA');
  });

  it('signale une facture en retard, et se tait sur une facture payée', () => {
    const late = invoiceHtml({
      invoice: { ...INVOICE, dueDate: '2020-01-01' } as unknown as Invoice,
      client: CLIENT,
      issuer: { name: 'Ferme' },
    });
    expect(late).toMatch(/En retard de \d+ j/);

    // Rappeler une échéance sur un document soldé ne ferait qu'inquiéter le client.
    const paid = invoiceHtml({
      invoice: { ...INVOICE, dueDate: '2020-01-01', status: 'PAID' } as unknown as Invoice,
      client: CLIENT,
      issuer: { name: 'Ferme' },
    });
    expect(paid).not.toContain('En retard');
  });

  it('signe le document en pied de page, jamais en en-tête', () => {
    const html = invoiceHtml({ invoice: INVOICE, client: CLIENT, issuer: { name: 'Ferme Complète' } });

    // La marque Jawdi est dans le pied de page...
    const footer = html.slice(html.indexOf('class="footer"'));
    expect(footer).toContain('data:image/png;base64,');
    expect(footer).toContain('Jawdi');

    // ...et l'en-tête reste au nom de la ferme : la facture lui appartient,
    // c'est elle qui la remet à son client.
    const header = html.slice(html.indexOf('class="header"'), html.indexOf('class="footer"'));
    expect(header).toContain('Ferme Complète');
    expect(header).not.toContain('Jawdi');
  });

  it("nomme le champ fiscal selon le pays de la ferme", () => {
    const html = invoiceHtml({
      invoice: INVOICE,
      issuer: { name: 'Ferme', ninea: '12345', taxIdLabel: 'N° contribuable' },
    });

    expect(html).toContain('N° contribuable : 12345');
    expect(html).not.toContain('NINEA');
  });

  it("retombe sur NINEA quand la ferme n'a pas encore de pays", () => {
    const html = invoiceHtml({ invoice: INVOICE, issuer: { name: 'Ferme', ninea: '12345' } });

    expect(html).toContain('NINEA : 12345');
  });
});
