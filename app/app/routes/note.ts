import { data } from "react-router";
import type { Route } from "./+types/note";
import { topicReadme } from "~/content/repo";
import { setNote } from "~/db/progress";
import { fromApp } from "~/request.server";

/** POST /note/<domain>/<topic> with `body` saves the topic's notes. */
export async function action({ params, request }: Route.ActionArgs) {
  if (!fromApp(request)) throw data("Forbidden", { status: 403 });
  if (!topicReadme(params.domain, params.topic)) throw data(null, { status: 404 });
  setNote(`${params.domain}/${params.topic}`, String((await request.formData()).get("body") ?? ""));
  return new Response(null, { status: 204 });
}
