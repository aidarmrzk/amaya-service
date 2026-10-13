import { getOffers } from "../utils/offers";
export default defineEventHandler(() => ({ offers: getOffers() }));
