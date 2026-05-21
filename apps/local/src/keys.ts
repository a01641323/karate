import * as fs from "fs";
import * as path from "path";
import { generateKeyPair, exportPKCS8, exportSPKI, importPKCS8, importSPKI } from "jose";
import type { KeyLike } from "jose";
import { ensureDir } from "./storage";

export interface KeyPair {
  privateKey: KeyLike;
  publicKey: KeyLike;
  publicKeySpki: string;   // PEM, embeddable in desktop main
  privateKeyPkcs8: string; // PEM, persisted in dataDir/keys/ only
  kid: string;
}

export const KID = "2026-01";
export const ALG = "EdDSA";

export async function loadOrCreateKeys(dataDir: string): Promise<KeyPair> {
  const dir = path.join(dataDir, "keys");
  ensureDir(dir);
  const privPath = path.join(dir, "ed25519-private.pem");
  const pubPath = path.join(dir, "ed25519-public.pem");

  let privPem: string;
  let pubPem: string;

  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    privPem = fs.readFileSync(privPath, "utf8");
    pubPem = fs.readFileSync(pubPath, "utf8");
  } else {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    privPem = await exportPKCS8(privateKey);
    pubPem = await exportSPKI(publicKey);
    fs.writeFileSync(privPath, privPem, { encoding: "utf8", mode: 0o600 });
    fs.writeFileSync(pubPath, pubPem, "utf8");
  }

  const privateKey = await importPKCS8(privPem, ALG);
  const publicKey = await importSPKI(pubPem, ALG);
  return {
    privateKey,
    publicKey,
    publicKeySpki: pubPem,
    privateKeyPkcs8: privPem,
    kid: KID,
  };
}

// In cloud-proxy mode (KARATE_CLOUD_URL is set) the JWTs presented to
// this server were signed by the Vercel-hosted cloud, not by the
// local keypair above. Fetch the cloud's public key once at boot so
// requireAuth can verify cloud-issued tokens offline thereafter.
//
// Falls back gracefully: if the cloud is unreachable we keep the
// locally-generated key, which means cloud-issued JWTs won't verify
// (every authenticated route will 401) but the server still boots.
//
// We cache the fetched PEM to disk so subsequent boots survive a
// temporary network outage.
export async function fetchCloudPublicKey(
  cloudUrl: string,
  dataDir: string,
): Promise<{ key: KeyLike; pem: string } | null> {
  const cachePath = path.join(dataDir, "keys", "cloud-public.pem");
  let pem: string | null = null;
  try {
    const res = await fetch(`${cloudUrl.replace(/\/+$/, "")}/api/public-key`);
    if (res.ok) {
      pem = (await res.text()).trim() + "\n";
      try { fs.writeFileSync(cachePath, pem, "utf8"); } catch { /* dataDir read-only? */ }
    } else {
      console.warn(`[karate-local] cloud public-key fetch returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[karate-local] cloud public-key fetch failed: ${(err as Error).message}`);
  }

  if (!pem && fs.existsSync(cachePath)) {
    pem = fs.readFileSync(cachePath, "utf8");
    console.warn("[karate-local] using cached cloud public key (last-known-good)");
  }

  if (!pem) return null;
  try {
    const key = await importSPKI(pem, ALG);
    return { key, pem };
  } catch (err) {
    console.warn(`[karate-local] cloud public-key import failed: ${(err as Error).message}`);
    return null;
  }
}
