import { Client, TablesDB, TablesDBIndexType, OrderBy } from "node-appwrite";
try {
  process.loadEnvFile(".env");
} catch {}
const required = [
  "NUXT_APPWRITE_ENDPOINT",
  "NUXT_APPWRITE_PROJECT_ID",
  "NUXT_APPWRITE_API_KEY",
];
for (const key of required)
  if (!process.env[key]) throw new Error("Missing configuration: " + key);
const client = new Client()
  .setEndpoint(process.env.NUXT_APPWRITE_ENDPOINT)
  .setProject(process.env.NUXT_APPWRITE_PROJECT_ID)
  .setKey(process.env.NUXT_APPWRITE_API_KEY);
const db = new TablesDB(client);
const databaseId = process.env.NUXT_APPWRITE_DATABASE_ID || "amaya";
const tableId = process.env.NUXT_APPWRITE_TABLE_ID || "purchases";
const location = { databaseId, tableId };
async function ensure(create) {
  try {
    await create();
  } catch (error) {
    if (error.code !== 409) throw error;
  }
}
await ensure(() => db.create({ databaseId, name: "Amaya demo purchases" }));
await ensure(() =>
  db.createTable({
    ...location,
    name: "Purchases",
    permissions: [],
    rowSecurity: true,
  }),
);
await ensure(() =>
  db.createEnumColumn({
    ...location,
    key: "offerId",
    elements: ["monthly", "yearly"],
    required: true,
  }),
);
for (const key of ["deviceId", "requestId"])
  await ensure(() =>
    db.createVarcharColumn({ ...location, key, size: 36, required: true }),
  );
for (let attempt = 0; attempt < 30; attempt++) {
  const table = await db.getTable(location);
  if (
    table.columns.length >= 3 &&
    table.columns.every((column) => column.status === "available")
  )
    break;
  if (attempt === 29)
    throw new Error("Columns are not available yet; rerun setup");
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await ensure(() =>
  db.createIndex({
    ...location,
    key: "device_created",
    type: TablesDBIndexType.Key,
    columns: ["deviceId", "$createdAt"],
    orders: [OrderBy.Asc, OrderBy.Desc],
  }),
);
for (let attempt = 0; attempt < 30; attempt++) {
  const index = await db.getIndex({ ...location, key: "device_created" });
  if (index.status === "available") break;
  if (index.status === "failed" || attempt === 29)
    throw new Error("Index unavailable: " + index.status);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.log("Appwrite database ready: " + databaseId + "/" + tableId);
