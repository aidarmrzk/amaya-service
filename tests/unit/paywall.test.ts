import { describe, expect, it } from "vitest";
import { usePaywall } from "../../app/composables/usePaywall";
const offers = [
  {
    id: "monthly",
    title: "На один месяц",
    amount: 29900,
    currency: "RUB",
    period: "month",
    recommended: false,
  },
  {
    id: "yearly",
    title: "На целый год",
    amount: 199000,
    currency: "RUB",
    period: "year",
    recommended: true,
  },
];
describe("paywall purchase flow", () => {
  it("selects recommended yearly after loading offers", async () => {
    const state = usePaywall(async () => ({ offers }));
    expect(state.status.value).toBe("loading");
    await state.loadOffers();
    expect(state.selectedOfferId.value).toBe("yearly");
    expect(state.status.value).toBe("ready");
  });
  it("retains selection and request id after network failure; uses a new key for another plan", async () => {
    const sent: any[] = [];
    let fail = true;
    let counter = 0;
    const state = usePaywall(
      async (url: string, options: any) => {
        if (url === "/api/offers") return { offers };
        sent.push(options.body);
        if (fail) throw new Error("lost response");
        return {
          id: "purchase",
          offerId: options.body.offerId,
          createdAt: "2026-10-13T15:00:00Z",
        };
      },
      () => "key-" + ++counter,
    );
    await state.loadOffers();
    state.selectedOfferId.value = "monthly";
    await state.buy();
    expect(state.status.value).toBe("error");
    expect(state.selectedOfferId.value).toBe("monthly");
    await state.buy();
    expect(sent[0]).toEqual({ offerId: "monthly", requestId: "key-1" });
    expect(sent[1]).toEqual(sent[0]);
    state.selectedOfferId.value = "yearly";
    fail = false;
    await state.buy();
    expect(sent[2]).toEqual({ offerId: "yearly", requestId: "key-2" });
    expect(state.status.value).toBe("success");
    expect(state.purchase.value.offerId).toBe("yearly");
  });
  it("blocks duplicate purchase and concurrent restore while purchase is pending", async () => {
    let resolve!: (value: any) => void;
    let requests = 0;
    const state = usePaywall(
      async (url: string) => {
        if (url === "/api/offers") return { offers };
        requests++;
        return new Promise((r) => {
          resolve = r;
        });
      },
      () => "key",
    );
    await state.loadOffers();
    const pending = state.buy();
    expect(state.status.value).toBe("purchasing");
    expect(state.purchase.value).toBeNull();
    await state.buy();
    await state.restore();
    expect(requests).toBe(1);
    resolve({
      id: "purchase",
      offerId: "yearly",
      createdAt: "2026-10-13T15:00:00Z",
    });
    await pending;
    expect(state.status.value).toBe("success");
  });
  it("reports a failed load and succeeds on retry without purchasing", async () => {
    let fail = true;
    const state = usePaywall(async () => {
      if (fail) throw new Error("offline");
      return { offers };
    });
    await state.loadOffers();
    expect(state.status.value).toBe("error");
    expect(state.error.value).toBeTruthy();
    fail = false;
    await state.loadOffers();
    expect(state.status.value).toBe("ready");
    expect(state.purchase.value).toBeNull();
  });
  it("reports no purchase on this device and restores an existing purchase", async () => {
    let purchased = false;
    const state = usePaywall(async (url: string) =>
      url === "/api/offers"
        ? { offers }
        : {
            purchased,
            purchase: purchased
              ? {
                  id: "p",
                  offerId: "yearly",
                  createdAt: "2026-10-13T15:00:00Z",
                }
              : null,
          },
    );
    await state.loadOffers();
    await state.restore();
    expect(state.status.value).toBe("ready");
    expect(state.notice.value).toContain("нет покупок");
    purchased = true;
    await state.restore();
    expect(state.status.value).toBe("success");
  });
});
