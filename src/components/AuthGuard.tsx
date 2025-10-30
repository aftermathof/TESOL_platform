"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

const PUBLIC_ROUTES = new Set(["/login"]);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (!loading && !session && !isPublic) {
      const redirectTo = pathname === "/" ? "" : `?redirect=${encodeURIComponent(pathname)}`;
      router.replace(`/login${redirectTo}`);
    }
  }, [loading, session, isPublic, pathname, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (loading || (!session && typeof window !== "undefined")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
