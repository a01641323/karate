import { kv } from "@vercel/kv";

export { kv };

// Key-namespace helpers. Keep all KV reads/writes funnelled through here
// so a future migration to a different store changes one file.

export const keys = {
  request: (id: string) => `req:${id}`,
  requestByCookie: (hash: string) => `req:byCookie:${hash}`,
  pendingSet: "req:pending",
  code: (hash: string) => `code:${hash}`,
  codeById: (codeId: string) => `code:byId:${codeId}`,
  jtiRevoked: (jti: string) => `jti:revoked:${jti}`,
  releaseCurrent: "release:current",
};
