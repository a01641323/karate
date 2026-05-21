// Loads the cloud's Ed25519 keypair from env. Generated once with
// `pnpm --filter @karate/cloud generate-keypair` and pasted into the
// Vercel environment.

import { importPKCS8, importSPKI, type KeyLike } from "jose";

let cachedPrivate: KeyLike | null = null;
let cachedPublic: KeyLike | null = null;

function envPem(name: string): string {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set`);
  // Vercel env values typically arrive with literal "\n" rather than
  // newlines. Restore real newlines for jose's PEM parser.
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export async function getPrivateKey(): Promise<KeyLike> {
  if (!cachedPrivate) {
    cachedPrivate = await importPKCS8(envPem("KEY_PRIVATE_PEM"), "EdDSA");
  }
  return cachedPrivate;
}

export async function getPublicKey(): Promise<KeyLike> {
  if (!cachedPublic) {
    cachedPublic = await importSPKI(envPem("KEY_PUBLIC_PEM"), "EdDSA");
  }
  return cachedPublic;
}
