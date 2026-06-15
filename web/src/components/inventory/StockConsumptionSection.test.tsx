import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { StockConsumptionSection } from "./StockConsumptionSection";

describe("StockConsumptionSection", () => {
  it("clears the parent value on mount", async () => {
    const onChange = vi.fn();
    renderWithProviders(<StockConsumptionSection farmId={1} open onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });

  it("hides the article + quantity fields until toggled on", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StockConsumptionSection farmId={1} open onChange={vi.fn()} label="Décrémenter du stock" />,
    );
    expect(screen.queryByLabelText(/article à décompter/i)).not.toBeInTheDocument();

    await user.click(screen.getByText("Décrémenter du stock"));
    expect(await screen.findByLabelText(/article à décompter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantité consommée/i)).toBeInTheDocument();
  });
});
