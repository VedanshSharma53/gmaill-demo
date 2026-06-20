import { signIn } from "@/auth";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Sign-in was blocked. Most often this means the Supabase database tables haven't been created yet — run supabase/migrations/001_initial_schema.sql in your Supabase SQL Editor, then try again.",
  Configuration:
    "Server misconfiguration — check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and Supabase env vars in .env.local.",
  OAuthSignin: "Couldn't start Google sign-in — check your OAuth credentials.",
  OAuthCallback: "Google returned an error — verify the redirect URI is http://localhost:3000/api/auth/callback/google in Google Cloud Console.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] ?? `Sign-in failed (${error}). Check the terminal logs.` : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <Link href="/" className="text-sm text-[var(--color-slate)] hover:text-[var(--color-ink)]">
          ← Signal
        </Link>
        <h1 className="font-display text-3xl">Connect your Gmail</h1>
        <p className="text-[var(--color-slate)]">
          Sign in with Google to sync your inbox and enable AI features.
        </p>

        {message && (
          <div className="text-left p-4 rounded-md border border-red-200 bg-red-50 text-sm text-red-800">
            {message}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/inbox" });
          }}
        >
          <button
            type="submit"
            className="w-full px-6 py-3 bg-[var(--color-signal)] text-white rounded-md font-medium"
          >
            Connect Gmail
          </button>
        </form>
      </div>
    </main>
  );
}
