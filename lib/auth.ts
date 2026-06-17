import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  const allowedEmails = getAllowedEmails();
  const allowedDomain = (process.env.ALLOWED_DOMAIN || "").trim().toLowerCase();

  if (allowedEmails.length > 0 && allowedEmails.includes(normalized)) return true;
  if (allowedDomain && normalized.endsWith(`@${allowedDomain}`)) return true;

  return allowedEmails.length === 0 && !allowedDomain;
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
      return isAllowedEmail(user.email);
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
