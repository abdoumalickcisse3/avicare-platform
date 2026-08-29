import { fireEvent, render } from '@testing-library/react-native';
import { act } from 'react';
import { AnnouncementBanner } from '../AnnouncementBanner';
import { useGetActiveAnnouncementsQuery } from '@/store/api/announcementsApi';

jest.mock('@/store/api/announcementsApi', () => ({
  useGetActiveAnnouncementsQuery: jest.fn(),
}));

const mockQuery = useGetActiveAnnouncementsQuery as jest.Mock;

const ANNOUNCEMENT = {
  id: 4,
  title: 'Maintenance samedi',
  body: 'Le service sera interrompu de 8h à 10h.',
  severity: 'WARNING' as const,
  startsAt: '2026-08-29T00:00:00',
  endsAt: null,
  published: true,
};

describe('AnnouncementBanner', () => {
  it('shows an active announcement', async () => {
    mockQuery.mockReturnValue({ data: [ANNOUNCEMENT] });
    const { getByText } = await render(<AnnouncementBanner />);

    expect(getByText('Maintenance samedi')).toBeTruthy();
    expect(getByText(/interrompu de 8h à 10h/)).toBeTruthy();
  });

  it('renders nothing when there is nothing to say', async () => {
    mockQuery.mockReturnValue({ data: [] });
    const { toJSON } = await render(<AnnouncementBanner />);

    // An empty banner still takes vertical space and pushes the screen down.
    expect(toJSON()).toBeNull();
  });

  it('closes one announcement without hiding the others', async () => {
    const second = { ...ANNOUNCEMENT, id: 5, title: 'Nouvelle version' };
    mockQuery.mockReturnValue({ data: [ANNOUNCEMENT, second] });
    const { getByLabelText, queryByText, getByText } = await render(<AnnouncementBanner />);

    await act(async () => {
      fireEvent.press(getByLabelText("Fermer l'annonce Maintenance samedi"));
    });

    expect(queryByText('Maintenance samedi')).toBeNull();
    expect(getByText('Nouvelle version')).toBeTruthy();
  });

  it('survives a severity it does not know', async () => {
    mockQuery.mockReturnValue({
      data: [{ ...ANNOUNCEMENT, severity: 'SOMETHING_NEW' as unknown as 'INFO' }],
    });
    const { getByText } = await render(<AnnouncementBanner />);

    // A severity added server-side must not blank a platform message on older phones.
    expect(getByText('Maintenance samedi')).toBeTruthy();
  });
});
