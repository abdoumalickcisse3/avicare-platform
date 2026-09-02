import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CloseBatchDialog } from "./CloseBatchDialog";

const closeUnit = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));

vi.mock("@/store/api/closureApi", () => ({
  useCloseUnitMutation: () => [closeUnit, { isLoading: false }],
}));

function setup(remainingCount = 0) {
  return renderWithProviders(
    <CloseBatchDialog
      open
      onClose={vi.fn()}
      farmId={7}
      unitId={42}
      batchName="Bande A"
      remainingCount={remainingCount}
    />,
  );
}

describe("CloseBatchDialog", () => {
  it("warns that the report will be frozen", () => {
    setup();
    expect(screen.getByText(/figé/i)).toBeInTheDocument();
  });

  it("says how many subjects are still on hand", () => {
    setup(180);
    expect(screen.getByText(/il reste 180 sujets/i)).toBeInTheDocument();
  });

  it("stays silent about remaining subjects when there are none", () => {
    setup(0);
    expect(screen.queryByText(/il reste/i)).not.toBeInTheDocument();
  });

  it("closes without a chick cost — the field is optional", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /^clôturer$/i }));

    expect(closeUnit).toHaveBeenCalledWith({
      farmId: 7,
      unitId: 42,
      body: { chickCostXof: undefined, notes: undefined },
    });
  });

  it("passes the chick cost as a number when given", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/coût des poussins/i), "250000");
    await user.click(screen.getByRole("button", { name: /^clôturer$/i }));

    expect(closeUnit).toHaveBeenCalledWith({
      farmId: 7,
      unitId: 42,
      body: { chickCostXof: 250000, notes: undefined },
    });
  });
});
