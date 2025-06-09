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
      id: "deriv-credentials",
      name: "Deriv Custom Auth",
      credentials: {
        derivUserId: { label: "Deriv User ID", type: "text" },
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
        accessToken: { label: "Deriv Access Token", type: "text" }
      },
      async authorize(credentials, req) {
        console.log('[Deriv CredentialsProvider] Received credentials:', JSON.stringify(credentials, null, 2));

        if (!credentials || !credentials.derivUserId || !credentials.email || !credentials.accessToken) {
          console.error('[Deriv CredentialsProvider] Missing essential credentials.');
          return null;
        }

        try {
          let user = await prisma.user.findUnique({ where: { email: credentials.email } });

          if (user) { // User with this email exists
            console.log(`[Deriv CredentialsProvider] User found by email: ${user.id}. Preserving this ID.`);

            // Check if this Deriv account (credentials.derivUserId) is already linked to ANY user.
            const accountLinkedToDerivId = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                },
              },
            });

            if (accountLinkedToDerivId) {
              // Deriv ID is already linked. Check if it's linked to the CURRENT user (found by email).
              if (accountLinkedToDerivId.userId === user.id) {
                // Yes, it's linked to the correct user. Update token if necessary.
                console.log(`[Deriv CredentialsProvider] Deriv ID ${credentials.derivUserId} already linked to this user ${user.id}.`);
                if (accountLinkedToDerivId.access_token !== credentials.accessToken) {
                  await prisma.account.update({
                    where: { id: accountLinkedToDerivId.id },
                    data: { access_token: credentials.accessToken },
                  });
                  console.log(`[Deriv CredentialsProvider] Access token updated for user ${user.id}.`);
                }
              } else {
                // Conflict: This Deriv ID is linked to a DIFFERENT user.
                // Email (credentials.email) belongs to user A (user.id), but Deriv ID (credentials.derivUserId)
                // is linked to user B (accountLinkedToDerivId.userId).
                console.error(`[Deriv CredentialsProvider] Conflict: Deriv User ID ${credentials.derivUserId} is already linked to user ${accountLinkedToDerivId.userId}, but email ${credentials.email} is associated with user ${user.id}. Cannot proceed.`);
                return null;
              }
            } else {
              // Deriv ID is not linked to any user yet. Link it to this user (found by email).
              console.log(`[Deriv CredentialsProvider] Deriv ID ${credentials.derivUserId} not linked. Linking to user ${user.id}.`);
              await prisma.account.create({
                data: {
                  userId: user.id,
                  type: 'oauth', // Consistent with NextAuth adapter, or choose 'credentials'
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                  access_token: credentials.accessToken,
                },
              });
            }

            // Optionally update the user's name if provided from Deriv and different
            if (credentials.name && user.name !== credentials.name) {
              console.log(`[Deriv CredentialsProvider] Updating name for user ${user.id} to ${credentials.name}.`);
              user = await prisma.user.update({
                where: { id: user.id },
                data: { name: credentials.name },
              });
            }
          } else { // No user found with this email, so create a new user
            console.log(`[Deriv CredentialsProvider] No user found by email ${credentials.email}.`);

            // Safeguard: Check if this Deriv ID (credentials.derivUserId) is already linked to another user.
            // This prevents linking one Deriv account to multiple application users if emails differ.
            const accountByDerivId = await prisma.account.findUnique({
                where: {
                    provider_providerAccountId: {
                        provider: 'deriv-credentials',
                        providerAccountId: credentials.derivUserId,
                    }
                }
            });

            if (accountByDerivId) {
                // This Deriv ID is already linked to some user.
                // Since no user was found by credentials.email, this means the linked user has a different email.
                // This is a conflict: we can't create a new user with credentials.email and link an already-associated Deriv ID.
                console.error(`[Deriv CredentialsProvider] Error: Deriv User ID ${credentials.derivUserId} is already linked to user ${accountByDerivId.userId} (who has a different email). Cannot create new user with email ${credentials.email} and link this Deriv ID.`);
                return null;
            }

            // Create new user (ID will be auto-generated by Prisma)
            console.log(`[Deriv CredentialsProvider] Creating new user for email ${credentials.email}.`);
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: credentials.name,
                emailVerified: new Date(), // Email from Deriv can be considered verified
              },
            });
            console.log(`[Deriv CredentialsProvider] New user created: ${user.id}. Linking Deriv account ${credentials.derivUserId}.`);
            // Link the new Deriv account to this new user
            await prisma.account.create({
              data: {
                userId: user.id,
                type: 'oauth',
                provider: 'deriv-credentials',
                providerAccountId: credentials.derivUserId,
                access_token: credentials.accessToken,
              },
            });
          }

          if (user) {
            console.log(`[Deriv CredentialsProvider] Authorize successful for user: ${user.id}, email: ${user.email}`);
            return {
              id: user.id, // This MUST be the stable Prisma User ID
              email: user.email,
              name: user.name,
              image: user.image, // Will be null if new user or existing user didn't have one
            };
          } else {
            // This case should ideally not be reached if logic above is correct, but as a fallback:
            console.error('[Deriv CredentialsProvider] User object is null after processing.');
            return null;
          }
        } catch (error) {
          console.error('[Deriv CredentialsProvider] Error in authorize function:', error);
          return null;
        }
      }
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
      console.log('[NextAuth Callbacks] JWT callback - Input:', { token: {...token}, user, account });

      // On initial sign-in, `user` and `account` objects are passed.
      if (account && user) { // This block runs on sign-in or linking
        token.id = user.id;
        token.email = user.email; // Ensure email is in token
        token.name = user.name;   // Ensure name is in token
        token.picture = user.image; // Ensure image is in token (might be null)
        token.provider = account.provider;

        if (account.provider === 'deriv-credentials') {
          token.derivAccessToken = account.access_token;
          token.derivUserId = account.providerAccountId; // This is the original Deriv User ID

          // Clear Google-specific token if switching/linking to Deriv
          delete token.googleAccessToken;
          // Clear any other provider specific tokens if necessary
        } else if (account.provider === 'google') {
          token.googleAccessToken = account.access_token; // Store Google access token if needed

          // Clear Deriv-specific tokens if switching/linking to Google
          delete token.derivAccessToken;
          delete token.derivUserId;
          // Clear any other provider specific tokens
        }
        // TODO: Handle other providers if they exist
      }
      // For subsequent JWT reads, `user` and `account` are undefined.
      // Token already has id, email, name, picture from previous runs.

      console.log('[NextAuth Callbacks] JWT callback - Output:', {...token});
      return token;
    },
    async session({ session, token }) {
      console.log('[NextAuth Callbacks] Session callback - Input:', { session: {...session}, token: {...token} });

      // Standard user properties
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      if (token.email && session.user) {
        session.user.email = token.email as string;
      }
      if (token.name && session.user) {
        session.user.name = token.name as string;
      }
      if (token.picture && session.user) { // picture can be null
        session.user.image = token.picture as string | null;
      } else if (session.user) {
        session.user.image = null; // Ensure it's explicitly null if not in token
      }

      // Provider-specific properties
      if (token.provider && session.user) {
        (session.user as any).provider = token.provider as string;
      }

      if (token.provider === 'deriv-credentials') {
        if (token.derivAccessToken && session.user) {
          (session.user as any).derivAccessToken = token.derivAccessToken as string;
        }
        if (token.derivUserId && session.user) {
          (session.user as any).derivUserId = token.derivUserId as string;
        }
        // Explicitly nullify other provider tokens in session
        if (session.user) {
          delete (session.user as any).googleAccessToken;
        }
      } else if (token.provider === 'google') {
        if (token.googleAccessToken && session.user) {
          (session.user as any).googleAccessToken = token.googleAccessToken as string;
        }
        // Explicitly nullify other provider tokens in session
        if (session.user) {
          delete (session.user as any).derivAccessToken;
          delete (session.user as any).derivUserId;
        }
      }

      // The other Deriv fields (derivDemoAccountId, derivDemoBalance etc.) are NOT in the token
      // based on the current plan. AuthContext will handle them being null or fetching them.
      // However, if they were somehow added to the token by a previous version or different flow,
      // this is where they'd be transferred to session.user if desired.
      // For now, we only add what we've explicitly put in the token.

      console.log('[NextAuth Callbacks] Session callback - Output:', {...session});
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