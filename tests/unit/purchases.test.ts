import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createPurchase,
  restorePurchase,
} from "../../server/services/purchases";
import type { PurchaseRepository } from "../../server/repositories/purchases";
import type { Purchase, Offer } from "../../shared/types/paywall";
const deviceA = "11111111-1111-4111-8111-111111111111";
const deviceB = "22222222-2222-4222-8222-222222222222";
const body = {
  offerId: "yearly",
  requestId: "33333333-3333-4333-8333-333333333333",
};
function memoryRepository() {
  const rows: Array<Purchase & { deviceId: string; requestId: string }> = [];
  const repo: PurchaseRepository = {
    async findByRequest(device, request) {
      return (
        rows.find((r) => r.deviceId === device && r.requestId === request) ||
        null
      );
    },
    async insert(device, request, offerId) {
      if (rows.some((r) => r.deviceId === device && r.requestId === request))
        throw { code: "DUPLICATE" };
      const result = {
        id: randomUUID(),
        offerId,
        createdAt: new Date().toISOString(),
        deviceId: device,
        requestId: request,
      };
      rows.push(result);
      return result;
    },
    async findLatest(device) {
      return [...rows].reverse().find((r) => r.deviceId === device) || null;
    },
  };
  return { repo, rows };
}
describe("test purchases", () => {
  it("saves a valid purchase before confirming access", async () => {
    const { repo, rows } = memoryRepository();
    const result = await createPurchase(body, deviceA, repo);
    expect(result).toMatchObject({ offerId: "yearly" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      deviceId: deviceA,
      requestId: body.requestId,
    });
    expect(Date.parse(result.createdAt)).not.toBeNaN();
  });
  it("returns one purchase for simultaneous requests and lost-response retry", async () => {
    const { repo, rows } = memoryRepository();
    const [a, b] = await Promise.all([
      createPurchase(body, deviceA, repo),
      createPurchase(body, deviceA, repo),
    ]);
    expect(a.id).toBe(b.id);
    expect(rows).toHaveLength(1);
    expect((await createPurchase(body, deviceA, repo)).id).toBe(a.id);
  });
  it.each([
    null,
    [],
    {},
    { ...body, offerId: "unknown" },
    { ...body, requestId: "bad" },
    { ...body, amount: 1 },
    { ...body, deviceId: deviceB },
  ])("rejects invalid or client-controlled body %j", async (input) => {
    const { repo, rows } = memoryRepository();
    await expect(createPurchase(input, deviceA, repo)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(rows).toHaveLength(0);
  });
  it("rejects reusing a request key for a different plan", async () => {
    const { repo, rows } = memoryRepository();
    await createPurchase(body, deviceA, repo);
    await expect(
      createPurchase({ ...body, offerId: "monthly" }, deviceA, repo),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(rows).toHaveLength(1);
  });
  it("does not report success when persistence fails", async () => {
    const { repo } = memoryRepository();
    repo.insert = async () => {
      throw new Error("database offline");
    };
    await expect(createPurchase(body, deviceA, repo)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
  it("does not report success when a prior-purchase lookup fails", async () => {
    const { repo } = memoryRepository();
    repo.findByRequest = async () => {
      throw new Error("database offline");
    };
    await expect(createPurchase(body, deviceA, repo)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
  it("restores only purchases from the same device", async () => {
    const { repo } = memoryRepository();
    const purchase = await createPurchase(body, deviceA, repo);
    expect(await restorePurchase(deviceA, repo)).toEqual({
      purchased: true,
      purchase,
    });
    expect(await restorePurchase(deviceB, repo)).toEqual({
      purchased: false,
      purchase: null,
    });
  });
  it("reports database failure during restoration", async () => {
    const { repo } = memoryRepository();
    repo.findLatest = async () => {
      throw new Error("offline");
    };
    await expect(restorePurchase(deviceA, repo)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
