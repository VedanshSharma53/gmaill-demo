import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/lib/crypto";

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiry: Date;
}

export async function getGmailTokensForUser(
  userId: string
): Promise<GmailTokens | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("gmail_accounts")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  let accessToken = decrypt(data.access_token_encrypted);
  const refreshToken = decrypt(data.refresh_token_encrypted);
  let expiry = new Date(data.token_expiry);

  if (expiry.getTime() - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.accessToken;
    expiry = refreshed.expiry;

    await supabase
      .from("gmail_accounts")
      .update({
        access_token_encrypted: encrypt(accessToken),
        token_expiry: expiry.toISOString(),
      })
      .eq("user_id", userId);
  }

  return { accessToken, refreshToken, expiry };
}

async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Gmail access token");
  }

  const expiry = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  return { accessToken: credentials.access_token, expiry };
}

export async function getGmailClient(userId: string) {
  const tokens = await getGmailTokensForUser(userId);
  if (!tokens) throw new Error("Gmail account not connected");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
