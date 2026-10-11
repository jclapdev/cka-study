import { data } from "react-router";
import type { Route } from "./+types/lab";
import { listLabs } from "~/content/repo";
import { endPracticeRuns } from "~/db/progress";
import { BusyError, labController } from "~/lab/controller";
import { fromApp } from "~/request.server";

/**
 * POST /lab/<lab> with the topic starting it: recreates the machines as that lab, which ends any lab
 * and practice exam that was running. Answers once the start is under way; every page learns how it
 * went from ws://<dev server>/events.
 */
export async function action({ params, request }: Route.ActionArgs) {
  if (!fromApp(request)) throw data("Forbidden", { status: 403 });
  const topic = String((await request.formData()).get("topic") ?? "");
  if (!listLabs().includes(params.lab) || !topic) throw data(`No lab named ${params.lab}`, { status: 400 });
  try {
    labController().start(topic, params.lab);
  } catch (e) {
    if (e instanceof BusyError) return new Response(e.message, { status: 409 });
    throw e;
  }
  endPracticeRuns();
  return new Response(null, { status: 202 });
}
