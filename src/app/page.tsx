import { redirect } from "next/navigation";
import { currentProject } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const p = await currentProject();
  redirect(p ? "/dashboard" : "/onboarding");
}
