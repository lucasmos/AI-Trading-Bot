import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db'; // Assuming your Prisma client is exported from here
import bcrypt from 'bcryptjs'; // Added for password hashing
// import { authorizeDeriv, getDerivAccountSettings, getDerivAccountList } from '@/services/deriv'; // Removed: Not using direct API token for login

interface DerivAccount {
  loginid: string;
  is_default: 0 | 1;
  currency: string;
  // Add other properties if needed based on Deriv API response
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
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
    }),
    // Custom Deriv OAuth Provider
    // Removed for manual authorization flow
    // {
    //   id: "deriv", // This is the ID you will use with signIn('deriv')
    //   name: "Deriv",
    //   type: "oauth",
    //   clientId: process.env.NEXT_PUBLIC_DERIV_APP_ID as string,
    //   allowDangerousEmailAccountLinking: true,
    //   authorization: {
    //     url: "https://oauth.deriv.com/oauth2/authorize", // Reset to base URL
    //     params: { 
    //       scope: "read", 
    //       brand: "deriv", 
    //       app_id: process.env.NEXT_PUBLIC_DERIV_APP_ID as string, // Explicitly set app_id here
    //       "login_id": process.env.NEXT_PUBLIC_DERIV_ACCOUNT_ID 
    //     }
    //   },
    //   token: {
    //     // Deriv doesn't provide a standard token endpoint for public apps that returns JSON like other OAuth providers.
    //     // Instead, the tokens are in the redirect URI. We need to extract them here.
    //     async request({ params }) {
    //       console.log('[NextAuth Deriv Provider] Token callback received params:', params);
    //       // The 'code' parameter in NextAuth's OAuth provider usually contains the authorization code.
    //       // For Deriv, it appears to be the full redirect_uri with tokens.
    //       const redirectUrl = params.code as string; // This is actually the URL where Deriv redirects after auth
    //
    //       if (!redirectUrl) {
    //         console.error('[NextAuth Deriv Provider] No redirect URL (code) found in token callback params.');
    //         throw new Error('No Deriv redirect URL received.');
    //       }
    //
    //       const urlSearchParams = new URLSearchParams(redirectUrl.split('?')[1]);
    //       const derivToken = urlSearchParams.get('token1'); // Assuming 'token1' is the primary token
    //
    //       if (!derivToken) {
    //         console.error('[NextAuth Deriv Provider] No token1 found in Deriv redirect URL:', redirectUrl);
    //         throw new Error('Deriv session token not found in redirect URL.');
    //       }
    //
    //       console.log('[NextAuth Deriv Provider] Extracted Deriv token:', derivToken);
    //       return { tokens: { access_token: derivToken } };
    //     },
    //   },
    //   userinfo: { // This is where NextAuth fetches the user profile
    //     url: `${process.env.NEXTAUTH_URL}/api/deriv-profile`, // Our custom API route to fetch Deriv user info
    //     async request({ tokens, provider }) {
    //       // Pass the Deriv access token to our custom API route
    //       const response = await fetch((provider as any).userinfo.url, {
    //         headers: {
    //           'Authorization': `Bearer ${tokens.access_token}`,
    //         },
    //       });
    //       const profile = await response.json();
    //       return profile;
    //     },
    //   },
    //   profile(profile) {
    //     console.log('[NextAuth Deriv Provider] Profile callback received:', profile);
    //     // This maps the profile data returned from our /api/deriv-profile route to NextAuth's User structure
    //     const mappedProfile = {
    //       id: profile.derivUserId || profile.email,
    //       name: profile.name || profile.email,
    //       email: profile.email,
    //       image: profile.image || null,
    //       provider: 'deriv',
    //       derivAccountId: profile.derivAccountId,
    //       derivDemoAccountId: profile.derivDemoAccountId,
    //       derivDemoBalance: profile.derivDemoBalance,
    //       derivRealAccountId: profile.derivRealAccountId,
    //       derivRealBalance: profile.derivRealBalance,
    //     };
    //     console.log('[NextAuth Deriv Provider] Profile callback returning:', mappedProfile);
    //     return mappedProfile;
    //   },
    // },
  ],
  session: {
    strategy: 'jwt', // Using JWT for session strategy
  },
  callbacks: {
    async jwt({ token, user, account }) {
      console.log('[NextAuth Callbacks] JWT callback - before:', { token, user, account });
      // Persist the user ID, provider, and Deriv specific account details to the token
      if (user) {
        token.id = user.id;
        token.provider = user.provider; // Directly use user.provider from the profile callback
        token.derivAccountId = (user as any).derivAccountId;
        (token as any).derivDemoAccountId = (user as any).derivDemoAccountId;
        (token as any).derivDemoBalance = (user as any).derivDemoBalance;
        (token as any).derivRealAccountId = (user as any).derivRealAccountId;
        (token as any).derivRealBalance = (user as any).derivRealBalance;
      }
      if (account) {
        token.accessToken = account.access_token; // Store access token from provider if needed
        // The provider from account might be generic 'oauth', prefer our custom 'deriv' if available from user
        if (!token.provider) {
          token.provider = account.provider;
        }
      }
      console.log('[NextAuth Callbacks] JWT callback - after:', token);
      return token;
    },
    async session({ session, token }) {
      console.log('[NextAuth Callbacks] Session callback - before:', { session, token });
      // Send properties to the client, like user ID, provider, and Deriv specific account details from the token
      if (token.id && session.user) {
        (session.user as any).id = token.id as string;
      }
      if (token.provider && session.user) {
        (session.user as any).provider = token.provider as string; // Add provider to session user
      }
      if (token.derivAccountId && session.user) {
        (session.user as any).derivAccountId = token.derivAccountId as string; // Add derivAccountId to session user
      }
      if ((token as any).derivDemoAccountId && session.user) {
        (session.user as any).derivDemoAccountId = (token as any).derivDemoAccountId as string;
      }
      if ((token as any).derivDemoBalance && session.user) {
        (session.user as any).derivDemoBalance = (token as any).derivDemoBalance as number;
      }
      if ((token as any).derivRealAccountId && session.user) {
        (session.user as any).derivRealAccountId = (token as any).derivRealAccountId as string;
      }
      if ((token as any).derivRealBalance && session.user) {
        (session.user as any).derivRealBalance = (token as any).derivRealBalance as number;
      }
      console.log('[NextAuth Callbacks] Session callback - after:', session);
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