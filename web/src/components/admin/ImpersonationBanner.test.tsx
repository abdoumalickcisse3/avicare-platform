import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { impersonation } from "@/lib/impersonation";
import { tokenStorage } from "@/lib/storage";
import { ImpersonationBanner } from "./ImpersonationBanner";

afterEach(() => {
  impersonation.clear();
  tokenStorage.clear();
  vi.unstubAllGlobals();
});

describe("ImpersonationBanner", () => {
  it("renders nothing outside a support session", () => {
    const { container } = renderWithProviders(<ImpersonationBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names who is being acted as", () => {
    impersonation.set({
      targetLabel: "Modou Diop",
      targetUserId: 7,
      previousAccess: null,
      previousRefresh: null,
    });

    renderWithProviders(<ImpersonationBanner />);

    // Forgetting you are inside someone else's account is how support turns into an accident.
    expect(screen.getByText(/vous agissez au nom de Modou Diop/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quitter le mode support/i })).toBeInTheDocument();
  });

  it("restores the staff member's own session on exit", async () => {
    tokenStorage.set("support-token", "");
    impersonation.set({
      targetLabel: "Modou Diop",
      targetUserId: 7,
      previousAccess: "my-own-token",
      previousRefresh: "my-own-refresh",
    });
    vi.stubGlobal("location", { href: "" });

    renderWithProviders(<ImpersonationBanner />);
    await userEvent.click(screen.getByRole("button", { name: /quitter/i }));

    // Leaving must put the previous session back, not strand the engineer logged out.
    expect(tokenStorage.getAccess()).toBe("my-own-token");
    expect(impersonation.read()).toBeNull();
  });

  it("clears the token when there was no previous session", async () => {
    tokenStorage.set("support-token", "");
    impersonation.set({
      targetLabel: "Modou Diop",
      targetUserId: 7,
      previousAccess: null,
      previousRefresh: null,
    });
    vi.stubGlobal("location", { href: "" });

    renderWithProviders(<ImpersonationBanner />);
    await userEvent.click(screen.getByRole("button", { name: /quitter/i }));

    expect(tokenStorage.getAccess()).toBeNull();
  });

  it("ignores a corrupted marker instead of showing an unlabelled banner", () => {
    window.sessionStorage.setItem("jawdi_impersonation", "{not json");

    const { container } = renderWithProviders(<ImpersonationBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});
