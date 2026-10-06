import { Link, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/labs";
import { mdSection, renderDoc, untitled } from "~/content/parse";
import { listLabs, readMarkdown } from "~/content/repo";
import { Markdown } from "~/components/Markdown";
import { PrepareLab } from "~/components/PrepareLab";
import type { loader as rootLoader } from "~/root";
import { pretty } from "~/root";

const INDEX = "lab/labs/README.md";

export async function loader() {
  const md = readMarkdown(INDEX)!;
  const intro = untitled(md.split(/^## /m)[0]);
  const labs = await Promise.all(
    listLabs().map(async (l) => ({ name: l.name, html: (await renderDoc(untitled(l.md), `lab/labs/${l.name}/README.md`)).html })),
  );
  return {
    introHtml: (await renderDoc(intro, INDEX)).html,
    machinesHtml: (await renderDoc(mdSection(md, "Machines"), INDEX)).html,
    labs,
  };
}

export const meta = () => [{ title: "Labs · CKA Prep" }];

export default function Labs({ loaderData }: Route.ComponentProps) {
  const { domains, lab: state } = useRouteLoaderData<typeof rootLoader>("root")!;
  const topics = domains.flatMap((d) => d.topics).filter((t) => t.progress);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Labs</h1>
      <Markdown html={loaderData.introHtml} className="mt-4" />
      <ul className="mt-8 space-y-6">
        {loaderData.labs.map((l) => {
          const users = topics.filter((t) => "lab" in t && t.lab === l.name);
          const running = state.status === "running" && state.lab === l.name;
          return (
            <li key={l.name} id={l.name} className="scroll-mt-6">
              <h2 className="flex items-center gap-3 text-xl font-bold">
                <span className="font-mono">{l.name}</span>
                {running && <span className="rounded bg-done px-2 py-0.5 text-xs font-semibold text-paper">Running</span>}
              </h2>
              <Markdown html={l.html} className="mt-2" />
              {users.length > 0 && (
                <p className="mt-2 text-sm text-muted">
                  Used by{" "}
                  {users.map((t, i) => (
                    <span key={t.id}>
                      {i > 0 && ", "}
                      <Link to={`/t/${t.id}?tab=lab`} className="text-accent hover:underline">{pretty(t.topic)}</Link>
                    </span>
                  ))}
                  .
                </p>
              )}
              <div className="mt-3">
                <PrepareLab lab={l.name} terminal={users[0] ? `/t/${users[0].id}?tab=lab&terminal=1` : null} />
              </div>
            </li>
          );
        })}
      </ul>
      <h2 className="mt-12 mb-4 border-b border-line pb-2 text-2xl font-bold">Machines</h2>
      <Markdown html={loaderData.machinesHtml} />
    </div>
  );
}

export { Problem as ErrorBoundary } from "~/root";
