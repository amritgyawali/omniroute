import os from "os";
import path from "path";
import { tryOpenSync } from "./adapters/driverFactory";

function databaseOptions(readonly = false) {
  return readonly ? { readonly: true } : { readwrite: true, create: true };
}

const getOmpDir = () => path.join(os.homedir(), ".omp", "agent");
const getOmpDbPath = () => path.join(getOmpDir(), "agent.db");

export function getOmpCredentials(providerId: string) {
  const dbPath = getOmpDbPath();
  try {
    const db = tryOpenSync(dbPath, { ...databaseOptions(true), fileMustExist: true });
    if (!db) return { hasOmniRoute: false, baseUrl: null, apiKey: null };
    const row = db
      .prepare(
        "SELECT data FROM auth_credentials WHERE provider = ? AND credential_type = 'api_key'"
      )
      .get(providerId) as { data: string } | undefined;
    db.close();

    if (row?.data) {
      const parsed = JSON.parse(row.data);
      return { hasOmniRoute: true, baseUrl: parsed.baseUrl || null, apiKey: parsed.apiKey || null };
    }
    return { hasOmniRoute: false, baseUrl: null, apiKey: null };
  } catch {
    return { hasOmniRoute: false, baseUrl: null, apiKey: null };
  }
}

export function saveOmpCredentials(providerId: string, apiKey: string, baseUrl: string) {
  const dbPath = getOmpDbPath();
  const db = tryOpenSync(dbPath, databaseOptions());
  if (!db) throw new Error("No SQLite driver available for OMP credentials");

  db.prepare("DELETE FROM auth_credentials WHERE provider = ?").run(providerId);
  db.prepare(
    "INSERT INTO auth_credentials (provider, credential_type, data, disabled_cause, identity_key, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)"
  ).run(
    providerId,
    "api_key",
    JSON.stringify({ apiKey, baseUrl }),
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000)
  );

  db.close();
}

export function deleteOmpCredentials(providerId: string) {
  const dbPath = getOmpDbPath();
  const db = tryOpenSync(dbPath, databaseOptions());
  if (!db) throw new Error("No SQLite driver available for OMP credentials");
  db.prepare("DELETE FROM auth_credentials WHERE provider = ?").run(providerId);
  db.close();
}
