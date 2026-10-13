import { createPurchase } from "../services/purchases";
import { getPurchaseRepository } from "../repositories/purchases";
import { getDeviceId } from "../utils/device";
export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  return createPurchase(
    await readBody(event),
    getDeviceId(event),
    getPurchaseRepository(event),
  );
});
