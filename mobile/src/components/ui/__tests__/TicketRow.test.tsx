import { render, screen } from '@testing-library/react-native';
import { TicketRow } from '../TicketRow';

describe('TicketRow', () => {
  it('affiche la valeur et le libellé de chaque colonne', async () => {
    await render(
      <TicketRow
        items={[
          { key: 'a', value: '42', label: 'Clients' },
          { key: 'b', value: '7', label: 'Débiteurs' },
        ]}
      />,
    );
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Clients')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Débiteurs')).toBeTruthy();
  });

  it('applique la couleur tint à la valeur quand elle est fournie', async () => {
    await render(<TicketRow items={[{ key: 'a', value: '7', label: 'Débiteurs', tint: '#F8961E' }]} />);
    expect(screen.getByText('7').props.style).toContainEqual(
      expect.objectContaining({ color: '#F8961E' }),
    );
  });

  it("accepte de 2 à 4 colonnes sans les tronquer", async () => {
    await render(
      <TicketRow
        items={[
          { key: 'a', value: '1', label: 'Un' },
          { key: 'b', value: '2', label: 'Deux' },
          { key: 'c', value: '3', label: 'Trois' },
          { key: 'd', value: '4', label: 'Quatre' },
        ]}
      />,
    );
    expect(screen.getByText('Quatre')).toBeTruthy();
  });
});
