import { GoogleAuth } from "google-auth-library";
import type { AppConfig } from "../../config.js";

const authClients = new Map<string, GoogleAuth>();

export function getGoogleAuth(config: AppConfig, scopes: string[]): GoogleAuth {
  const key = scopes.sort().join(",");
  const existing = authClients.get(key);
  if (existing) return existing;

  if (!config.googleServiceAccountEmail || !config.googleServiceAccountKey) {
    throw new Error("Google service account credentials not configured");
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: config.googleServiceAccountEmail,
      private_key: config.googleServiceAccountKey.replace(/\\n/g, "\n"),
    },
    scopes,
  });

  authClients.set(key, auth);
  return auth;
}

export async function getGoogleAccessToken(config: AppConfig, scopes: string[]): Promise<string> {
  const auth = getGoogleAuth(config, scopes);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Failed to get Google access token");
  return tokenResponse.token;
}
