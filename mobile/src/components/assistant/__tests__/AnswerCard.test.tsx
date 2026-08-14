import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockSpeak = jest.fn();
jest.mock('@/assistant/speech/tts', () => ({ speak: (...args: unknown[]) => mockSpeak(...args) }));

import { AnswerCard } from '@/components/assistant/AnswerCard';

describe('AnswerCard', () => {
  beforeEach(() => mockSpeak.mockClear());

  it('shows the answer text and reads it aloud', async () => {
    await render(<AnswerCard answer="Il vous reste 40 sacs d'aliment." onClose={jest.fn()} />);

    expect(screen.getByText("Il vous reste 40 sacs d'aliment.")).toBeTruthy();
    expect(mockSpeak).toHaveBeenCalledWith("Il vous reste 40 sacs d'aliment.");
  });

  it('calls onClose when Fermer is tapped', async () => {
    const onClose = jest.fn();
    await render(<AnswerCard answer="Marge : 200000 F CFA." onClose={onClose} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Fermer la réponse'));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
