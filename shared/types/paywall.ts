export interface Offer {
  id: "monthly" | "yearly";
  title: string;
  amount: number;
  currency: "RUB";
  period: "month" | "year";
  recommended: boolean;
}
export interface Purchase {
  id: string;
  offerId: Offer["id"];
  createdAt: string;
}
export interface RestoreResult {
  purchased: boolean;
  purchase: Purchase | null;
}
