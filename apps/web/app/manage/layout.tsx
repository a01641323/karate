import { AuthGate } from "@/components/auth-gate";

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate roles={["superadmin", "referee"]}>{children}</AuthGate>;
}
