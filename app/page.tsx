import Link from "next/link";
import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/inbox");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--color-paper)]">
      <div className="max-w-lg text-center space-y-8">
        <p className="text-sm tracking-widest uppercase text-[var(--color-slate)]">Signal</p>
        <h1 className="font-display text-4xl md:text-5xl leading-tight text-[var(--color-ink)]">
          Your inbox, finally legible.
        </h1>
        <p className="text-lg text-[var(--color-slate)] leading-relaxed">
          AI that reads every thread so you don&apos;t have to — and shows its sources every time.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/inbox" });
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-signal)] text-white rounded-md hover:opacity-90 transition-opacity font-medium"
          >
            Connect Gmail →
          </button>
        </form>
        <p className="text-sm text-[var(--color-slate)]">
          Read-only by default. Nothing leaves your inbox without you.
        </p>
      </div>
    </main>
  );
}
