import type { Offer } from "../../shared/types/paywall";
const offers: readonly Offer[] = [
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
export function getOffers(): readonly Offer[] {
  return offers;
}
