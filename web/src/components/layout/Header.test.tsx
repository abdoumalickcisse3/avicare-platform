import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/stocks/achats",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/useSelectedFarm", () => ({
  useSelectedFarm: () => ({ farmId: 1, isLoading: false, hasFarm: true }),
}));

vi.mock("@/store/api/farmsApi", () => ({
  useGetMyFarmsQuery: () => ({ data: [{ id: 1, name: "Ferme Test" }] }),
}));

describe("Header", () => {
  it("shows the page context derived from the route", () => {
    renderWithProviders(<Header onMenuClick={vi.fn()} />);
    expect(screen.getByText("Bons d'achat")).toBeInTheDocument(); // title
    expect(screen.getByText("Stocks")).toBeInTheDocument(); // parent crumb
  });

  it("shows the current farm in the selector + the notifications bell", () => {
    renderWithProviders(<Header onMenuClick={vi.fn()} />);
    expect(screen.getByText("Ferme Test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compte/i })).toBeInTheDocument();
  });
});
