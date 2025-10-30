"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { AuthGuard } from "@/components/AuthGuard";

const PUBLIC_ROUTES = new Set(["/login"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.has(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <NavBar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16 pt-10">
        {children}
      </main>
    </AuthGuard>
  );
}
