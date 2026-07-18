import { describe, expect, it } from "vitest";
import { channelLabel } from "./salesChannel";
import type { CatalogEntry } from "@/store/api/catalogApi";

const channels: CatalogEntry[] = [
  { category: "sales_channels", key: "retail", value: { label: "Détail" }, custom: false },
  { category: "sales_channels", key: "wholesale", value: { label: "Grossiste" }, custom: false },
];

describe("channelLabel", () => {
  it("returns the human label for a known key", () => {
    expect(channelLabel(channels, "retail")).toBe("Détail");
  });

  it("returns null when there is no channel", () => {
    expect(channelLabel(channels, null)).toBeNull();
  });

  it("falls back to the raw key when the channel no longer exists", () => {
    expect(channelLabel(channels, "removed")).toBe("removed");
  });

  it("falls back to the key while the catalog is still loading", () => {
    expect(channelLabel(undefined, "retail")).toBe("retail");
  });
});
