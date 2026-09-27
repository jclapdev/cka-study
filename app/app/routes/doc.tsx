import { data } from "react-router";
import type { Route } from "./+types/doc";
import { renderDoc } from "~/content/parse";
import { readMarkdown } from "~/content/repo";
import { Markdown } from "~/components/Markdown";

export async function loader({ params }: Route.LoaderArgs) {
  const file = params["*"] ?? "";
  const md = readMarkdown(file);
  if (md === null) throw data(null, { status: 404 });
  return renderDoc(md, file);
}

export const meta = ({ loaderData }: Route.MetaArgs) => [{ title: `${loaderData?.title ?? "Doc"} · CKA study` }];

export default function Doc({ loaderData }: Route.ComponentProps) {
  return (
    <article className="mx-auto max-w-3xl">
      <Markdown html={loaderData.html} />
    </article>
  );
}
