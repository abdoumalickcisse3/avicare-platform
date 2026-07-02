import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { avicareTheme } from "@/theme";
import { PermissionEditor, expandPermissions } from "./PermissionEditor";
import type { PermissionCatalog } from "@/types";

const CATALOG: PermissionCatalog = {
  resources: [
    { resource: "poultry", label: "Élevage volaille", verbs: ["read", "write", "delete"] },
    { resource: "finance", label: "Finance", verbs: ["read", "write"] },
  ],
  roleDefaults: { MANAGER: ["poultry:*", "finance:read"] },
};

function renderEditor(props: Partial<Parameters<typeof PermissionEditor>[0]> = {}) {
  return render(
    <ThemeProvider theme={avicareTheme}>
      <PermissionEditor
        catalog={CATALOG}
        value={["poultry:read", "poultry:write"]}
        onChange={props.onChange ?? vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("expandPermissions", () => {
  it("expands resource:* into individual verbs", () => {
    const set = expandPermissions(["poultry:*", "finance:read"], CATALOG);
    expect(set.has("poultry:read")).toBe(true);
    expect(set.has("poultry:delete")).toBe(true);
    expect(set.has("finance:read")).toBe(true);
    expect(set.has("finance:write")).toBe(false);
  });
  it("expands * into everything", () => {
    const set = expandPermissions(["*"], CATALOG);
    expect(set.has("poultry:delete")).toBe(true);
    expect(set.has("finance:write")).toBe(true);
  });
});

describe("PermissionEditor", () => {
  it("renders the module rows", () => {
    renderEditor();
    expect(screen.getByText("Élevage volaille")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });

  it("emits the explicit verb list when a box is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor({ value: ["poultry:read"], onChange });
    // toggle poultry:write on
    await user.click(screen.getByRole("checkbox", { name: /poultry:write/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(["poultry:read", "poultry:write"]),
    );
  });

  it("disables all checkboxes when disabled", () => {
    renderEditor({ disabled: true });
    screen.getAllByRole("checkbox").forEach((cb) => expect(cb).toBeDisabled());
  });
});
