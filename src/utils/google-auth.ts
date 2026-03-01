import { GoogleAuth } from "google-auth-library";
import type { AppConfig } from "../../config.js";

let authClient: GoogleAuth | null = null;

export function getGoogleAuth(config: AppConfig, scopes: string[]): GoogleAuth {
  if (authClient) return authClient;

  if (!config.googleServiceAccountEmail || !config.googleServiceAccountKey) {
    throw new Error("Google service account credentials not configured");
  }

  authClient = new GoogleAuth({
    credentials: {
      client_email: config.googleServiceAccountEmail,
      private_key: config.googleServiceAccountKey.replace(/\\n/g, "\n"),
    },
    scopes,
  });

  return authClient;
}

export async function getGoogleAccessToken(config: AppConfig, scopes: string[]): Promise<string> {
  const auth = getGoogleAuth(config, scopes);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Failed to get Google access token");
  return tokenResponse.token;
}
