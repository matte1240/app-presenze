import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { auditAuth } from "./audit-log";

// Validate required secret at runtime (skip during build where env vars may not exist)
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (!isBuildPhase && !process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

type CredentialsUser = AdapterUser & {
  role: string;
  tokenVersion?: number;
  hasPermesso104: boolean;
  hasPaternityLeave: boolean;
};

export const authOptions: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes in seconds
  },
  useSecureCookies: process.env.NODE_ENV === "production"
    ? (process.env.NEXTAUTH_URL?.startsWith("https") ?? true)
    : false,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        const isValid = await compare(credentials.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        const authUser: CredentialsUser = {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          emailVerified: user.emailVerified,
          image: user.image ?? undefined,
          role: user.role,
          tokenVersion: user.tokenVersion,
          hasPermesso104: user.hasPermesso104,
          hasPaternityLeave: user.hasPaternityLeave,
        };

        return authUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const credentialsUser = user as CredentialsUser;
        token.id = credentialsUser.id;
        token.role = credentialsUser.role;
        token.picture = credentialsUser.image;
        token.hasPermesso104 = credentialsUser.hasPermesso104;
        token.hasPaternityLeave = credentialsUser.hasPaternityLeave;
        token.lastActivity = Date.now();
        
        // Get tokenVersion from user object (already fetched in authorize)
        token.tokenVersion = credentialsUser.tokenVersion || 0;
      } else if (token.email) {
        // Check if session is expired (30 minutes of inactivity)
        const lastActivity = (token.lastActivity as number) || 0;
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        if (now - lastActivity > thirtyMinutes) {
          // Session expired due to inactivity
          return {}; // This will invalidate the token
        }
        
        // Update lastActivity on token refresh (triggered by client)
        if (trigger === "update") {
          token.lastActivity = now;
          
          // Only validate tokenVersion on explicit updates (not on every request)
          // This reduces database queries significantly while still maintaining security
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { tokenVersion: true, image: true, hasPermesso104: true, hasPaternityLeave: true },
          });
          
          if (dbUser) {
            // Update image in token
            token.picture = dbUser.image;
            token.hasPermesso104 = dbUser.hasPermesso104;
            token.hasPaternityLeave = dbUser.hasPaternityLeave;

            const tokenVersionInToken = (token.tokenVersion as number) || 0;
            if (dbUser.tokenVersion !== tokenVersionInToken) {
              console.log(`🔒 Token invalidated for user ${token.id} - password changed`);
              auditAuth.sessionInvalidated(token.id as string);
              return {}; // Invalidate the token
            }
          }
        }
        
        // Keep existing id and role from token (no DB query needed)
      }
      return token;
    },
    async session({ session, token }) {
      if (token && token.id) {
        const typedToken = token as JWT & { id?: string; role?: string; lastActivity?: number; picture?: string; hasPermesso104?: boolean; hasPaternityLeave?: boolean };
        session.user = {
          id: typedToken.id ?? session.user?.id ?? "",
          email: session.user?.email ?? typedToken.email ?? "",
          name: session.user?.name ?? (typedToken.name as string | undefined),
          image: typedToken.picture,
          role: typedToken.role ?? "EMPLOYEE",
          hasPermesso104: typedToken.hasPermesso104 ?? false,
          hasPaternityLeave: typedToken.hasPaternityLeave ?? false,
        };
        // Add lastActivity to session for client-side tracking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).lastActivity = typedToken.lastActivity;
      } else {
        // Token is invalid or expired
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return null as any;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await auditAuth.loginSuccess(user.id, "session");
      }
    },
    async signOut({ token }) {
      const typedToken = token as JWT & { id?: string };
      if (typedToken?.id) {
        await auditAuth.logout(typedToken.id);
      }
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions);
