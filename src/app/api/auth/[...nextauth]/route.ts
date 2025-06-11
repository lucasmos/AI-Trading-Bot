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
  derivAccountId?: string;
  derivDemoAccountId?: string;
  derivDemoBalance?: number;
  derivRealAccountId?: string;
  derivRealBalance?: number;
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

              const defaultAccount = accounts.find(acc => acc.is_default === 1);
              if (defaultAccount) {
                extendedToken.derivAccountId = defaultAccount.loginid;
              }

              const demoAccount = accounts.find(acc => acc.is_virtual === 1);
              if (demoAccount) {
                extendedToken.derivDemoAccountId = demoAccount.loginid;
                extendedToken.derivDemoBalance = parseFloat(demoAccount.balance);
                if (!extendedToken.derivAccountId && demoAccount.is_default === 1) {
                    extendedToken.derivAccountId = demoAccount.loginid;
                }
              }

              let realAccount = accounts.find(acc => acc.is_virtual === 0 && acc.is_default === 1);
              if (!realAccount) {
                realAccount = accounts.find(acc => acc.is_virtual === 0);
              }
              if (realAccount) {
                extendedToken.derivRealAccountId = realAccount.loginid;
                extendedToken.derivRealBalance = parseFloat(realAccount.balance);
                if (!extendedToken.derivAccountId) {
                    extendedToken.derivAccountId = realAccount.loginid;
                }
              }
              
              if (!extendedToken.derivAccountId) {
                if (extendedToken.derivRealAccountId) extendedToken.derivAccountId = extendedToken.derivRealAccountId;
                else if (extendedToken.derivDemoAccountId) extendedToken.derivAccountId = extendedToken.derivDemoAccountId;
              }
              console.log('[NextAuth Callbacks] JWT - Processed account list details.');
            } else {
              console.warn('[NextAuth Callbacks] JWT - Failed to fetch or parse Deriv account list response:', accountListResponse?.error?.message || 'No account_list found');
            }
          } catch (error: any) {
            console.error('[NextAuth Callbacks] JWT - Error fetching Deriv account list:', error.message || error);
            console.warn('[NextAuth Callbacks] JWT - Deriv account details could not be fetched due to the previous error. These details will be missing from the session token.');
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
        derivAccessTokenPresent: !!extendedToken.derivAccessToken,
        derivAccountId: extendedToken.derivAccountId,
        derivDemoAccountId: extendedToken.derivDemoAccountId,
        derivDemoBalance: extendedToken.derivDemoBalance,
        derivRealAccountId: extendedToken.derivRealAccountId,
        derivRealBalance: extendedToken.derivRealBalance,
      });
      return extendedToken;
    },

    async session({ session, token }) {
      const extendedToken = token as ExtendedToken;
      console.log('[NextAuth Callbacks] Session callback - before processing:', { 
        session: JSON.stringify(session, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2),
        token: JSON.stringify(extendedToken, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2)
      });

      if (session.user) {
        (session.user as any).id = extendedToken.id;
        (session.user as any).provider = extendedToken.provider;
        (session.user as any).derivAccessToken = extendedToken.derivAccessToken;
        if (extendedToken.derivAccessToken) {
            (session.user as any).derivApiToken = { access_token: extendedToken.derivAccessToken };
        }
        (session.user as any).derivAccountId = extendedToken.derivAccountId;
        (session.user as any).derivDemoAccountId = extendedToken.derivDemoAccountId;
        (session.user as any).derivDemoBalance = extendedToken.derivDemoBalance;
        (session.user as any).derivRealAccountId = extendedToken.derivRealAccountId;
        (session.user as any).derivRealBalance = extendedToken.derivRealBalance;
      }
      
      console.log('[NextAuth Callbacks] Session callback - after processing:', JSON.stringify(session, (key, value) => key === 'derivAccessToken' && value ? '******' : value, 2));
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
