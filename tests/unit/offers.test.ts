import { describe, expect, it } from "vitest";
import { getOffers } from "../../server/utils/offers";
describe("server offer catalog", () => {
  it("provides the two purchasable plans in RUB with yearly recommended", () => {
    expect(getOffers().map((o) => [o.id, o.amount, o.currency])).toEqual([
      ["monthly", 29900, "RUB"],
      ["yearly", 199000, "RUB"],
    ]);
    expect(
      getOffers()
        .filter((o) => o.recommended)
        .map((o) => o.id),
    ).toEqual(["yearly"]);
  });
});
