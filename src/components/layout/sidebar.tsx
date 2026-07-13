"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Grid3x3, ScanEye, LayoutGrid } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/command-center", label: "Command Center", icon: LayoutDashboard },
  { href: "/tma-planner", label: "TMA Planner", icon: Grid3x3 },
  { href: "/imaging-qc", label: "Imaging QC", icon: ScanEye },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card/60 px-3 py-5 backdrop-blur lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <Logo />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
          <div className="text-[11px] text-muted-foreground">Lab Operations</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">Synthetic environment</div>
        All specimens, images and metrics on this instance are procedurally
        generated for demonstration.
      </div>
    </aside>
  );
}
