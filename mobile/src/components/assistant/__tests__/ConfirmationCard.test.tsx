import { render, screen } from '@testing-library/react-native';

jest.mock('@/assistant/speech/tts', () => ({ speak: jest.fn() }));

import { ConfirmationCard } from '@/components/assistant/ConfirmationCard';
import type { ConfirmationDraft } from '@/assistant/types';

const draft = (risk: ConfirmationDraft['risk']): ConfirmationDraft => ({
  intent: { kind: 'MORTALITY', count: 10, unitId: 3 },
  title: 'Mortalité',
  lines: [{ label: 'Sujets morts', value: '10' }],
  speech: 'Mortalité de 10 sujets. Confirmer ?',
  risk,
});

describe('ConfirmationCard risk', () => {
  it('shows an "À vérifier" badge for a HIGH-risk draft', async () => {
    await render(<ConfirmationCard draft={draft('HIGH')} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('À vérifier')).toBeTruthy();
  });

  it('shows an "Attention" badge for a MEDIUM-risk draft', async () => {
    await render(<ConfirmationCard draft={draft('MEDIUM')} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Attention')).toBeTruthy();
  });

  it('shows no risk badge for a LOW-risk draft', async () => {
    await render(<ConfirmationCard draft={draft('LOW')} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByText('À vérifier')).toBeNull();
    expect(screen.queryByText('Attention')).toBeNull();
  });
});
