import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { Client, TablesDB, Query } from "node-appwrite";
try {
  process.loadEnvFile(".env");
} catch {}
const base = new URL(process.argv[2] || "http://127.0.0.1:3000");
const results = [];
const offers = await fetch(new URL("/api/offers", base));
assert.equal(offers.status, 200);
assert.equal((await offers.json()).offers.length, 2);
results.push("GET offers: 200, two plans");
const invalid = await fetch(new URL("/api/purchase", base), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ offerId: "unknown", requestId: "bad" }),
});
assert.equal(invalid.status, 400);
const cookie = invalid.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("amaya_device="));
const body = { offerId: "yearly", requestId: randomUUID() };
const buy = async (value) => {
  const response = await fetch(new URL("/api/purchase", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(value),
  });
  return { status: response.status, data: await response.json() };
};
const [a, b] = await Promise.all([buy(body), buy(body)]);
assert.equal(a.status, 200);
assert.equal(b.status, 200);
assert.equal(a.data.id, b.data.id);
assert.equal((await buy(body)).data.id, a.data.id);
assert.equal((await buy({ ...body, offerId: "monthly" })).status, 409);
assert.equal(a.data.offerId, "yearly");
assert.ok(Date.parse(a.data.createdAt));
assert.equal(Object.keys(a.data).sort().join(","), "createdAt,id,offerId");
results.push(
  "POST purchase: persisted success, concurrent retry produces one id, offer conflict: 409",
);
const restore = await fetch(new URL("/api/restore", base), {
  method: "POST",
  headers: { Cookie: cookie },
});
assert.equal(restore.status, 200);
assert.equal((await restore.json()).purchase.id, a.data.id);
const other = await fetch(new URL("/api/restore", base), { method: "POST" });
assert.equal(other.status, 200);
assert.equal((await other.json()).purchased, false);
results.push("POST restore: own purchase restored; new device has no access");
if (process.env.NUXT_APPWRITE_API_KEY) {
  const client = new Client()
    .setEndpoint(process.env.NUXT_APPWRITE_ENDPOINT)
    .setProject(process.env.NUXT_APPWRITE_PROJECT_ID)
    .setKey(process.env.NUXT_APPWRITE_API_KEY);
  const tables = new TablesDB(client);
  const rows = await tables.listRows({
    databaseId: process.env.NUXT_APPWRITE_DATABASE_ID || "amaya",
    tableId: process.env.NUXT_APPWRITE_TABLE_ID || "purchases",
    queries: [Query.equal("$id", [a.data.id])],
  });
  assert.equal(rows.total, 1);
  assert.equal(rows.rows[0].requestId, body.requestId);
  assert.equal(rows.rows[0].offerId, "yearly");
  assert.deepEqual(rows.rows[0].$permissions, []);
  results.push(
    "Direct Appwrite query: exactly one row with expected requestId and no public permissions",
  );
}
const report = {
  base: base.origin,
  checkedAt: new Date().toISOString(),
  purchaseId: a.data.id,
  results,
};
await mkdir("docs/verification-results", { recursive: true });
await writeFile(
  "docs/verification-results/" +
    (base.hostname === "127.0.0.1" ? "local-api" : "live-api") +
    ".json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
