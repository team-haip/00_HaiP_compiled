import { redirect } from "next/navigation";
import { currentProject } from "@/lib/api";
import { providerStatus } from "@/lib/env";
import { Notice } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const p = await currentProject();
  if (!p) redirect("/onboarding");
  const s = providerStatus();
  return (
    <>
      {s.demo && (
        <Notice className="mb-6 border-amber-300 bg-amber-50 text-amber-900">
          <strong>Demo mode.</strong> No OpenAI / Gemini API key is configured, so monitoring returns labeled sample answers and content optimization is disabled. Add keys to <code>.env</code> and restart to run real API-based searches.
        </Notice>
      )}
      {!s.demo && (!s.openai || !s.gemini) && (
        <Notice className="mb-6">Only {s.openai ? "OpenAI" : "Gemini"} is configured; the other provider is skipped in monitoring runs.</Notice>
      )}
      {children}
    </>
  );
}
