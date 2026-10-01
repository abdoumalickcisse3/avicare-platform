import { describe, expect, it } from "vitest";
import { apiErrorMessage, apiErrorReference, isNetworkError, parseApiError } from "./apiError";

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

  it("says it plainly when the request never left the device", () => {
    const offline = { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" };
    expect(isNetworkError(offline)).toBe(true);
    expect(apiErrorMessage(offline)).toMatch(/connexion/i);
    expect(isNetworkError(problem(500))).toBe(false);
  });

  it("translates a known business code and keeps an unknown detail", () => {
    const known = { data: { type: "t", title: "Unprocessable", status: 422, code: "SALE_NO_LINES", detail: "A sale needs at least one line" } };
    const unknown = { data: { type: "t", title: "Unprocessable", status: 422, code: "SOMETHING_NEW", detail: "Raison métier" } };
    expect(apiErrorMessage(known)).toBe("Ajoutez au moins une ligne à la vente.");
    expect(apiErrorMessage(unknown)).toBe("Raison métier");
  });

  it("falls back to a French sentence by status when the body is not a problem", () => {
    expect(apiErrorMessage({ status: 502, data: "<html>Bad Gateway</html>" })).toMatch(/indisponible/);
  });
});
