import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { InviteMemberDialog } from "./InviteMemberDialog";

describe("InviteMemberDialog", () => {
  it("renders the invite form", () => {
    renderWithProviders(
      <InviteMemberDialog open onClose={vi.fn()} farmId={1} />,
    );
    expect(screen.getByText("Inviter un membre")).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rôle/i)).toBeInTheDocument();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InviteMemberDialog open onClose={vi.fn()} farmId={1} />,
    );

    await user.type(screen.getByLabelText(/adresse e-mail/i), "not-an-email");
    await user.click(
      screen.getByRole("button", { name: /envoyer l'invitation/i }),
    );

    expect(await screen.findByText("Adresse e-mail invalide")).toBeInTheDocument();
  });
});
