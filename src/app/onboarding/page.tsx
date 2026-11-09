"use client";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProjectForm } from "@/components/project-form";
import { post } from "@/components/ui-bits";

export default function Onboarding() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="flex items-center gap-2 mb-6">
        <Radar className="size-5" />
        <span className="font-semibold">GEO Agent</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Register your project</CardTitle>
          <CardDescription>Tell the agent which brand to monitor, who the competitors are, and which search prompts matter.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            submitLabel="Create project"
            onSubmit={async (v) => {
              await post("/api/projects", v);
              router.push("/dashboard");
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
