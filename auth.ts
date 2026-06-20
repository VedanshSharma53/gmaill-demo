import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createServiceClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GMAIL_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      try {
        if (!account?.access_token) {
          console.error("[auth] Missing access_token from Google");
          return false;
        }

        if (!account.refresh_token) {
          console.error(
            "[auth] Missing refresh_token — revoke app access at https://myaccount.google.com/permissions and sign in again"
          );
          return false;
        }

        if (!profile?.email) {
          console.error("[auth] Missing email in Google profile");
          return false;
        }

        const supabase = createServiceClient();
        const email = profile.email;
        const fullName = profile.name ?? null;
        const avatarUrl = profile.picture ?? null;

        const { data: existingUser, error: lookupError } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (lookupError) {
          console.error("[auth] Supabase lookup failed:", lookupError.message);
          return false;
        }

        let userId = existingUser?.id;

        if (!userId) {
          const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert({ email, full_name: fullName, avatar_url: avatarUrl })
            .select("id")
            .single();

          if (insertError || !newUser) {
            console.error(
              "[auth] Failed to create user:",
              insertError?.message ?? "unknown error"
            );
            return false;
          }
          userId = newUser.id;
        } else {
          await supabase
            .from("users")
            .update({ full_name: fullName, avatar_url: avatarUrl })
            .eq("id", userId);
        }

        const tokenExpiry = account.expires_at
          ? new Date(account.expires_at * 1000).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString();

        const { error: gmailError } = await supabase
          .from("gmail_accounts")
          .upsert(
            {
              user_id: userId,
              gmail_address: email,
              access_token_encrypted: encrypt(account.access_token),
              refresh_token_encrypted: encrypt(account.refresh_token),
              token_expiry: tokenExpiry,
              scopes: GMAIL_SCOPES,
              sync_status: "idle",
            },
            { onConflict: "user_id" }
          );

        if (gmailError) {
          console.error("[auth] Failed to save Gmail tokens:", gmailError.message);
          return false;
        }

        return true;
      } catch (error) {
        console.error("[auth] signIn callback error:", error);
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session }) {
      if (session.user?.email) {
        const supabase = createServiceClient();
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("email", session.user.email)
          .single();

        if (user) {
          session.user.id = user.id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
});
