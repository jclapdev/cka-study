import { useEffect, useState } from "react";
import { isRouteErrorResponse, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";
import type { Route } from "./+types/root";
import { overview } from "./db/progress";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
  },
];

export const meta: Route.MetaFunction = () => [{ title: "CKA Prep" }];

export async function loader() {
  return { domains: overview() };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const NAMES: Record<string, string> = {
  rbac: "RBAC", crds: "CRDs", ha: "HA", pv: "PV", pvc: "PVC", api: "API", coredns: "CoreDNS",
  etcd: "etcd", kubeadm: "kubeadm", configmaps: "ConfigMaps", storageclasses: "StorageClasses",
};

export const pretty = (folder: string) => {
  const s = folder.replace(/^\d\d-/, "").replace(/-/g, " ").replace(/\b\w+\b/g, (w) => NAMES[w] ?? w);
  return s[0].toUpperCase() + s.slice(1);
};

export default function App({ loaderData }: Route.ComponentProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:grid lg:grid-cols-[17rem_1fr]">
      <nav className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <NavLink to="/" className="text-lg font-bold">
            CKA Prep
          </NavLink>
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="topics"
            className="rounded border border-line px-3 py-1 text-sm lg:hidden"
          >
            {open ? "Close" : "Topics"}
          </button>
        </div>
        <ul id="topics" className={`space-y-5 px-3 pb-6 lg:block ${open ? "block" : "hidden"}`}>
          <li>
            <ul>
              {[
                ["/doc/lab/README.md", "Lab"],
                ["/doc/EXAM.md", "Exam"],
                ["/doc/references/README.md", "References"],
              ].map(([to, label]) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) => `block rounded px-2 py-1.5 hover:bg-paper ${isActive ? "bg-paper font-semibold" : ""}`}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
            {loaderData.domains.map((d) => (
              <li key={d.name}>
                <p className="flex justify-between px-2 pb-1 text-sm font-semibold text-muted">
                  <span>{pretty(d.name)}</span>
                  {d.weight !== null && <span>{d.weight}%</span>}
                </p>
                <ul>
                  {d.topics.map((t) => (
                    <li key={t.id}>
                      {t.progress ? (
                        <NavLink
                          to={`/t/${t.id}`}
                          className={({ isActive }) =>
                            `block rounded px-2 py-1.5 text-[0.95rem] hover:bg-paper ${isActive ? "bg-paper font-semibold" : ""}`
                          }
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            {pretty(t.topic)}
                            {t.progress.missed > 0 && (
                              <span className="text-xs text-missed" title="Quiz questions you missed">
                                {t.progress.missed} missed
                              </span>
                            )}
                          </span>
                          <Meter done={t.progress.stepsDone} total={t.progress.steps} />
                        </NavLink>
                      ) : (
                        <span className="block px-2 py-1 text-[0.95rem] text-muted/70" title="Coming soon">
                          {pretty(t.topic)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      </nav>
      <main className="min-w-0 px-4 py-8 sm:px-10">
        <Outlet />
      </main>
    </div>
  );
}

export function Meter({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  return (
    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line" title={`${done} of ${total} steps done`}>
      <span className="block h-full bg-done" style={{ width: `${(done / total) * 100}%` }} />
    </span>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-bold">{notFound ? "No such page" : "Something went wrong"}</h1>
      <p className="mt-2 text-muted">
        {notFound ? "Page not found." : error instanceof Error ? error.message : String(error)}
      </p>
      <a href="/" className="mt-4 inline-block text-accent underline">
        Back to dashboard
      </a>
    </main>
  );
}
