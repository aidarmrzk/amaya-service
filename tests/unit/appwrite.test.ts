import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createAppwriteRepository } from "../../server/repositories/appwrite";
const deviceA = "11111111-1111-4111-8111-111111111111";
const deviceB = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
let server: Server, endpoint: string;
let saved: any = null,
  calls: Array<{
    method: string;
    url: URL;
    body: any;
    project?: string;
    key?: string;
  }> = [];
beforeEach(async () => {
  saved = null;
  calls = [];
  server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const url = new URL(req.url!, "http://local");
    const body = raw ? JSON.parse(raw) : null;
    calls.push({
      method: req.method!,
      url,
      body,
      project: req.headers["x-appwrite-project"] as string,
      key: req.headers["x-appwrite-key"] as string,
    });
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      if (saved) {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            message: "duplicate",
            code: 409,
            type: "row_already_exists",
          }),
        );
        return;
      }
      saved = {
        $id: body.rowId,
        $createdAt: "2026-10-13T15:00:00.000Z",
        $updatedAt: "2026-10-13T15:00:00.000Z",
        $permissions: [],
        $tableId: "purchases",
        $databaseId: "amaya",
        ...body.data,
      };
      res.end(JSON.stringify(saved));
      return;
    }
    if (url.pathname.endsWith("/rows")) {
      const queries = [...url.searchParams.entries()]
        .filter(([key]) => /^queries\[\d+\]$/.test(key))
        .map(([, value]) => value)
        .map((q) => JSON.parse(q));
      const filter = queries.find(
        (q) => q.method === "equal" && q.attribute === "deviceId",
      );
      const rows =
        saved && filter?.values.includes(saved.deviceId) ? [saved] : [];
      res.end(JSON.stringify({ total: rows.length, rows }));
      return;
    }
    if (!saved) {
      res.statusCode = 404;
      res.end(
        JSON.stringify({
          message: "not found",
          code: 404,
          type: "row_not_found",
        }),
      );
      return;
    }
    res.end(JSON.stringify(saved));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  endpoint = "http://127.0.0.1:" + address.port + "/v1";
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
const repository = () =>
  createAppwriteRepository({
    endpoint,
    projectId: "test-project",
    apiKey: "test-key",
    databaseId: "amaya",
    tableId: "purchases",
  });
describe("Appwrite storage boundary", () => {
  it("writes the selected offer and device, maps server timestamp, and reads by stable request id", async () => {
    const repo = repository();
    expect(await repo.findByRequest(deviceA, requestId)).toBeNull();
    const purchase = await repo.insert(deviceA, requestId, "yearly");
    expect(purchase).toMatchObject({
      offerId: "yearly",
      createdAt: "2026-10-13T15:00:00.000Z",
    });
    expect(saved).toMatchObject({
      offerId: "yearly",
      deviceId: deviceA,
      requestId,
    });
    expect(saved.$permissions).toEqual([]);
    expect(calls[1]!.body.permissions).toEqual([]);
    expect(await repo.findByRequest(deviceA, requestId)).toEqual(purchase);
    expect(calls[0]!.url.pathname).toBe(calls[2]!.url.pathname);
    expect(calls[1]).toMatchObject({
      project: "test-project",
      key: "test-key",
    });
  });
  it("normalizes concurrent insert conflict to the repository duplicate code", async () => {
    const repo = repository();
    await repo.insert(deviceA, requestId, "yearly");
    await expect(
      repo.insert(deviceA, requestId, "yearly"),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
  });
  it("filters latest purchases by device and orders by server-created time", async () => {
    const repo = repository();
    await repo.insert(deviceA, requestId, "yearly");
    expect(await repo.findLatest(deviceB)).toBeNull();
    expect(await repo.findLatest(deviceA)).toMatchObject({ offerId: "yearly" });
    const queries = [...calls[2]!.url.searchParams.entries()]
      .filter(([key]) => /^queries\[\d+\]$/.test(key))
      .map(([, value]) => value)
      .map((q) => JSON.parse(q));
    expect(queries).toContainEqual({
      method: "orderDesc",
      attribute: "$createdAt",
    });
    expect(queries).toContainEqual({ method: "limit", values: [1] });
  });
});
