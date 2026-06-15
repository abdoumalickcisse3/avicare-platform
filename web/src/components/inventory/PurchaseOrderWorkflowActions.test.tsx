import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { PurchaseOrderWorkflowActions } from "./PurchaseOrderWorkflowActions";

const handlers = { onSubmit: vi.fn(), onReceive: vi.fn(), onCancel: vi.fn() };

describe("PurchaseOrderWorkflowActions", () => {
  it("DRAFT shows submit + cancel, not receive", () => {
    renderWithProviders(<PurchaseOrderWorkflowActions status="DRAFT" {...handlers} />);
    expect(screen.getByRole("button", { name: /envoyer au fournisseur/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler le bon/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /réceptionner/i })).not.toBeInTheDocument();
  });

  it("SENT shows receive + cancel, not submit", () => {
    renderWithProviders(<PurchaseOrderWorkflowActions status="SENT" {...handlers} />);
    expect(screen.getByRole("button", { name: /réceptionner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler le bon/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /envoyer/i })).not.toBeInTheDocument();
  });

  it("RECEIVED and CANCELLED render no actions", () => {
    const { container, rerender } = renderWithProviders(
      <PurchaseOrderWorkflowActions status="RECEIVED" {...handlers} />,
    );
    expect(container.querySelectorAll("button").length).toBe(0);
    rerender(<PurchaseOrderWorkflowActions status="CANCELLED" {...handlers} />);
    expect(container.querySelectorAll("button").length).toBe(0);
  });
});
