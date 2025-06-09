import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db'; // Assuming your Prisma client is exported from here
import bcrypt from 'bcryptjs'; // Added for password hashing
import WebSocket from 'ws'; // Added for Deriv account details fetching
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

        // Helper Interfaces for Deriv WebSocket response
        interface DerivAccountDetails {
            loginid: string;
            is_virtual?: 0 | 1;
            balance?: number;
            currency?: string;
        }

        interface DerivAuthorizeResponseData {
            account_list?: DerivAccountDetails[];
            email?: string;
            fullname?: string;
            user_id?: string;
            loginid?: string;
            // other fields from authorize response if needed
        }

        const DERIV_ACCOUNT_DETAILS_TIMEOUT_MS = 20000;


        try {
          let user = await prisma.user.findUnique({ where: { email: credentials.email } });

          if (user) { // User with this email exists
            console.log(`[Deriv CredentialsProvider] User found by email: ${user.id}. Preserving this ID.`);

            const accountLinkedToDerivId = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'deriv-credentials',
                  providerAccountId: credentials.derivUserId,
                },
              },
            });

            if (accountLinkedToDerivId) {
              if (accountLinkedToDerivId.userId === user.id) {
                console.log(`[Deriv CredentialsProvider] Deriv ID ${credentials.derivUserId} already linked to this user ${user.id}.`);
                if (accountLinkedToDerivId.access_token !== credentials.accessToken) {
                  await prisma.account.update({
                    where: { id: accountLinkedToDerivId.id },
                    data: { access_token: credentials.accessToken },
                  });
                  console.log(`[Deriv CredentialsProvider] Access token updated for user ${user.id}.`);
                }
              } else {
                console.error(`[Deriv CredentialsProvider] Conflict: Deriv User ID ${credentials.derivUserId} is already linked to user ${accountLinkedToDerivId.userId}, but email ${credentials.email} is associated with user ${user.id}. Cannot proceed.`);
                return null;
              }
            } else {
              console.log(`[Deriv CredentialsProvider] Deriv ID ${credentials.derivUserId} not linked. Linking to user ${user.id}.`);
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

            if (credentials.name && user.name !== credentials.name) {
              console.log(`[Deriv CredentialsProvider] Updating name for user ${user.id} to ${credentials.name}.`);
              user = await prisma.user.update({
                where: { id: user.id },
                data: { name: credentials.name },
              });
            }
          } else { // No user found with this email, so create a new user
            console.log(`[Deriv CredentialsProvider] No user found by email ${credentials.email}.`);

            const accountByDerivId = await prisma.account.findUnique({
                where: {
                    provider_providerAccountId: {
                        provider: 'deriv-credentials',
                        providerAccountId: credentials.derivUserId,
                    }
                }
            });

            if (accountByDerivId) {
                console.error(`[Deriv CredentialsProvider] Error: Deriv User ID ${credentials.derivUserId} is already linked to user ${accountByDerivId.userId} (who has a different email). Cannot create new user with email ${credentials.email} and link this Deriv ID.`);
                return null;
            }

            console.log(`[Deriv CredentialsProvider] Creating new user for email ${credentials.email}.`);
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: credentials.name,
                emailVerified: new Date(),
              },
            });
            console.log(`[Deriv CredentialsProvider] New user created: ${user.id}. Linking Deriv account ${credentials.derivUserId}.`);
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

          if (!user) { // Should not happen if logic above is correct
            console.error('[Deriv CredentialsProvider] User object is null after primary processing. This should not occur.');
            return null;
          }

          // --- New logic to fetch additional Deriv details ---
          let additionalDerivData = {
            derivActualUserId: null as string | null,
            derivEmail: null as string | null,
            derivFullname: null as string | null,
            derivLoginId: null as string | null,
            derivDemoAccountId: null as string | null,
            derivDemoBalance: null as number | null,
            derivRealAccountId: null as string | null,
            derivRealBalance: null as number | null,
          };

          const derivAppIdForWS = process.env.NEXT_PUBLIC_DERIV_APP_ID;
          if (!derivAppIdForWS) {
            console.error('[Deriv CredentialsProvider] NEXT_PUBLIC_DERIV_APP_ID is not set. Cannot fetch additional Deriv account details.');
          } else {
            console.log(`[Deriv CredentialsProvider] Attempting to fetch additional details for Deriv User ID (from credentials): ${credentials.derivUserId} using token.`);
            try {
              await new Promise<void>((resolve, reject) => {
                const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppIdForWS}`);
                let timeoutId: NodeJS.Timeout | null = null;

                const cleanupAndResolve = () => {
                  if (timeoutId) clearTimeout(timeoutId);
                  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
                  resolve();
                };

                const cleanupAndReject = (error: Error) => {
                  if (timeoutId) clearTimeout(timeoutId);
                  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
                  reject(error);
                };

                ws.on('open', () => {
                  console.log('[Deriv CredentialsProvider] WS open for details. Sending authorize.');
                  ws.send(JSON.stringify({ authorize: credentials.accessToken, req_id: 2 })); // Using req_id 2
                });

                ws.on('message', (data) => {
                  const rawData = data.toString();
                  console.log('[Deriv CredentialsProvider] WS message for details:', rawData.substring(0, 300) + (rawData.length > 300 ? '...' : ''));
                  try {
                    const response = JSON.parse(rawData) as { authorize?: DerivAuthorizeResponseData, error?: any, msg_type?: string };
                    if (response.error) {
                      console.error('[Deriv CredentialsProvider] WS Error from Deriv for details:', response.error);
                      cleanupAndReject(new Error(response.error.message || 'Deriv API error fetching details'));
                      return;
                    }

                    if (response.msg_type === 'authorize' && response.authorize) {
                      const derivUser = response.authorize;
                      additionalDerivData.derivActualUserId = derivUser.user_id || null;
                      additionalDerivData.derivEmail = derivUser.email || null;
                      additionalDerivData.derivFullname = derivUser.fullname || null;
                      additionalDerivData.derivLoginId = derivUser.loginid || null;

                      if (derivUser.account_list && derivUser.account_list.length > 0) {
                        const demoAccount = derivUser.account_list.find(acc => acc.is_virtual === 1 && acc.loginid?.startsWith('VRTC'));
                        const realAccount = derivUser.account_list.find(acc => acc.is_virtual === 0 && acc.loginid?.startsWith('CR'));

                        if (demoAccount) {
                          additionalDerivData.derivDemoAccountId = demoAccount.loginid;
                          additionalDerivData.derivDemoBalance = demoAccount.balance ?? null;
                        }
                        if (realAccount) {
                          additionalDerivData.derivRealAccountId = realAccount.loginid;
                          additionalDerivData.derivRealBalance = realAccount.balance ?? null;
                        }
                      }
                      console.log('[Deriv CredentialsProvider] Successfully fetched additional Deriv details.');
                      cleanupAndResolve();
                    }
                  } catch (e) {
                    console.error('[Deriv CredentialsProvider] WS Error parsing details message:', e);
                    cleanupAndReject(e instanceof Error ? e : new Error('Error parsing Deriv details response'));
                  }
                });

                ws.on('error', (err) => {
                  console.error('[Deriv CredentialsProvider] WS Error for details:', err);
                  cleanupAndReject(err);
                });
                ws.on('close', (code, reason) => {
                    console.log(`[Deriv CredentialsProvider] WS for details closed. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}`);
                    // If promise is still pending, it means it wasn't resolved by a message. Could be premature close.
                    // The timeout will handle this.
                });

                timeoutId = setTimeout(() => {
                  console.warn('[Deriv CredentialsProvider] WS for details timed out.');
                  cleanupAndReject(new Error('Timeout fetching Deriv account details'));
                }, DERIV_ACCOUNT_DETAILS_TIMEOUT_MS);
              });
            } catch (wsError) {
              console.error('[Deriv CredentialsProvider] Failed to fetch additional Deriv details via WebSocket:', wsError);
              // additionalDerivData will retain its default null values
            }
          }

          console.log(`[Deriv CredentialsProvider] Authorize successful for user: ${user.id}, email: ${user.email}. Returning combined data.`);
          return {
            id: user.id,
            email: user.email, // The email used for User record matching/creation
            name: user.name,   // This might have been updated by credentials.name earlier
            image: user.image, // Existing image or null
            // Spread the fetched Deriv details
            ...additionalDerivData
          };

        } catch (error) {
          console.error('[Deriv CredentialsProvider] Error in authorize function (outer try/catch):', error);
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
    async jwt({ token, user, account, profile }) { // Added profile for potential future use, not strictly needed here yet
      console.log('[NextAuth Callbacks] JWT - Input:', { user, account: account ? {provider: account.provider, type: account.type} : null });

      if (account && user) { // This block runs on sign-in or linking
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image; // user.image can be null
        token.provider = account.provider;

        if (account.provider === 'deriv-credentials') {
          // The user object comes from our updated 'authorize' function
          token.derivAccessToken = (user as any).derivAccessToken;
          token.derivActualUserId = (user as any).derivActualUserId; // Verified User ID from Deriv API
          token.derivEmail = (user as any).derivEmail;         // Email from Deriv API
          token.derivFullname = (user as any).derivFullname;      // Fullname from Deriv API
          token.derivLoginId = (user as any).derivLoginId;       // Login ID from Deriv API for this token
          token.derivDemoAccountId = (user as any).derivDemoAccountId;
          token.derivDemoBalance = (user as any).derivDemoBalance;
          token.derivRealAccountId = (user as any).derivRealAccountId;
          token.derivRealBalance = (user as any).derivRealBalance;

          // Clear Google-specific token if present
          delete token.googleAccessToken;
        } else if (account.provider === 'google') {
          token.googleAccessToken = account.access_token;

          // Clear Deriv-specific tokens
          delete token.derivAccessToken;
          delete token.derivActualUserId;
          delete token.derivEmail;
          delete token.derivFullname;
          delete token.derivLoginId;
          delete token.derivDemoAccountId;
          delete token.derivDemoBalance;
          delete token.derivRealAccountId;
          delete token.derivRealBalance;
        }
      }
      // For subsequent JWT reads, token should already have these details.
      // console.log('[NextAuth Callbacks] JWT - Output:', token); // Be careful logging tokens in prod
      return token;
    },
    async session({ session, token }) {
      // console.log('[NextAuth Callbacks] Session - Input token:', token);
      // console.log('[NextAuth Callbacks] Session - Input session:', session);

      // Transfer common properties from token to session.user
      if (token.id && session.user) session.user.id = token.id as string;
      if (token.email && session.user) session.user.email = token.email as string; // Ensure email is part of session.user
      if (token.name && session.user) session.user.name = token.name as string;
      if (session.user) session.user.image = token.picture as string | null; // token.picture can be null

      if (token.provider && session.user) {
        (session.user as any).provider = token.provider as string;
      }

      if (token.provider === 'deriv-credentials') {
        if (session.user) {
          (session.user as any).derivAccessToken = token.derivAccessToken as string | undefined;
          (session.user as any).derivActualUserId = token.derivActualUserId as string | undefined;
          (session.user as any).derivEmail = token.derivEmail as string | undefined;
          (session.user as any).derivFullname = token.derivFullname as string | undefined;
          (session.user as any).derivLoginId = token.derivLoginId as string | undefined;
          (session.user as any).derivDemoAccountId = token.derivDemoAccountId as string | undefined;
          (session.user as any).derivDemoBalance = token.derivDemoBalance as number | null | undefined;
          (session.user as any).derivRealAccountId = token.derivRealAccountId as string | undefined;
          (session.user as any).derivRealBalance = token.derivRealBalance as number | null | undefined;

          delete (session.user as any).googleAccessToken;
        }
      } else if (token.provider === 'google') {
        if (token.googleAccessToken && session.user) {
          (session.user as any).googleAccessToken = token.googleAccessToken as string | undefined;
        }
        if (session.user) {
          delete (session.user as any).derivAccessToken;
          delete (session.user as any).derivActualUserId;
          delete (session.user as any).derivEmail;
          delete (session.user as any).derivFullname;
          delete (session.user as any).derivLoginId;
          delete (session.user as any).derivDemoAccountId;
          delete (session.user as any).derivDemoBalance;
          delete (session.user as any).derivRealAccountId;
          delete (session.user as any).derivRealBalance;
        }
      }
      // console.log('[NextAuth Callbacks] Session - Output session:', session);
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