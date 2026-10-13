import { createError } from "h3";
import type { PurchaseRepository } from "../repositories/purchases";
import type {
  Offer,
  Purchase,
  RestoreResult,
} from "../../shared/types/paywall";
import { getOffers } from "../utils/offers";
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parsePurchase(body: unknown): {
  offerId: Offer["id"];
  requestId: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw createError({ statusCode: 400, statusMessage: "Invalid purchase" });
  const data = body as Record<string, unknown>;
  if (
    Object.keys(data).some((key) => !["offerId", "requestId"].includes(key)) ||
    typeof data.requestId !== "string" ||
    !uuidPattern.test(data.requestId) ||
    !getOffers().some((offer) => offer.id === data.offerId)
  )
    throw createError({ statusCode: 400, statusMessage: "Invalid purchase" });
  return {
    offerId: data.offerId as Offer["id"],
    requestId: data.requestId.toLowerCase(),
  };
}
function publicPurchase(p: Purchase): Purchase {
  return { id: p.id, offerId: p.offerId, createdAt: p.createdAt };
}
function confirm(p: Purchase, offerId: Offer["id"]): Purchase {
  if (p.offerId !== offerId)
    throw createError({
      statusCode: 409,
      statusMessage: "Request already used for another offer",
    });
  return publicPurchase(p);
}
export async function createPurchase(
  body: unknown,
  deviceId: string,
  repository: PurchaseRepository,
): Promise<Purchase> {
  const { offerId, requestId } = parsePurchase(body);
  try {
    const previous = await repository.findByRequest(deviceId, requestId);
    if (previous) return confirm(previous, offerId);
    try {
      return publicPurchase(
        await repository.insert(deviceId, requestId, offerId),
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "DUPLICATE"
      ) {
        const saved = await repository.findByRequest(deviceId, requestId);
        if (saved) return confirm(saved, offerId);
      }
      throw error;
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      error.statusCode === 409
    )
      throw error;
    throw createError({
      statusCode: 503,
      statusMessage: "Purchase storage unavailable",
    });
  }
}
export async function restorePurchase(
  deviceId: string,
  repository: PurchaseRepository,
): Promise<RestoreResult> {
  try {
    const purchase = await repository.findLatest(deviceId);
    return {
      purchased: !!purchase,
      purchase: purchase ? publicPurchase(purchase) : null,
    };
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: "Purchase storage unavailable",
    });
  }
}
