/**
 * The counter's contract. React 19 + RNTL 14 defer the state update `fireEvent` schedules
 * past the synchronous `act` wrapper, so every interaction is wrapped in an async `act`.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { Counter } from '../Counter';

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

// RNTL 14 returns a promise from `render`; awaiting it is the codebase convention.
async function setup(props: Partial<React.ComponentProps<typeof Counter>> = {}) {
  const onChange = jest.fn();
  const utils = await render(
    <Counter value={props.value ?? 0} onChange={onChange} label="Mortalité" {...props} />,
  );
  return { ...utils, onChange };
}

describe('Counter', () => {
  it('adds and removes one step at a time', async () => {
    const { getByLabelText, onChange } = await setup({ value: 5 });

    await press(getByLabelText('Ajouter 1'));
    expect(onChange).toHaveBeenLastCalledWith(6);

    await press(getByLabelText('Retirer 1'));
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('steps by ten on a long press', async () => {
    const { getByLabelText, onChange } = await setup({ value: 0 });

    // Counting forty deaths one tap at a time is how people stop counting and start guessing.
    await longPress(getByLabelText('Ajouter 1'));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('does not also fire the tap that ends a long press', async () => {
    const { getByLabelText, onChange } = await setup({ value: 0 });
    const plus = getByLabelText('Ajouter 1');

    await longPress(plus);
    // React Native fires `press` after `longPress` when the finger lifts.
    await press(plus);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('refuses to go below the floor', async () => {
    const { getByLabelText, onChange } = await setup({ value: 0 });

    await press(getByLabelText('Retirer 1'));

    // No field quantity is negative, and a counter that goes to -1 makes the farmer distrust it.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps a long press to the floor rather than overshooting', async () => {
    const { getByLabelText, onChange } = await setup({ value: 3 });

    await longPress(getByLabelText('Retirer 1'));

    // −10 from 3 is 0, not −7.
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('respects a ceiling when one is given', async () => {
    const { getByLabelText, onChange } = await setup({ value: 98, max: 100 });

    await longPress(getByLabelText('Ajouter 1'));
    expect(onChange).toHaveBeenCalledWith(100);

    onChange.mockClear();
    const { getByLabelText: atMax, onChange: onChangeAtMax } = await setup({ value: 100, max: 100 });
    await press(atMax('Ajouter 1'));
    expect(onChangeAtMax).not.toHaveBeenCalled();
  });

  it('keeps a disabled pad in the layout', async () => {
    const { getByLabelText } = await setup({ value: 0 });

    // It is muted, not removed: a pad that vanishes slides its neighbour under a thumb
    // already on its way down.
    expect(getByLabelText('Retirer 1')).toBeTruthy();
  });

  it('honours a custom step in the label and the value', async () => {
    const { getByLabelText, onChange } = await setup({ value: 0, step: 5 });

    expect(getByLabelText('Ajouter 5')).toBeTruthy();
    await press(getByLabelText('Ajouter 5'));
    expect(onChange).toHaveBeenCalledWith(5);

    await longPress(getByLabelText('Ajouter 5'));
    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('announces the value to a screen reader', async () => {
    const { getByLabelText } = await setup({ value: 12 });

    expect(getByLabelText('Mortalité : 12')).toBeTruthy();
  });

  it('tells the user about the long press without them discovering it', async () => {
    const { getByText } = await setup({ value: 0 });

    // An undiscoverable shortcut is a shortcut nobody uses.
    expect(getByText("Appui long : 10 d'un coup")).toBeTruthy();
  });
});
