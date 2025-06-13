import NextAuth, { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getDerivAccountList } from '@/services/deriv'; // Import for fetching account details

// Define an extended User type for NextAuth to include derivAccessToken
interface ExtendedUser extends NextAuthUser {
  derivAccessToken?: string;
  derivAccountId?: string;
  derivDemoAccountId?: string;
  derivDemoBalance?: number;
  derivRealAccountId?: string;
  derivRealBalance?: number;
  provider?: string;
}

// Define an extended Token type for JWT callback
interface ExtendedToken {
  id?: string;
  provider?: string;
  derivAccessToken?: string;
  derivAccountId?: string; // This can be the currently selected one (demo/real) or default
  derivDemoAccountId?: string;
  derivDemoBalance?: number;
  derivRealAccountId?: string;
  derivRealBalance?: number;
  selectedDerivAccountType?: string; // "demo" or "real"
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  sub?: string;
  accessToken?: string;
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
      async authorize(credentials, req): Promise<ExtendedUser | null> {
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
                  type: 'credentials',
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
               user = await prisma.user.update({ where: { id: user.id }, data: { name: credentials.name }});
            }
          } else {
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
            } else {
                console.log(`[Deriv CredentialsProvider] No existing user. Creating new user for email ${credentials.email}.`);
                user = await prisma.user.create({
                    data: {
                    email: credentials.email,
                    name: credentials.name,
                    },
                });
                await prisma.account.create({
                    data: {
                    userId: user.id,
                    type: 'credentials',
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
              derivAccessToken: credentials.accessToken,
              provider: 'deriv-credentials'
            };
          }
          return null;
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
      async authorize(credentials, req): Promise<NextAuthUser | null> {
        if (!credentials || !credentials.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.hashedPassword) return null;
        const isValidPassword = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!isValidPassword) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      }
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }): Promise<ExtendedToken> {
      const extendedToken = token as ExtendedToken;
      console.log('[NextAuth Callbacks] JWT callback - before processing:', { 
        token: JSON.stringify(extendedToken, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2), 
        user: user ? JSON.stringify(user as ExtendedUser, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2) : undefined,
        account 
      });

      if (user) { 
        const u = user as ExtendedUser;
        extendedToken.id = u.id;
        extendedToken.provider = u.provider || account?.provider;

        if (u.derivAccessToken) {
          extendedToken.derivAccessToken = u.derivAccessToken;
          console.log('[NextAuth Callbacks] JWT - Deriv access token stored from user object.');

          try {
            console.log(`[NextAuth Callbacks] JWT - Attempting to fetch Deriv account list.`);
            const accountListResponse = await getDerivAccountList(extendedToken.derivAccessToken as string);

            if (accountListResponse && accountListResponse.account_list) {
              console.log('[NextAuth Callbacks] JWT - Successfully fetched Deriv account list.');
              const accounts = accountListResponse.account_list as any[];

              const apiDemoAccount = accounts.find(acc => acc.is_virtual === 1);
              const apiRealAccount = accounts.find(acc => acc.is_virtual === 0); // Simplified: taking the first real, default logic can be more complex

              const demoAccountIdFromApi = apiDemoAccount?.loginid;
              const realAccountIdFromApi = apiRealAccount?.loginid;
              // Balances from API are fresh but we might not store them directly in token yet, rather in DB first
              // const demoBalanceFromApi = apiDemoAccount ? parseFloat(apiDemoAccount.balance) : undefined;
              // const realBalanceFromApi = apiRealAccount ? parseFloat(apiRealAccount.balance) : undefined;

              try {
                const userSettings = await prisma.userSettings.upsert({
                  where: { userId: u.id! },
                  create: {
                    userId: u.id!,
                    derivDemoAccountId: demoAccountIdFromApi,
                    derivRealAccountId: realAccountIdFromApi,
                    selectedDerivAccountType: "demo", // Default, user can change later
                    settings: {}, // Added default empty JSON object
                    // derivDemoBalance: demoBalanceFromApi, // Store initial balance
                    // derivRealBalance: realBalanceFromApi, // Store initial balance
                    // lastBalanceSync: new Date(), // TODO: Uncomment when balances are fetched
                  },
                  update: {
                    derivDemoAccountId: demoAccountIdFromApi, // Update if different
                    derivRealAccountId: realAccountIdFromApi, // Update if different
                    // derivDemoBalance: demoBalanceFromApi, // Update with fresh balance
                    // derivRealBalance: realBalanceFromApi, // Update with fresh balance
                    // lastBalanceSync: new Date(), // TODO: Uncomment when balances are fetched
                  },
                });
                console.log('[NextAuth Callbacks] JWT - UserSettings updated/created for user:', u.id);

                // Populate token from these newly saved/updated settings
                extendedToken.derivDemoAccountId = userSettings.derivDemoAccountId ?? undefined;
                extendedToken.derivRealAccountId = userSettings.derivRealAccountId ?? undefined;
                extendedToken.selectedDerivAccountType = userSettings.selectedDerivAccountType ?? "demo";
                extendedToken.derivDemoBalance = userSettings.derivDemoBalance ?? undefined;
                extendedToken.derivRealBalance = userSettings.derivRealBalance ?? undefined;

                // Determine the primary derivAccountId for the token based on selected type
                if (userSettings.selectedDerivAccountType === "real" && userSettings.derivRealAccountId) {
                  extendedToken.derivAccountId = userSettings.derivRealAccountId;
                } else if (userSettings.selectedDerivAccountType === "demo" && userSettings.derivDemoAccountId) {
                  extendedToken.derivAccountId = userSettings.derivDemoAccountId;
                } else {
                  // Fallback if selected type is somehow not set or ID for it is missing
                  extendedToken.derivAccountId = userSettings.derivRealAccountId ?? userSettings.derivDemoAccountId ?? undefined;
                }

                console.log('[NextAuth Callbacks] JWT - Token populated from UserSettings DB.');
                // TODO: Fetch initial demo balance using getDerivAccountBalance(demoAccountIdFromApi) and update UserSettings + token.
                // TODO: Fetch initial real balance using getDerivAccountBalance(realAccountIdFromApi) and update UserSettings + token.
                // This would involve another call to prisma.userSettings.update after fetching balances.

              } catch (dbError: any) {
                console.error('[NextAuth Callbacks] JWT - Error saving/fetching UserSettings to/from DB:', dbError.message || dbError);
                // Fallback: Populate token with IDs directly from API if DB operation fails
                extendedToken.derivDemoAccountId = demoAccountIdFromApi;
                extendedToken.derivRealAccountId = realAccountIdFromApi;
                // Balances from API could be used here if needed, but primary source should be DB for consistency
                // extendedToken.derivDemoBalance = demoBalanceFromApi;
                // extendedToken.derivRealBalance = realBalanceFromApi;
                if (extendedToken.derivDemoAccountId) extendedToken.derivAccountId = extendedToken.derivDemoAccountId; // Default to demo if DB fails
              }
            } else {
              console.warn('[NextAuth Callbacks] JWT - Failed to fetch Deriv account list. Attempting to load from DB.');
              if (u.id) {
                try {
                  const userSettings = await prisma.userSettings.findUnique({ where: { userId: u.id } });
                  if (userSettings) {
                    extendedToken.derivDemoAccountId = userSettings.derivDemoAccountId ?? undefined;
                    extendedToken.derivRealAccountId = userSettings.derivRealAccountId ?? undefined;
                    extendedToken.selectedDerivAccountType = userSettings.selectedDerivAccountType ?? "demo";
                    extendedToken.derivDemoBalance = userSettings.derivDemoBalance ?? undefined;
                    extendedToken.derivRealBalance = userSettings.derivRealBalance ?? undefined;
                    if (userSettings.selectedDerivAccountType === "real" && userSettings.derivRealAccountId) {
                      extendedToken.derivAccountId = userSettings.derivRealAccountId;
                    } else if (userSettings.selectedDerivAccountType === "demo" && userSettings.derivDemoAccountId) {
                      extendedToken.derivAccountId = userSettings.derivDemoAccountId;
                    } else {
                      extendedToken.derivAccountId = userSettings.derivRealAccountId ?? userSettings.derivDemoAccountId ?? undefined;
                    }
                    console.log('[NextAuth Callbacks] JWT - Token populated from existing UserSettings due to API fail.');
                  } else {
                    console.log('[NextAuth Callbacks] JWT - No existing UserSettings found for user after API fail:', u.id);
                  }
                } catch (dbError: any) {
                  console.error('[NextAuth Callbacks] JWT - Error fetching existing UserSettings from DB after API fail:', dbError.message || dbError);
                }
              }
            }
          } catch (error: any) { // Catch for getDerivAccountList
            console.error('[NextAuth Callbacks] JWT - Error during Deriv account list processing or DB operations:', error.message || error);
            console.warn('[NextAuth Callbacks] JWT - Deriv account details could not be fetched/processed. Attempting to load from DB.');
            if (u.id) {
                try {
                  const userSettings = await prisma.userSettings.findUnique({ where: { userId: u.id } });
                  if (userSettings) {
                    extendedToken.derivDemoAccountId = userSettings.derivDemoAccountId ?? undefined;
                    extendedToken.derivRealAccountId = userSettings.derivRealAccountId ?? undefined;
                    extendedToken.selectedDerivAccountType = userSettings.selectedDerivAccountType ?? "demo";
                    extendedToken.derivDemoBalance = userSettings.derivDemoBalance ?? undefined;
                    extendedToken.derivRealBalance = userSettings.derivRealBalance ?? undefined;
                     if (userSettings.selectedDerivAccountType === "real" && userSettings.derivRealAccountId) {
                      extendedToken.derivAccountId = userSettings.derivRealAccountId;
                    } else if (userSettings.selectedDerivAccountType === "demo" && userSettings.derivDemoAccountId) {
                      extendedToken.derivAccountId = userSettings.derivDemoAccountId;
                    } else {
                      extendedToken.derivAccountId = userSettings.derivRealAccountId ?? userSettings.derivDemoAccountId ?? undefined;
                    }
                    console.log('[NextAuth Callbacks] JWT - Token populated from existing UserSettings due to outer catch.');
                  } else {
                     console.log('[NextAuth Callbacks] JWT - No existing UserSettings found for user after outer catch:', u.id);
                  }
                } catch (dbError: any) {
                  console.error('[NextAuth Callbacks] JWT - Error fetching existing UserSettings from DB after outer catch:', dbError.message || dbError);
                }
            }
          }
        }
      }
      
      if (account && account.provider !== 'deriv-credentials' && account.access_token) {
        extendedToken.accessToken = account.access_token;
      }
      if (account?.provider && !extendedToken.provider) {
        extendedToken.provider = account.provider;
      }

      console.log('[NextAuth Callbacks] JWT callback - after processing. Token contents:', {
        id: extendedToken.id,
        provider: extendedToken.provider,
        name: extendedToken.name,
        email: extendedToken.email,
        derivAccessTokenPresent: !!extendedToken.derivAccessToken, // Keep this for quick check
        derivAccountId: extendedToken.derivAccountId, // Main selected account ID
        derivDemoAccountId: extendedToken.derivDemoAccountId,
        derivDemoBalance: extendedToken.derivDemoBalance,
        derivRealAccountId: extendedToken.derivRealAccountId,
        derivRealBalance: extendedToken.derivRealBalance,
        selectedDerivAccountType: extendedToken.selectedDerivAccountType,
      });
      return extendedToken;
    },

    async session({ session, token }) {
      const extendedToken = token as ExtendedToken;
      // It's good practice to log less in production, but for dev this is fine.
      // console.log('[NextAuth Callbacks] Session callback - token received:', JSON.stringify(extendedToken, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2));

      if (session.user) {
        const sessionUser = session.user as any; // Cast to any to attach custom properties
        sessionUser.id = extendedToken.id;
        sessionUser.provider = extendedToken.provider;

        // Deriv related fields from token to session.user
        sessionUser.derivAccessToken = extendedToken.derivAccessToken; // The actual token for API calls
        if (extendedToken.derivAccessToken) { // Convenience structure for some parts of the app
            sessionUser.derivApiToken = { access_token: extendedToken.derivAccessToken };
        }
        sessionUser.derivAccountId = extendedToken.derivAccountId; // Currently selected/active Deriv account ID
        sessionUser.derivDemoAccountId = extendedToken.derivDemoAccountId;
        sessionUser.derivDemoBalance = extendedToken.derivDemoBalance;
        sessionUser.derivRealAccountId = extendedToken.derivRealAccountId;
        sessionUser.derivRealBalance = extendedToken.derivRealBalance;
        sessionUser.selectedDerivAccountType = extendedToken.selectedDerivAccountType;
      }
      
      // console.log('[NextAuth Callbacks] Session callback - session object to be returned:', JSON.stringify(session, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2));
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
