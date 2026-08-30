/**
 * The keypad's contract. React 19 + RNTL 14 defer the state update `fireEvent` schedules,
 * so every interaction is wrapped in an async `act` and `render` is awaited.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { NumericKeypad } from '../NumericKeypad';

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

const longPress = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent(el, 'longPress');
  });
};

async function setup(props: Partial<React.ComponentProps<typeof NumericKeypad>> = {}) {
  const onChange = jest.fn();
  const utils = await render(
    <NumericKeypad value={props.value ?? ''} onChange={onChange} {...props} />,
  );
  return { ...utils, onChange };
}

describe('NumericKeypad', () => {
  it('appends the digit that was pressed', async () => {
    const { getByLabelText, onChange } = await setup({ value: '12' });

    await press(getByLabelText('4'));

    expect(onChange).toHaveBeenCalledWith('124');
  });

  it('shows a zero rather than an empty display', async () => {
    const { getByLabelText } = await setup({ value: '' });

    // An empty display reads as a broken screen; "0" reads as "nothing entered yet".
    // Queried by label, not text: the "0" key carries the same string.
    expect(getByLabelText('Valeur saisie : 0')).toBeTruthy();
  });

  it('deletes one character, and clears on a long press', async () => {
    const { getByLabelText, onChange } = await setup({ value: '1240' });

    await press(getByLabelText('Effacer'));
    expect(onChange).toHaveBeenLastCalledWith('124');

    await longPress(getByLabelText('Effacer'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('does nothing when there is nothing to delete', async () => {
    const { getByLabelText, onChange } = await setup({ value: '' });

    await press(getByLabelText('Effacer'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('hides the decimal key rather than disabling it', async () => {
    const { queryByLabelText } = await setup({ value: '5', allowDecimal: false });

    // A dead key invites a press, and a press that does nothing reads as a broken screen.
    expect(queryByLabelText('Virgule')).toBeNull();
  });

  it('offers the decimal key when decimals are allowed', async () => {
    const { getByLabelText, onChange } = await setup({ value: '5', allowDecimal: true });

    await press(getByLabelText('Virgule'));

    expect(onChange).toHaveBeenCalledWith('5,');
  });

  it('allows only one decimal separator', async () => {
    const { getByLabelText, onChange } = await setup({ value: '2,5', allowDecimal: true });

    await press(getByLabelText('Virgule'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a leading separator', async () => {
    const { getByLabelText, onChange } = await setup({ value: '', allowDecimal: true });

    // ",5" is not a number anybody means to type.
    await press(getByLabelText('Virgule'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops at maxLength, silently', async () => {
    const { getByLabelText, onChange } = await setup({ value: '999', maxLength: 3 });

    await press(getByLabelText('7'));

    // An error message saying "you have typed enough" is noise on a field screen.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('counts digits, not characters, against maxLength', async () => {
    const { getByLabelText, onChange } = await setup({
      value: '12,',
      maxLength: 4,
      allowDecimal: true,
    });

    // Two digits so far; the separator must not eat into the budget.
    await press(getByLabelText('5'));

    expect(onChange).toHaveBeenCalledWith('12,5');
  });

  it('announces the entered value to a screen reader', async () => {
    const { getByLabelText } = await setup({ value: '340' });

    expect(getByLabelText('Valeur saisie : 340')).toBeTruthy();
  });
});
