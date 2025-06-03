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
            return { id: user.id, email: user.email, name: user.name, image: user.image };
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