import { restorePurchase } from "../services/purchases";
import { getPurchaseRepository } from "../repositories/purchases";
import { getDeviceId } from "../utils/device";
export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  return restorePurchase(getDeviceId(event), getPurchaseRepository(event));
});
