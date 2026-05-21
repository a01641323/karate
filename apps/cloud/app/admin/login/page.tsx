import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Superadmin sign-in</h1>
      <p className="text-center text-zinc-400">
        Only the configured GitHub identity can access this panel.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/admin" });
        }}
      >
        <button className="rounded bg-white px-5 py-2.5 font-medium text-black hover:bg-zinc-200">
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
