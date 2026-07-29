import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { avicareTheme } from "@/theme";
import { DashboardWelcome } from "./DashboardWelcome";
import { WELCOME_PENDING_KEY } from "./onboardingSteps";

// driver.js touches layout APIs jsdom lacks — mock it and capture the config.
const drive = vi.fn();
const destroy = vi.fn();
let lastConfig: { onDestroyed?: () => void } | undefined;
vi.mock("driver.js", () => ({
  driver: (config: { onDestroyed?: () => void }) => {
    lastConfig = config;
    return { drive, destroy };
  },
}));
vi.mock("driver.js/dist/driver.css", () => ({}));

function renderWelcome() {
  return render(
    <ThemeProvider theme={avicareTheme}>
      <DashboardWelcome />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  drive.mockReset();
  destroy.mockReset();
  lastConfig = undefined;
});

describe("DashboardWelcome", () => {
  it("stays hidden when the welcome flag is not set", () => {
    renderWelcome();
    expect(screen.queryByText("Bienvenue sur Jawdi")).not.toBeInTheDocument();
  });

  it("shows the welcome popup when the flag is set", () => {
    localStorage.setItem(WELCOME_PENDING_KEY, "1");
    renderWelcome();
    expect(screen.getByText("Bienvenue sur Jawdi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
  });

  it("clears the flag and closes when skipping the tour", async () => {
    localStorage.setItem(WELCOME_PENDING_KEY, "1");
    renderWelcome();
    fireEvent.click(screen.getByRole("button", { name: /Passer la visite/i }));
    expect(localStorage.getItem(WELCOME_PENDING_KEY)).toBeNull();
    // The MUI dialog unmounts after its close transition.
    await waitFor(() =>
      expect(screen.queryByText("Bienvenue sur Jawdi")).not.toBeInTheDocument(),
    );
  });

  it("launches the guided tour on Commencer and clears the flag when it ends", () => {
    localStorage.setItem(WELCOME_PENDING_KEY, "1");
    renderWelcome();
    fireEvent.click(screen.getByRole("button", { name: "Commencer" }));
    expect(drive).toHaveBeenCalledTimes(1);
    // Simulate the user finishing/closing the tour.
    lastConfig?.onDestroyed?.();
    expect(localStorage.getItem(WELCOME_PENDING_KEY)).toBeNull();
  });
});
