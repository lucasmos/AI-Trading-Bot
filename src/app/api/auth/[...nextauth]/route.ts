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

          if (user) {
            console.log(`[Deriv CredentialsProvider] User found by email: ${user.id}`);
            const existingAccount = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                },
              },
            });

            if (!existingAccount) {
              console.log(`[Deriv CredentialsProvider] Linking Deriv account ${credentials.derivUserId} to existing user ${user.id}`);
              await prisma.account.create({
                data: {
                  userId: user.id,
                  type: 'oauth', // Using 'oauth' as type for consistency, or 'deriv-custom-token'
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                  access_token: credentials.accessToken,
                },
              });
            } else {
              console.log(`[Deriv CredentialsProvider] Deriv account ${credentials.derivUserId} already linked to user ${user.id}.`);
              if (existingAccount.access_token !== credentials.accessToken) {
                console.log(`[Deriv CredentialsProvider] Updating access token for account ${existingAccount.id}`);
                await prisma.account.update({
                  where: { id: existingAccount.id },
                  data: { access_token: credentials.accessToken }
                });
              }
            }

            if (credentials.name && user.name !== credentials.name) {
              console.log(`[Deriv CredentialsProvider] Updating name for user ${user.id}`);
              user = await prisma.user.update({
                where: { id: user.id },
                data: { name: credentials.name },
              });
            }
          } else {
            console.log(`[Deriv CredentialsProvider] No user found by email ${credentials.email}. Checking by providerAccountId.`);
            const account = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                },
              },
              include: { user: true },
            });

            if (account) {
              user = account.user;
              console.log(`[Deriv CredentialsProvider] User found via account: ${user.id}`);
              let userDataToUpdate: { email?: string, name?: string } = {};
              if (credentials.email && user.email !== credentials.email) {
                userDataToUpdate.email = credentials.email;
              }
              if (credentials.name && user.name !== credentials.name) {
                userDataToUpdate.name = credentials.name;
              }
              if (Object.keys(userDataToUpdate).length > 0) {
                console.log(`[Deriv CredentialsProvider] Updating user data for user ${user.id}:`, userDataToUpdate);
                user = await prisma.user.update({ where: { id: user.id }, data: userDataToUpdate });
              }
              if (account.access_token !== credentials.accessToken) {
                console.log(`[Deriv CredentialsProvider] Updating access token for account ${account.id}`);
                await prisma.account.update({
                  where: { id: account.id },
                  data: { access_token: credentials.accessToken }
                });
              }
            } else {
              console.log(`[Deriv CredentialsProvider] No existing user or account. Creating new user for email ${credentials.email}.`);
              user = await prisma.user.create({
                data: {
                  email: credentials.email,
                  name: credentials.name,
                  // emailVerified: new Date(), // Optional: consider if email is verified
                },
              });
              console.log(`[Deriv CredentialsProvider] New user created: ${user.id}. Linking Deriv account.`);
              await prisma.account.create({
                data: {
                  userId: user.id,
                  type: 'oauth', // Or 'deriv-custom-token'
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                  access_token: credentials.accessToken,
                },
              });
            }
          }

          if (user) {
            console.log(`[Deriv CredentialsProvider] Authorize successful for user: ${user.id}, email: ${user.email}`);
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              derivAccessToken: credentials.accessToken // Added Deriv access token
            };
          } else {
            console.error('[Deriv CredentialsProvider] User could not be found or created.');
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

        // If user object has derivAccessToken (from deriv-credentials authorize), prioritize it
        if ((user as any).derivAccessToken) {
          token.derivAccessToken = (user as any).derivAccessToken;
          console.log('[NextAuth Callbacks] JWT callback - Deriv access token stored from user object:', token.derivAccessToken ? '******' : 'NOT STORED');
        }
      }

      // This part handles general OAuth providers and might also catch the deriv-credentials
      // if the 'user' object didn't have derivAccessToken for some reason (though it should).
      // The previous specific check for 'deriv-credentials' using account.access_token here is removed
      // as account.access_token was not reliably providing the Deriv token in that flow.
      if (account) {
        // Store generic access token if needed, could be from any provider (e.g. Google)
        token.accessToken = account.access_token;

        // If derivAccessToken is not already set from 'user' object and provider is 'deriv-credentials',
        // this is a fallback, though less likely to be hit now.
        // This specific block for deriv-credentials from account.access_token is removed as it was problematic.
        // if (account.provider === 'deriv-credentials' && !token.derivAccessToken) {
        //   token.derivAccessToken = account.access_token; // This was often undefined
        //   console.log('[NextAuth Callbacks] JWT callback - Deriv access token (fallback from account):', token.derivAccessToken ? '******' : 'NOT STORED');
        // }

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
      // Add derivAccessToken to the session user object
      if (token.derivAccessToken && session.user) {
        (session.user as any).derivAccessToken = token.derivAccessToken as string;
        // Structure it as derivApiToken for consistency with how handleExecuteTrade might expect it
        (session.user as any).derivApiToken = { access_token: token.derivAccessToken as string };
        console.log('[NextAuth Callbacks] Session callback - Deriv access token added to session user.');
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