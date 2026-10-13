import { getOffers } from "../utils/offers";
import { getDeviceId } from "../utils/device";
export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store");
  getDeviceId(event);
  return { offers: getOffers() };
});
