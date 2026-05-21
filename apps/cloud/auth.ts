// Auth.js v5 — single-superadmin GitHub OAuth.
// Only the GitHub user whose numeric id matches SUPERADMIN_GITHUB_ID
// gets a session; everyone else is rejected at sign-in.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowed = process.env.SUPERADMIN_GITHUB_ID;
      if (!allowed) return false;
      return String((profile as { id?: number | string } | undefined)?.id ?? "") === allowed;
    },
    async session({ session, token }) {
      // Surface the GitHub id on the session so server actions can
      // re-check it cheaply without another OAuth roundtrip.
      (session as { ghId?: string }).ghId = String(token.sub ?? "");
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
});
