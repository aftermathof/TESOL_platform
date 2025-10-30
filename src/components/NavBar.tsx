"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "仪表盘" },
  { href: "/learning", label: "学习模块" },
  { href: "/quiz", label: "测验中心" },
  { href: "/certificates", label: "证书" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-sky-500">
            TESOL Platform
          </p>
          <h1 className="text-lg font-semibold text-zinc-900">
            51Talk 外教学习与考证一体化平台
          </h1>
        </div>
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
                    ? "bg-[rgb(0,102,255)] text-white hover:text-white focus:text-white active:text-white visited:text-white shadow-sm"
                    : "text-zinc-600 hover:bg-[rgb(0,102,255)]/10 hover:text-[rgb(0,102,255)]"
                )}
                style={isActive ? { color: "#ffffff" } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
