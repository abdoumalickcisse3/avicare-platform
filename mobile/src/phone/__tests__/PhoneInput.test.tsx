import { useState } from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { PhoneInput } from '@/phone/PhoneInput';

/**
 * PhoneInput is controlled: without a parent feeding the new value back, every keystroke starts
 * from the same empty string. This harness is how the field is actually used in a screen.
 */
function Controlled({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('PhoneInput', () => {
  it('montre le pays du numéro déjà stocké, et seulement la partie locale', async () => {
    await render(<PhoneInput value="+2290156343408" onChange={jest.fn()} />);

    expect(screen.getByText('+229')).toBeTruthy();
    // Le zéro béninois fait partie du numéro : il doit rester visible.
    expect(screen.getByDisplayValue('0156343408')).toBeTruthy();
  });

  it('rend un E.164 complet quand on saisit la partie locale', async () => {
    const onChange = jest.fn();
    await render(<Controlled onChange={onChange} />);

    await userEvent.type(screen.getByDisplayValue(''), '771842787');

    expect(onChange).toHaveBeenLastCalledWith('+221771842787');
  });

  it('change d’indicatif sans perdre le numéro déjà tapé', async () => {
    const onChange = jest.fn();
    await render(<PhoneInput value="+221771842787" onChange={onChange} />);

    await userEvent.press(screen.getByLabelText(/Indicatif pays/));
    await userEvent.press(screen.getByLabelText('Bénin'));

    expect(onChange).toHaveBeenCalledWith('+229771842787');
  });

  it('ne double pas l’indicatif quand on colle un numéro entier', async () => {
    // Le réflexe de tout le monde : coller « +221 77 123 45 67 ». Sans ce garde-fou on obtenait
    // +221221771234567 — seize chiffres, la forme même qui a cassé WhatsApp.
    const onChange = jest.fn();
    await render(<Controlled onChange={onChange} />);

    await userEvent.paste(screen.getByDisplayValue(''), '+221771234567');

    expect(onChange).toHaveBeenLastCalledWith('+221771234567');
  });

  it('part du Sénégal sur un champ vide — là où sont les fermes', async () => {
    await render(<PhoneInput value={null} onChange={jest.fn()} />);
    expect(screen.getByText('+221')).toBeTruthy();
  });
});
