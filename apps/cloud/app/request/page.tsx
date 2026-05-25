// /request — top of the tournament-builder wizard.
//
// Reads the karate.request cookie server-side. If it carries a valid
// access token for an existing request, we hydrate the wizard from
// the stored draft (so the user can keep editing where they left off
// in any tab). Otherwise the wizard starts blank at step 1.

import { cookies } from "next/headers";
import { authorizeAccess } from "@/lib/requests";
import { getRequestBundle } from "@/lib/bundle";
import { findByCodeId } from "@/lib/tokens";
import { decodeRequestCookie, REQUEST_COOKIE } from "@/lib/cookie";
import { Wizard } from "@/components/wizard/Wizard";
import type { WizardSnapshot, WizardCodeStatus } from "@/components/wizard/types";
import { emptyBundle, emptyContact } from "@/components/wizard/types";

export const dynamic = "force-dynamic";

async function hydrate(): Promise<WizardSnapshot | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(REQUEST_COOKIE.name)?.value;
  const decoded = decodeRequestCookie(raw);
  if (!decoded) return null;
  const record = await authorizeAccess(decoded.requestId, decoded.accessToken);
  if (!record) return null;
  const bundle = (await getRequestBundle(record.id)) ?? emptyBundle();

  // When the request was granted, look up the live code so the wizard
  // can render either the active state (download commands + code) or
  // the expired state (post-48h / revoked). Pre-activation codes
  // ("unused") are still shown as active so the customer can copy
  // them on their first visit.
  let codeStatus: WizardCodeStatus | undefined;
  let codeExpiresAt: number | null = null;
  if (record.status === "granted" && record.codeId) {
    const code = await findByCodeId(record.codeId).catch(() => null);
    if (!code) {
      codeStatus = "dead";
    } else if (code.status === "revoked") {
      codeStatus = "dead";
    } else if (code.status === "unused") {
      codeStatus = "unused";
      codeExpiresAt = code.expiresAt;
    } else if (code.status === "used") {
      codeStatus = code.expiresAt > Date.now() ? "active" : "dead";
      codeExpiresAt = code.expiresAt;
    } else {
      codeStatus = "dead";
    }
  }

  return {
    requestId: record.id,
    status: record.status,
    rejectionReason: record.rejectionReason ?? null,
    rawCode: record.status === "granted" ? record.rawCode : null,
    codeStatus,
    codeExpiresAt,
    contact: {
      email: record.email,
      org: record.org ?? "",
      tournamentDate: record.tournamentDate ?? "",
      notes: record.notes ?? "",
    },
    bundle: {
      ...emptyBundle(),
      ...(bundle as object),
      bundleVersion: 1,
      settings: { ...emptyBundle().settings, ...((bundle as { settings?: object }).settings ?? {}) },
    } as WizardSnapshot["bundle"],
  };
}

export default async function RequestPage() {
  const initial = await hydrate().catch(() => null);
  return <Wizard initial={initial ?? { requestId: null, status: "draft", rejectionReason: null, rawCode: null, contact: emptyContact(), bundle: emptyBundle() }} />;
}
