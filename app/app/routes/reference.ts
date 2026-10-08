import type { Route } from "./+types/reference";
import { renderDoc } from "~/content/parse";
import { readMarkdown } from "~/content/repo";

/** GET /reference/<references|learn>/<page>.md is a page's HTML for the panel beside a lesson. */
export async function loader({ params }: Route.LoaderArgs) {
  const file = params["*"] ?? "";
  const md = /^(references|learn)\/[\w-]+\.md$/.test(file) ? readMarkdown(file) : null;
  if (md === null) return new Response(null, { status: 404 });
  return Response.json(await renderDoc(md, file));
}
