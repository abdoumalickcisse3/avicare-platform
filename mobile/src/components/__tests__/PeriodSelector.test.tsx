/** The period selector, and the state it writes to. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PeriodSelector } from '../PeriodSelector';
import { selectPeriod, setPeriod } from '@/store/slices/selectionSlice';

const mockDispatch = jest.fn();
let mockPeriod = '30d';

jest.mock('react-redux', () => ({
  useSelector: (fn: unknown) => (typeof fn === 'function' ? mockPeriod : mockPeriod),
  useDispatch: () => mockDispatch,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPeriod = '30d';
});

describe('PeriodSelector', () => {
  it('offers the three windows a farmer compares over', async () => {
    await render(<PeriodSelector />);

    expect(screen.getByLabelText('Période 7 jours')).toBeTruthy();
    expect(screen.getByLabelText('Période 30 jours')).toBeTruthy();
    expect(screen.getByLabelText('Période 90 jours')).toBeTruthy();
  });

  it('writes the choice to shared state, not to the screen', async () => {
    // Both the dashboard and the farm overview read it: picking 90 days on one and finding the
    // other still on 7 would be two answers to one question.
    await render(<PeriodSelector />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Période 90 jours'));
    });

    expect(mockDispatch).toHaveBeenCalledWith(setPeriod('90d'));
  });

  it('marks the active window for a screen reader, not only by colour', async () => {
    await render(<PeriodSelector />);

    expect(screen.getByLabelText('Période 30 jours').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Période 7 jours').props.accessibilityState.selected).toBe(false);
  });
});

describe('selectPeriod', () => {
  it('falls back for a persisted state written before the field existed', () => {
    // redux-persist rehydrates the old shape after an app update; without this every dashboard
    // query would send period=undefined.
    expect(selectPeriod({ selection: { selectedFarmId: 1 } } as never)).toBe('30d');
  });

  it('returns the stored window', () => {
    expect(selectPeriod({ selection: { selectedFarmId: 1, period: '7d' } } as never)).toBe('7d');
  });
});
