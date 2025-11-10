"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/components/AuthProvider";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/learning", label: "Learning" },
  { href: "/quiz", label: "Assessments" },
  { href: "/certificates", label: "Certificates" },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-sky-500">
            TESOL Platform
          </p>
          <h1 className="text-lg font-semibold text-zinc-900">
            51Talk · Integrated Learning & Certification
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-2">
            {links.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === link.href
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[rgb(0,102,255)] text-white hover:text-white focus:text-white active:text-white shadow-sm"
                      : "text-zinc-600 hover:bg-[rgb(0,102,255)]/10 hover:text-[rgb(0,102,255)]"
                  )}
                  style={isActive ? { color: "#ffffff" } : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {user && (
            <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs text-zinc-600 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                {user.user_metadata?.full_name
                  ? String(user.user_metadata.full_name).slice(0, 1)
                  : user.email?.slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden flex-col leading-tight md:flex">
                <span className="font-semibold text-zinc-800">
                  {user.user_metadata?.full_name ?? user.email}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                  Teacher
                </span>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-zinc-700"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
