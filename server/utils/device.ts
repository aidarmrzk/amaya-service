import { randomUUID } from "node:crypto";
import { getCookie, setCookie, type H3Event } from "h3";
import { uuidPattern } from "../services/purchases";
export function getDeviceId(event: H3Event): string {
  const current = getCookie(event, "amaya_device");
  if (current && uuidPattern.test(current)) return current.toLowerCase();
  const deviceId = randomUUID();
  setCookie(event, "amaya_device", deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return deviceId;
}
