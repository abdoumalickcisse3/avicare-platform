import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { JawdiFab } from "./JawdiFab";

let mockPathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("JawdiFab", () => {
  it("se présente comme quelqu’un, et mène à l’assistant", () => {
    mockPathname = "/dashboard";
    renderWithProviders(<JawdiFab />);

    const link = screen.getByRole("link", { name: /Jawdi IA, votre conseiller/ });
    expect(link).toHaveAttribute("href", "/assistant");
    expect(screen.getByText("Jawdi IA")).toBeInTheDocument();
  });

  it("montre un visage, pas une icône", () => {
    mockPathname = "/dashboard";
    renderWithProviders(<JawdiFab />);

    expect(screen.getByTestId("jawdi-eyes-open")).toBeInTheDocument();
    expect(screen.getByTestId("jawdi-eyes-closed")).toBeInTheDocument();
  });

  it("s’efface sur la page de l’assistant — on y est déjà", () => {
    mockPathname = "/assistant";
    renderWithProviders(<JawdiFab />);

    expect(screen.queryByText("Jawdi IA")).not.toBeInTheDocument();
  });

  it("s’efface sur une facture à imprimer, qui ne porte aucun habillage", () => {
    mockPathname = "/commercial/factures/12/imprimer";
    renderWithProviders(<JawdiFab />);

    expect(screen.queryByText("Jawdi IA")).not.toBeInTheDocument();
  });
});
