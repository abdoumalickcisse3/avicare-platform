/**
 * Tray corrections: which endpoint each mode uses, and why that matters.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TrayStockSheet } from '../TrayStockSheet';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

function setup(over: Partial<React.ComponentProps<typeof TrayStockSheet>> = {}) {
  const onAdjust = jest.fn();
  const onRecount = jest.fn();
  const props = {
    open: true,
    fullTraysCount: 147,
    emptyTraysCount: 30,
    saving: false,
    onClose: jest.fn(),
    onAdjust,
    onRecount,
    ...over,
  };
  return { onAdjust, onRecount, props };
}

/** Types a number on the built-in keypad. */
const key = async (digit: string) => press(screen.getByLabelText(digit));

describe('TrayStockSheet', () => {
  it('defaults to a relative correction, which composes when two people count', async () => {
    // Absolute writes overwrite one another; deltas add up. "+12" is also what a farmer knows.
    const { onAdjust, props } = setup();
    await render(<TrayStockSheet {...props} />);

    await key('1');
    await key('2');
    await press(screen.getByLabelText('Enregistrer les plateaux'));

    expect(onAdjust).toHaveBeenCalledWith({ fullDelta: 12, emptyDelta: 0 });
  });

  it('sends a negative delta when removing', async () => {
    const { onAdjust, props } = setup();
    await render(<TrayStockSheet {...props} />);

    await press(screen.getByLabelText('Retirer'));
    await key('5');
    await press(screen.getByLabelText('Enregistrer les plateaux'));

    expect(onAdjust).toHaveBeenCalledWith({ fullDelta: -5, emptyDelta: 0 });
  });

  it('targets the empty trays without touching the full ones', async () => {
    const { onAdjust, props } = setup();
    await render(<TrayStockSheet {...props} />);

    await press(screen.getByLabelText('Plateaux vides'));
    await key('7');
    await press(screen.getByLabelText('Enregistrer les plateaux'));

    expect(onAdjust).toHaveBeenCalledWith({ fullDelta: 0, emptyDelta: 7 });
  });

  it('switches to the absolute write only for a recount, and keeps the other count', async () => {
    const { onRecount, props } = setup();
    await render(<TrayStockSheet {...props} />);

    await press(screen.getByLabelText('Recompter'));
    await key('9');
    await key('0');
    await press(screen.getByLabelText('Enregistrer les plateaux'));

    expect(onRecount).toHaveBeenCalledWith({ fullTraysCount: 90, emptyTraysCount: 30 });
  });

  it('shows the resulting count before the write, not after', async () => {
    const { props } = setup();
    await render(<TrayStockSheet {...props} />);

    await key('3');
    expect(screen.getByText('Pleins après : 150')).toBeTruthy();
  });

  it('warns when removing more than the known stock, and still allows it', async () => {
    // The store can genuinely be wrong; blocking the correction would trap the count.
    const { onAdjust, props } = setup({ fullTraysCount: 4 });
    await render(<TrayStockSheet {...props} />);

    await press(screen.getByLabelText('Retirer'));
    await key('9');

    expect(screen.getByText(/plus que le stock connu/)).toBeTruthy();

    await press(screen.getByLabelText('Enregistrer les plateaux'));
    expect(onAdjust).toHaveBeenCalledWith({ fullDelta: -9, emptyDelta: 0 });
  });

  it('refuses an empty relative correction, which would write nothing', async () => {
    const { onAdjust, props } = setup();
    await render(<TrayStockSheet {...props} />);

    await press(screen.getByLabelText('Enregistrer les plateaux'));

    expect(onAdjust).not.toHaveBeenCalled();
  });
});
