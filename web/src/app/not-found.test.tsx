import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("says in French that the page does not exist", () => {
    renderWithProviders(<NotFound />);

    expect(screen.getByText(/page introuvable/i)).toBeInTheDocument();
  });

  it("offers a way back rather than leaving the visitor stranded", () => {
    renderWithProviders(<NotFound />);

    const link = screen.getByRole("link", { name: /tableau de bord/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("shows no reference to read out", () => {
    renderWithProviders(<NotFound />);

    // A wrong URL has nothing to find in /console/traces. Printing a reference here would
    // teach the reader to ignore them — including on the 500 page, where one is real.
    expect(screen.queryByText(/référence/i)).not.toBeInTheDocument();
  });
});
