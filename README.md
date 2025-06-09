# AI-Trading-Bot

## Authentication Setup

The following environment variables are required for authentication to function correctly. These should be placed in a `.env` file in the root of the project.

### General Authentication

-   **`DATABASE_URL`**:
    -   **Purpose**: Connection string for the Prisma database (stores user, account, session data).
    -   **Example**: `postgresql://user:password@host:port/database`
    -   **Configuration**: Set according to your database provider.

-   **`NEXTAUTH_URL`**:
    -   **Purpose**: The canonical URL of your application. Used by NextAuth for callbacks and security.
    -   **Example (Production)**: `https://www.yourapp.com`
    -   **Example (Development)**: `http://localhost:3000`
    -   **Configuration**: Your application's deployment URL. Explicitly set for production.

-   **`NEXTAUTH_SECRET`**:
    -   **Purpose**: A secret key for signing JWTs and other security tokens. Critical for security.
    -   **Configuration**: Generate a strong random string (e.g., `openssl rand -base64 32`).

### Google Sign-In (NextAuth GoogleProvider)

-   **`GOOGLE_CLIENT_ID`**:
    -   **Purpose**: Client ID for Google OAuth 2.0.
    -   **Configuration**: Obtain from Google Cloud Console (APIs & Services > Credentials). Ensure your app's domain and redirect URIs (e.g., `${NEXTAUTH_URL}/api/auth/callback/google`) are authorized.

-   **`GOOGLE_CLIENT_SECRET`**:
    -   **Purpose**: Client Secret for Google OAuth 2.0.
    -   **Configuration**: Obtain from Google Cloud Console alongside the Client ID. Keep this confidential.

### Deriv Login (Custom Deriv OAuth Flow)

-   **`NEXT_PUBLIC_DERIV_APP_ID`**:
    -   **Purpose**: Your application's ID registered with Deriv. Used for Deriv OAuth and WebSocket connections.
    -   **Configuration**: Obtain from your Deriv API/Developer portal settings. The `NEXT_PUBLIC_` prefix makes it available to the client-side.
