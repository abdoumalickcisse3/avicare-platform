import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import SettingsHubPage from "./page";

describe("SettingsHubPage", () => {
  it("renders the settings category cards", () => {
    renderWithProviders(<SettingsHubPage />);
    expect(screen.getByRole("heading", { name: "Réglages" })).toBeInTheDocument();
    ["Stock", "Lots", "Sanitaire", "Ventes", "Comptabilité", "Notifications"].forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("link", { name: /gérer/i })).toHaveLength(6);
  });

  it("links each card to its category route", () => {
    renderWithProviders(<SettingsHubPage />);
    const links = screen.getAllByRole("link", { name: /gérer/i });
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/reglages/stock");
    expect(hrefs).toContain("/reglages/comptabilite");
    expect(hrefs).toContain("/reglages/notifications");
  });
});
