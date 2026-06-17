import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getActiveUserByEmail } from "@/lib/googleSheets";

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedByEnv(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  const allowedEmails = getAllowedEmails();
  const allowedDomain = (process.env.ALLOWED_DOMAIN || "").trim().toLowerCase();

  if (allowedEmails.length > 0 && allowedEmails.includes(normalized)) return true;
  if (allowedDomain && normalized.endsWith("@" + allowedDomain)) return true;

  return false;
}

async function isAllowedByUsersSheet(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const user = await getActiveUserByEmail(email);
  return Boolean(user);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
    })
  ],
  callbacks: {
    async signIn({ user }) {
      const sheetAllowed = await isAllowedByUsersSheet(user.email);
      if (sheetAllowed) return true;
      return isAllowedByEnv(user.email);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = session.user.email || (token.email as string);
        session.user.name = session.user.name || (token.name as string);
      }
      return session;
    }
  },
  pages: {
    signIn: "/"
  }
};
