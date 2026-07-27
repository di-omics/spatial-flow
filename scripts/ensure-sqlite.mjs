import { closeSync, existsSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Prisma 5's macOS schema engine can fail before creating a missing SQLite
// file. Creating an empty file is safe: `prisma db push` remains the only step
// that applies the schema.
const databasePath = fileURLToPath(new URL("../prisma/dev.db", import.meta.url));

if (!existsSync(databasePath)) {
  closeSync(openSync(databasePath, "wx"));
  console.log("Created empty local SQLite database at prisma/dev.db");
}
