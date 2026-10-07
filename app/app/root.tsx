import { useEffect, useState } from "react";
import { isRouteErrorResponse, Link, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useLocation, useRevalidator, useRouteError } from "react-router";
import type { Route } from "./+types/root";
import { lessonHref } from "./content/links";
import { overview } from "./db/progress";
import { labState, type LabState } from "./lab/state.server";
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
  return { domains: overview(), lab: await labState() };
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

const CHEAT_SHEET = "https://kubernetes.io/docs/reference/kubectl/quick-reference/";

const navItem = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-2 py-1.5 hover:bg-paper ${isActive ? "bg-paper font-semibold" : ""}`;

export default function App({ loaderData }: Route.ComponentProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem("sidebar") === "hidden"); } catch {}
  }, []);
  const toggleSidebar = () => {
    setHidden(!hidden);
    try { localStorage.setItem("sidebar", hidden ? "shown" : "hidden"); } catch {}
  };
  // A lab started from another page or tab keeps every page's lab status current until it is ready.
  const revalidator = useRevalidator();
  const starting = loaderData.lab.status === "starting";
  useEffect(() => {
    if (!starting) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 3000);
    return () => clearInterval(t);
  }, [starting, revalidator]);
  return (
    <div className={hidden ? "" : "lg:grid lg:grid-cols-[17rem_1fr]"}>
      {hidden && (
        <button onClick={toggleSidebar} aria-label="Show sidebar" title="Show sidebar" className="fixed left-3 top-3 z-20 hidden rounded border border-line bg-surface p-1.5 hover:bg-paper lg:block">
          <SidebarIcon />
        </button>
      )}
      <nav className={`border-b border-line bg-surface lg:sticky ${hidden ? "lg:hidden" : ""} lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r`}>
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
          <button onClick={toggleSidebar} aria-label="Hide sidebar" title="Hide sidebar" className="hidden rounded p-1.5 text-muted hover:bg-paper lg:block">
            <SidebarIcon />
          </button>
        </div>
        <ul id="topics" className={`space-y-5 px-3 pb-6 lg:block ${open ? "block" : "hidden"}`}>
          <li className="space-y-1">
            <NavLink to="/" end className={navItem}>
              Dashboard
            </NavLink>
            <LabIndicator s={loaderData.lab} />
          </li>
            {loaderData.domains.map((d) => (
              <li key={d.name}>
                <p className="flex justify-between px-2 pb-1 text-sm font-semibold text-muted">
                  <span>{d.name}</span>
                  {d.weight !== null && <span>{d.weight}%</span>}
                </p>
                {d.topics.length === 0 && <p className="px-2 py-1 text-[0.95rem] text-muted">Coming soon</p>}
                <ul>
                  {d.topics.map((t) => (
                    <li key={t.id}>
                      {t.progress ? (
                        <>
                        <NavLink
                          to={`/t/${t.id}`}
                          className={({ isActive }) =>
                            `block rounded px-2 py-1.5 text-[0.95rem] hover:bg-paper ${isActive ? "bg-paper font-semibold" : ""}`
                          }
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            {t.name}
                            {t.progress.missed > 0 && (
                              <span className="text-xs text-missed" title="Quiz questions you missed">
                                {t.progress.missed} missed
                              </span>
                            )}
                          </span>
                          <Meter done={t.progress.stepsDone} total={t.progress.steps} />
                        </NavLink>
                        {"lessons" in t && pathname.startsWith(`/t/${t.id}`) && (
                          <ul aria-label="Lessons" className="mb-2 ml-3 mt-1 border-l border-line pl-2">
                            {t.lessons.map((l) => (
                              <li key={l.slug}>
                                <NavLink
                                  to={lessonHref(t.id, l.slug)}
                                  end
                                  className={({ isActive }) =>
                                    `flex items-baseline justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-paper ${isActive ? "bg-paper font-semibold" : "text-muted"}`
                                  }
                                >
                                  {l.title}
                                  {l.steps > 0 && l.done === l.steps && (
                                    <span className="text-done" title="All steps done">✓</span>
                                  )}
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        )}
                        </>
                      ) : (
                        <span className="block px-2 py-1 text-[0.95rem] text-muted" title="Coming soon">
                          {t.name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          <li className="border-t border-line pt-4">
            <ul>
              {[
                ["/doc/lab/README.md", "Getting started"],
                ["/labs", "Labs"],
                ["/doc/EXAM.md", "Exam guide"],
                ["/doc/references/README.md", "References"],
              ].map(([to, label]) => (
                <li key={to}>
                  <NavLink to={to} className={navItem}>
                    {label}
                  </NavLink>
                </li>
              ))}
              <li>
                <a href={CHEAT_SHEET} target="_blank" rel="noreferrer" className="block rounded px-2 py-1.5 hover:bg-paper">
                  kubectl cheat sheet ↗
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
      <main className="min-w-0 px-4 py-8 sm:px-10">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <path d="M7.5 3.5v13" />
    </svg>
  );
}

const LAB_TEXT: Record<LabState["status"], [string, (lab: string | null) => string]> = {
  running: ["bg-done", (l) => `${l} lab running`],
  starting: ["bg-accent animate-pulse", (l) => `Starting the ${l} lab`],
  failed: ["bg-missed", (l) => `The ${l} lab failed to start`],
  stopped: ["bg-line", () => "No lab running"],
  none: ["bg-line", () => "No lab running"],
  unavailable: ["bg-missed", () => "Docker is not running"],
};

/** One line under Dashboard saying what the machines are doing, linking the Labs page. */
function LabIndicator({ s }: { s: LabState }) {
  const [dot, text] = LAB_TEXT[s.status];
  return (
    <NavLink to="/labs" className={({ isActive }) => `flex items-center gap-2 rounded px-2 py-1 text-sm text-muted hover:bg-paper ${isActive ? "bg-paper" : ""}`}>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
      {text(s.lab)}
    </NavLink>
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

/** The error page. Each route uses it so the topic list stays beside it; root uses it when the layout itself fails. */
export function Problem() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  useEffect(() => {
    if (!notFound) console.error(error);
  }, [error, notFound]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{notFound ? "Page not found" : "Something went wrong"}</h1>
      {!notFound && <p className="mt-2 text-muted">Reload the page to try again.</p>}
      <Link to="/" className="mt-4 inline-block text-accent underline">
        Back to dashboard
      </Link>
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <main className="p-10">
      <Problem />
    </main>
  );
}
