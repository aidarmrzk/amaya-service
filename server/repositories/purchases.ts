import type { H3Event } from "h3";
import type { Offer, Purchase } from "../../shared/types/paywall";
import { createAppwriteRepository } from "./appwrite";
export interface PurchaseRepository {
  findByRequest(deviceId: string, requestId: string): Promise<Purchase | null>;
  insert(
    deviceId: string,
    requestId: string,
    offerId: Offer["id"],
  ): Promise<Purchase>;
  findLatest(deviceId: string): Promise<Purchase | null>;
}
export function getPurchaseRepository(event: H3Event): PurchaseRepository {
  const config = useRuntimeConfig(event);
  return createAppwriteRepository({
    endpoint: config.appwriteEndpoint,
    projectId: config.appwriteProjectId,
    apiKey: config.appwriteApiKey,
    databaseId: config.appwriteDatabaseId,
    tableId: config.appwriteTableId,
  });
}
