import type { Route } from "./+types/reference";
import { renderDoc } from "~/content/parse";
import { readMarkdown } from "~/content/repo";

/** GET /reference/<file> is a reference page's HTML for the panel beside a lesson. */
export async function loader({ params }: Route.LoaderArgs) {
  const file = `references/${params["*"]}`;
  const md = readMarkdown(file);
  if (md === null) return new Response(null, { status: 404 });
  return Response.json(await renderDoc(md, file));
}
