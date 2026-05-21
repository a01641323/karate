// One-shot Ed25519 keypair generator.
//
//   pnpm --filter @karate/cloud generate-keypair
//
// Prints PEMs to stdout. Paste KEY_PRIVATE_PEM into Vercel env (treat
// it as a secret; rotation requires shipping a new local binary), and
// embed KEY_PUBLIC_PEM in apps/local at build time.

import { generateKeyPair } from "crypto";
import { promisify } from "util";

const gen = promisify(generateKeyPair);

async function main() {
  const { privateKey, publicKey } = await gen("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;

  process.stdout.write("--- KEY_PRIVATE_PEM ---\n");
  process.stdout.write(privatePem);
  process.stdout.write("\n--- KEY_PUBLIC_PEM ---\n");
  process.stdout.write(publicPem);
  process.stdout.write("\n");
  process.stdout.write("Tip: when pasting into Vercel env, replace literal newlines with \\n.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
