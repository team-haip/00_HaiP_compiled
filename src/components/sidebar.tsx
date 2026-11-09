"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Eye, Link2, FileText, Bot, Settings, Radar, Code2 } from "lucide-react";
import { cn } from "cn";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/visibility", label: "AI Visibility", icon: Eye },
  { href: "/citations", label: "Citation Analytics", icon: Link2 },
  { href: "/optimization", label: "Content Optimization", icon: FileText },
  { href: "/agents", label: "Agent Runs", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "API Docs", icon: Code2 },
];

export function Sidebar() {
  const path = usePathname();
  if (path === "/onboarding") return null;
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-white hidden md:flex flex-col">
      <div className="h-14 flex items-center gap-2 px-5 border-b border-border">
        <Radar className="size-5" />
        <span className="font-semibold text-sm">GEO Agent</span>
      </div>
      <nav className="p-3 space-y-0.5">
        {nav.map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "bg-muted text-foreground font-medium",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 text-[11px] leading-relaxed text-muted-foreground border-t border-border">
        Visibility figures are <span className="font-medium">API-based AI Search Visibility</span>, not consumer ChatGPT / Gemini impressions.
      </div>
    </aside>
  );
}
