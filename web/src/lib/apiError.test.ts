import { describe, expect, it } from "vitest";
import { apiErrorMessage, apiErrorReference, parseApiError } from "./apiError";

const problem = (status: number, traceId?: string) => ({
  data: {
    type: "https://avicare.com/errors/internal-error",
    title: "Internal Server Error",
    status,
    detail: "An unexpected error occurred",
    traceId,
  },
});

describe("apiError", () => {
  it("falls back to a generic problem when the payload is not one", () => {
    expect(parseApiError("boom").title).toBe("Une erreur est survenue");
    expect(apiErrorReference("boom")).toBeNull();
  });

  it("shortens the correlation id into a dictatable reference", () => {
    expect(apiErrorReference(problem(500, "3f2a91cc-1b7e-4a0d-9f11-2c4d5e6f7a8b"))).toBe("3F2A91CC");
  });

  it("appends the reference to a server-side failure", () => {
    expect(apiErrorMessage(problem(500, "3f2a91cc-1b7e-4a0d-9f11-2c4d5e6f7a8b"))).toBe(
      "An unexpected error occurred (réf. 3F2A91CC)",
    );
  });

  it("leaves a business error message alone", () => {
    const business = {
      data: { type: "t", title: "Stock insuffisant", status: 422, detail: "Solde négatif", traceId: "abc-def" },
    };
    expect(apiErrorMessage(business)).toBe("Solde négatif");
  });

  it("does not invent a reference when the backend sent none", () => {
    expect(apiErrorMessage(problem(500))).toBe("An unexpected error occurred");
  });
});
