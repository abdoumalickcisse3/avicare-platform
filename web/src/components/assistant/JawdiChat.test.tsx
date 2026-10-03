import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { JawdiChat } from "./JawdiChat";

describe("JawdiChat", () => {
  it("accueille avec le visage du bouton — le conseiller qu’on touche est celui qui répond", () => {
    renderWithProviders(<JawdiChat farmId={1} />);

    expect(screen.getByText("Bonjour, je suis Jawdi.")).toBeInTheDocument();
    // Le même visage que le bouton flottant, pas une étincelle.
    expect(screen.getAllByTestId("jawdi-eyes-open").length).toBeGreaterThan(0);
  });
});
