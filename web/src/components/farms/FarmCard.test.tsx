import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { FarmCard } from "./FarmCard";
import type { Farm } from "@/types";

const baseFarm: Farm = {
  id: 7,
  name: "Ferme de Thiès",
  description: null,
  location: "Thiès, Sénégal",
  gpsLatitude: null,
  gpsLongitude: null,
  capacity: 5000,
  timezone: null,
  currency: null,
  createdBy: 1,
  active: true,
  createdAt: "2026-01-01T00:00:00",
};

describe("FarmCard", () => {
  it("renders name, location and capacity", () => {
    renderWithProviders(<FarmCard farm={baseFarm} />);
    expect(screen.getByText("Ferme de Thiès")).toBeInTheDocument();
    expect(screen.getByText("Thiès, Sénégal")).toBeInTheDocument();
    expect(screen.getByText(/capacité/i)).toHaveTextContent("5");
    expect(screen.getByText("Opérationnel")).toBeInTheDocument();
  });

  it("links to the farm detail route", () => {
    renderWithProviders(<FarmCard farm={baseFarm} />);
    expect(
      screen.getByRole("link", { name: /gérer l'exploitation/i }),
    ).toHaveAttribute("href", "/fermes/7");
  });

  it("falls back gracefully when location is missing", () => {
    renderWithProviders(<FarmCard farm={{ ...baseFarm, location: null }} />);
    expect(screen.getByText(/localisation non renseignée/i)).toBeInTheDocument();
  });

  it("shows an inactive badge when the farm is not active", () => {
    renderWithProviders(<FarmCard farm={{ ...baseFarm, active: false }} />);
    expect(screen.getByText("Inactif")).toBeInTheDocument();
  });
});
