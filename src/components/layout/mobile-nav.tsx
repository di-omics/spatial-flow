"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Grid3x3, ScanEye, LayoutGrid } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/command-center", label: "Command", icon: LayoutDashboard },
  { href: "/tma-planner", label: "TMA", icon: Grid3x3 },
  { href: "/imaging-qc", label: "QC", icon: ScanEye },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-2.5 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Logo className="size-7" />
        <span className="text-sm font-semibold">{APP_NAME}</span>
      </Link>
      <nav className="ml-auto flex items-center gap-1">
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
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
