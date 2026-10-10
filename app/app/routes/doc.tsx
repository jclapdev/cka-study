import { data } from "react-router";
import type { Route } from "./+types/doc";
import { renderDoc } from "~/content/parse";
import { readMarkdown } from "~/content/repo";
import { Markdown } from "~/components/Markdown";
import { useReferences } from "~/components/ReferencePanel";
import { Pane } from "~/components/Pane";
import { Split } from "~/components/Split";

export async function loader({ params }: Route.LoaderArgs) {
  const file = params["*"] ?? "";
  const md = readMarkdown(file);
  if (md === null) throw data(null, { status: 404 });
  return renderDoc(md, file);
}

export const meta = ({ loaderData }: Route.MetaArgs) => [{ title: `${loaderData?.title ?? "Doc"} · CKA Prep` }];

export default function Doc({ loaderData, params }: Route.ComponentProps) {
  const refs = useReferences(params["*"] ?? "", true);
  const page = (
    <article onClick={refs.onClick} className="mx-auto max-w-3xl">
      <Markdown html={loaderData.html} />
    </article>
  );
  if (!refs.open) return page;
  return <Split left={page} right={<Pane terminals={false} reference={refs.reference} />} place={refs.place} label="Resize page and reference" />;
}

export { Problem as ErrorBoundary } from "~/root";
