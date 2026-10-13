import { createHash } from "node:crypto";
import { Client, TablesDB, Query, type Models } from "node-appwrite";
import type { Offer, Purchase } from "../../shared/types/paywall";
import type { PurchaseRepository } from "./purchases";
export interface AppwriteSettings {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
  tableId: string;
}
interface PurchaseRow extends Models.Row {
  offerId: Offer["id"];
  deviceId: string;
  requestId: string;
}
const toPurchase = (row: PurchaseRow): Purchase => ({
  id: row.$id,
  offerId: row.offerId,
  createdAt: row.$createdAt,
});
const rowId = (device: string, request: string) =>
  createHash("sha256")
    .update(device + ":" + request)
    .digest("hex")
    .slice(0, 32);
export function createAppwriteRepository(
  settings: AppwriteSettings,
): PurchaseRepository {
  function table() {
    if (
      !settings.endpoint ||
      !settings.projectId ||
      !settings.apiKey ||
      !settings.databaseId ||
      !settings.tableId
    )
      throw new Error("Storage not configured");
    const client = new Client()
      .setEndpoint(settings.endpoint)
      .setProject(settings.projectId)
      .setKey(settings.apiKey);
    return new TablesDB(client);
  }
  const location = {
    databaseId: settings.databaseId,
    tableId: settings.tableId,
  };
  return {
    async findByRequest(deviceId, requestId) {
      try {
        const row = await table().getRow<PurchaseRow>({
          ...location,
          rowId: rowId(deviceId, requestId),
        });
        return row.deviceId === deviceId && row.requestId === requestId
          ? toPurchase(row)
          : null;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === 404
        )
          return null;
        throw error;
      }
    },
    async insert(deviceId, requestId, offerId) {
      try {
        const row = await table().createRow<PurchaseRow>({
          ...location,
          rowId: rowId(deviceId, requestId),
          data: { offerId, deviceId, requestId },
          permissions: [],
        });
        return toPurchase(row);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === 409
        )
          throw { code: "DUPLICATE" };
        throw error;
      }
    },
    async findLatest(deviceId) {
      const result = await table().listRows<PurchaseRow>({
        ...location,
        queries: [
          Query.equal("deviceId", [deviceId]),
          Query.orderDesc("$createdAt"),
          Query.limit(1),
        ],
      });
      const row = result.rows[0];
      return row && row.deviceId === deviceId ? toPurchase(row) : null;
    },
  };
}
