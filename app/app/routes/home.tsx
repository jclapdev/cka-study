import { Link, useRouteLoaderData } from "react-router";
import { PASS_MARK } from "~/content/links";
import type { loader as rootLoader } from "~/root";
import { Meter } from "~/root";

type Data = Awaited<ReturnType<typeof rootLoader>>;
type Topic = Data["domains"][number]["topics"][number];
const missed = (t: Topic) => (t.progress?.recall ? `${t.progress.missed} of ${t.progress.recall}` : "");
const score = (t: Topic) =>
  t.progress?.bestScore != null ? `${t.progress.bestScore}%` : t.progress?.hasPractice ? "Not attempted" : "";
/** A topic is finished when every one of its lessons has its tick. */
const finished = (t: Topic) => !!t.progress?.lessons && t.progress.lessonsDone === t.progress.lessons;

export const meta = () => [{ title: "Dashboard · CKA Prep" }];

export default function Home() {
  const { domains, last } = useRouteLoaderData<typeof rootLoader>("root")!;
  const written = domains.flatMap((d) => d.topics).filter((t) => t.progress);
  // Continue returns to the lesson opened last; before any, it starts the first unfinished topic.
  const first = written.find((t) => !finished(t)) ?? written[0];
  const next = last ? written.find((t) => t.id === last.topic) : first;
  const href = last?.href ?? (first ? `/t/${first.id}` : "/");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
      <p className="mt-3 text-muted">
        You have finished {written.filter(finished).length} of {written.length} available topics.
      </p>

      {next && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">Continue</h2>
          <div className="rounded-md border border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm text-muted">{domains.find((d) => d.topics.includes(next))?.name}</p>
                <p className="text-lg font-semibold">{next.name}</p>
                {last?.title && <p className="text-sm text-muted">{last.title}</p>}
                <span className="mt-1 flex items-center gap-3 text-sm tabular-nums text-muted">
                  <span className="w-40"><Meter done={next.progress!.lessonsDone} total={next.progress!.lessons} /></span>
                  {next.progress!.lessonsDone} of {next.progress!.lessons} lessons
                </span>
              </div>
              <Link to={href} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90">
                Continue
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold">Domains</h2>
        <ul className="mt-4 space-y-4">
          {domains
            .filter((d) => d.weight !== null)
            .map((d) => {
              // Only topics with a practice exam have a score to average.
              const scores = d.topics.filter((t) => t.progress?.hasPractice).map((t) => t.progress?.bestScore ?? 0);
              const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
              const done = d.topics.filter(finished).length;
              const available = d.topics.some((t) => t.progress);
              return (
                <li key={d.name}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                    <span className="font-semibold">
                      {d.name} <span className="font-normal text-muted">{d.weight}% of the exam</span>
                    </span>
                    <span className="tabular-nums text-muted">
                      {!available ? "Coming soon" : <>{done} of {d.topics.length} topics finished</>}
                      {scores.length > 0 && <> · practice average {avg}% · pass mark {PASS_MARK}%</>}
                    </span>
                  </div>
                  {/* The bar is the practice average, so it shows once a topic here has a practice exam. */}
                  {scores.length > 0 && (
                    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-line" title={`Practice average ${avg}%`}>
                      <span className={`block h-full rounded-full ${avg >= PASS_MARK ? "bg-done" : "bg-accent"}`} style={{ width: `${avg}%` }} />
                    </span>
                  )}
                </li>
              );
            })}
        </ul>
      </section>

      <div className="mt-10 overflow-x-auto">
        <h2 className="text-xl font-bold">Topics</h2>
        <table className="w-full text-left sm:min-w-[36rem]">
          <thead className="text-sm text-muted">
            <tr>
              <th className="py-2 font-normal">Topic</th>
              <th className="w-28 py-2 font-normal sm:w-44">Lessons done</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Quiz missed</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Best score</th>
            </tr>
          </thead>
          {domains.map((d) => (
            <tbody key={d.name}>
              <tr>
                <th colSpan={4} className="pt-6 pb-2 text-left font-bold">
                  {d.name} {d.weight !== null && <span className="font-normal text-muted">{d.weight}% of the exam</span>}
                </th>
              </tr>
              {d.topics.filter((t) => t.progress).map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-2">
                    <Link to={`/t/${t.id}`} className="hover:text-accent hover:underline">
                      {t.name}
                    </Link>
                    {(missed(t) || score(t)) && (
                      <span className="mt-0.5 block text-sm text-muted sm:hidden">
                        {[missed(t) && `Quiz missed ${missed(t)}`, score(t) && `Best score ${score(t)}`].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-3 text-sm tabular-nums">
                      <span className="flex-1"><Meter done={t.progress!.lessonsDone} total={t.progress!.lessons} /></span>
                      {t.progress!.lessonsDone} of {t.progress!.lessons}
                    </span>
                  </td>
                  <td className={`hidden py-2 text-right tabular-nums sm:table-cell ${t.progress?.missed ? "text-missed" : "text-muted"}`}>
                    {missed(t)}
                  </td>
                  <td className={`hidden py-2 text-right tabular-nums sm:table-cell ${t.progress?.bestScore != null ? "" : "text-muted"}`}>
                    {score(t)}
                  </td>
                </tr>
              ))}
              {d.topics.some((t) => !t.progress) && (
                <tr className="border-t border-line">
                  <td colSpan={4} className="py-2 text-sm text-muted">
                    Coming soon: {d.topics.filter((t) => !t.progress).map((t) => t.name).join(", ")}
                  </td>
                </tr>
              )}
              {d.topics.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={4} className="py-2 text-sm text-muted">Coming soon</td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export { Problem as ErrorBoundary } from "~/root";
