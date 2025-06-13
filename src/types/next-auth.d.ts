import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    // Fields returned by authorize or from DB user model that are used by JWT callback
    provider?: string;
    derivAccessToken?: string; // If returned by authorize for 'deriv-credentials'
  }

  interface Session {
    user: {
      id: string; // Ensure id is always string on session.user
      provider?: string;
      derivAccessToken?: string;
      derivApiToken?: { access_token: string };
      derivAccountId?: string | null;
      derivDemoAccountId?: string | null;
      derivRealAccountId?: string | null;
      derivDemoBalance?: number | null;
      derivRealBalance?: number | null;
      selectedDerivAccountType?: 'demo' | 'real' | null;
    } & DefaultSession["user"]; // DefaultSession["user"] provides name, email, image
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    // Fields added to the JWT token by the jwt callback
    id?: string;
    provider?: string;
    derivAccessToken?: string;
    derivAccountId?: string | null;
    derivDemoAccountId?: string | null;
    derivRealAccountId?: string | null;
    derivDemoBalance?: number | null;
    derivRealBalance?: number | null;
    selectedDerivAccountType?: 'demo' | 'real' | null;
    accessToken?: string; // For other OAuth provider's access token
  }
}

// Define and export ExtendedUser based on the Session.user structure
export interface ExtendedUser extends DefaultUser {
  id: string; // Explicitly ensure id is part of ExtendedUser
  provider?: string;
  derivAccessToken?: string;
  derivApiToken?: { access_token: string };
  derivAccountId?: string | null;
  derivDemoAccountId?: string | null;
  derivRealAccountId?: string | null;
  derivDemoBalance?: number | null;
  derivRealBalance?: number | null;
  selectedDerivAccountType?: 'demo' | 'real' | null;
  // Include other fields from DefaultUser if needed, like name, email, image
  // DefaultUser already includes name?: string | null; email?: string | null; image?: string | null;
}
