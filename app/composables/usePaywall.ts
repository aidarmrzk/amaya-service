import { ref } from "vue";
import type {
  Offer,
  Purchase,
  RestoreResult,
} from "../../shared/types/paywall";
type Status =
  "loading" | "ready" | "purchasing" | "restoring" | "success" | "error";
type RequestOptions = { method: "POST"; body?: Record<string, unknown> };
type Transport = (url: string, options?: RequestOptions) => Promise<unknown>;
export function usePaywall(
  request: Transport = (url, options) => $fetch(url, options),
  uuid: () => string = () => crypto.randomUUID(),
) {
  const offers = ref<Offer[]>([]);
  const selectedOfferId = ref<Offer["id"]>("yearly");
  const status = ref<Status>("loading");
  const error = ref("");
  const notice = ref("");
  const purchase = ref<Purchase | null>(null);
  let pendingRequest: { offerId: Offer["id"]; requestId: string } | null = null;
  const busy = () =>
    ["loading", "purchasing", "restoring", "success"].includes(status.value);
  async function loadOffers() {
    if (status.value === "purchasing" || status.value === "restoring") return;
    status.value = "loading";
    error.value = "";
    notice.value = "";
    try {
      const result = (await request("/api/offers")) as { offers: Offer[] };
      if (!result.offers?.length) throw new Error("No offers");
      offers.value = result.offers;
      selectedOfferId.value =
        result.offers.find((offer) => offer.recommended)?.id ||
        result.offers[0]!.id;
      status.value = "ready";
    } catch {
      status.value = "error";
      error.value =
        "Не удалось загрузить тарифы. Проверьте соединение и попробуйте снова.";
    }
  }
  async function buy() {
    if (
      busy() ||
      !offers.value.some((offer) => offer.id === selectedOfferId.value)
    )
      return;
    status.value = "purchasing";
    error.value = "";
    notice.value = "";
    try {
      if (!pendingRequest || pendingRequest.offerId !== selectedOfferId.value)
        pendingRequest = { offerId: selectedOfferId.value, requestId: uuid() };
      purchase.value = (await request("/api/purchase", {
        method: "POST",
        body: { ...pendingRequest },
      })) as Purchase;
      status.value = "success";
    } catch (reason) {
      const code =
        reason && typeof reason === "object" && "statusCode" in reason
          ? reason.statusCode
          : undefined;
      if (code === 409) pendingRequest = null;
      status.value = "error";
      error.value =
        "Не удалось открыть доступ. Нажмите кнопку, чтобы попробовать снова.";
    }
  }
  async function restore() {
    if (busy()) return;
    status.value = "restoring";
    error.value = "";
    notice.value = "";
    try {
      const result = (await request("/api/restore", {
        method: "POST",
      })) as RestoreResult;
      if (result.purchased && result.purchase) {
        purchase.value = result.purchase;
        status.value = "success";
      } else {
        status.value = "ready";
        notice.value = "На этом устройстве пока нет покупок.";
      }
    } catch {
      status.value = "error";
      error.value = "Не удалось восстановить покупки. Попробуйте ещё раз.";
    }
  }
  return {
    offers,
    selectedOfferId,
    status,
    error,
    notice,
    purchase,
    loadOffers,
    buy,
    restore,
  };
}
