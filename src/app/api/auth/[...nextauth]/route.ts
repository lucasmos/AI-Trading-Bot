import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db'; // Assuming your Prisma client is exported from here
import bcrypt from 'bcryptjs'; // Added for password hashing

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    {
      id: "deriv",
      name: "Deriv",
      type: "oauth",
      clientId: process.env.DERIV_CLIENT_ID as string,
      clientSecret: process.env.DERIV_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        url: "https://oauth.deriv.com/oauth2/authorize",
        params: { scope: "read user_info" },
      },
      token: {
        url: "https://oauth.deriv.com/oauth2/token",
        // request: async (context) => { /* custom token request if needed */ const tokens = await fetch(/* ... */); return { tokens }; }
      },
      userinfo: {
        url: "https://oauth.deriv.com/oauth2/userinfo",
        // request: async (context) => { /* custom userinfo request if needed */ const profile = await fetch(/* ... */); return profile; }
      },
      profile(profile: any, tokens: any) { // Added 'any' types for profile and tokens for now
        // 'profile' is the user data object from Deriv's userinfo endpoint
        // Ensure the property names match what Deriv API returns
        return {
          id: profile.user_id, // or profile.id, or whatever Deriv uses
          name: profile.name || profile.email, // or profile.full_name
          email: profile.email,
          image: profile.picture || null, // or profile.avatar_url
        };
      },
    },
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your@email.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials || !credentials.email || !credentials.password) {
          console.log('[NextAuth Credentials] Missing credentials');
          return null;
        }

        console.log('[NextAuth Credentials] Attempting to authorize user:', credentials.email);
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          console.log('[NextAuth Credentials] User not found with email:', credentials.email);
          return null; // User not found
        }

        if (!user.hashedPassword) {
          console.log('[NextAuth Credentials] User found, but no hashedPassword set for:', credentials.email);
          // This case means the user exists but can't sign in via password (e.g., signed up via OAuth)
          return null; 
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.hashedPassword);

        if (!isValidPassword) {
          console.log('[NextAuth Credentials] Invalid password for user:', credentials.email);
          return null; // Password does not match
        }

        console.log('[NextAuth Credentials] Successfully authorized user:', credentials.email, 'User ID:', user.id);
        // Return the user object (without sensitive data like hashedPassword if you want)
        // The adapter will handle linking/creating session based on this user object.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          // You can add other properties you want in the session user object here
        };
      }
    })
  ],
  session: {
    strategy: 'jwt', // Using JWT for session strategy
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the user ID and role (if any) to the token
      if (user) {
        token.id = user.id;
        // token.role = user.role; // Example if you have roles
      }
      if (account) {
        token.accessToken = account.access_token; // Store access token from provider if needed
        token.provider = account.provider; // Add provider to the token
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user ID from the token
      if (token.id && session.user) {
        (session.user as any).id = token.id as string;
      }
      if (token.provider && session.user) {
        (session.user as any).provider = token.provider as string; // Add provider to session user
      }
      // if (token.role && session.user) {
      //   (session.user as any).role = token.role; // Example
      // }
      // if (token.accessToken && session) {
      //  (session as any).accessToken = token.accessToken;
      // }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login', // Custom sign-in page (if you have one, otherwise uses default)
    // signOut: '/auth/signout',
    // error: '/auth/error', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request', // (Used for e.g. email verification)
    // newUser: '/auth/new-user' // New users will be directed here on first sign in (leave undefined to redirect to /)
  },
  // secret: process.env.NEXTAUTH_SECRET, // Already handled by Next.js if NEXTAUTH_SECRET env var is set
  // debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 