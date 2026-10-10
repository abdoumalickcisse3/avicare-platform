import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { PhoneField } from "./PhoneField";

/** Controlled, like every real usage: the parent feeds the new value back. */
function Controlled({ initial = "", onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneField
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("PhoneField", () => {
  it("montre le pays du numéro stocké et seulement la partie locale", () => {
    renderWithProviders(<PhoneField value="+2290156343408" onChange={vi.fn()} />);

    expect(screen.getByText("🇧🇯 +229")).toBeInTheDocument();
    // Le zéro béninois fait partie du numéro : il reste visible.
    expect(screen.getByDisplayValue("0156343408")).toBeInTheDocument();
  });

  it("rend un E.164 complet quand on saisit la partie locale", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Controlled onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Téléphone"), "771842787");

    expect(onChange).toHaveBeenLastCalledWith("+221771842787");
  });

  it("ne double pas l'indicatif quand on colle un numéro entier", async () => {
    // Sans ce garde-fou : +221221771234567, seize chiffres, la forme qui a cassé WhatsApp.
    const onChange = vi.fn();
    renderWithProviders(<Controlled onChange={onChange} />);

    await userEvent.click(screen.getByLabelText("Téléphone"));
    await userEvent.paste("+221771234567");

    expect(onChange).toHaveBeenLastCalledWith("+221771234567");
  });

  it("part du Sénégal sur un champ vide", () => {
    renderWithProviders(<PhoneField value={null} onChange={vi.fn()} />);
    expect(screen.getByText("🇸🇳 +221")).toBeInTheDocument();
  });

  it("donne à l'indicatif la même taille qu'au champ voisin", () => {
    // Le thème met tout TextField en `size: small` (40px). Un Select déclare sa propre taille et
    // retombait sur les 56px par défaut de MUI : l'indicatif débordait le numéro de 16px.
    renderWithProviders(<PhoneField value={null} onChange={vi.fn()} />);

    const indicatif = screen.getByLabelText(/Indicatif pays/).closest(".MuiInputBase-root");
    const numero = screen.getByLabelText("Téléphone").closest(".MuiInputBase-root");

    expect(indicatif).toHaveClass("MuiInputBase-sizeSmall");
    expect(numero).toHaveClass("MuiInputBase-sizeSmall");
  });

  it("ne laisse pas le message d'erreur étirer l'indicatif", () => {
    // Une rangée flex étire ses enfants sur le plus haut : sans `flex-start`, le texte d'aide
    // apparaissant sous le numéro rendait l'indicatif 22px plus haut que lui.
    renderWithProviders(
      <PhoneField value={null} onChange={vi.fn()} error helperText="Numéro invalide" />,
    );

    const rangee = screen.getByLabelText("Téléphone").closest(".MuiStack-root");

    expect(rangee).toHaveStyle({ alignItems: "flex-start" });
  });
});
