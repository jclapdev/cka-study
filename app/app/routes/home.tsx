import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { Meter } from "~/root";
import { PrepareLab } from "~/components/PrepareLab";

type Data = Awaited<ReturnType<typeof rootLoader>>;
type Topic = Data["domains"][number]["topics"][number];
const missed = (t: Topic) => (t.progress?.recall ? `${t.progress.missed} of ${t.progress.recall}` : "");
const score = (t: Topic) =>
  t.progress?.bestScore != null ? `${t.progress.bestScore}%` : t.progress?.hasPractice ? "Not attempted" : "";
const PASS = 66;

export default function Home() {
  const { domains, lab } = useRouteLoaderData<typeof rootLoader>("root")!;
  const written = domains.flatMap((d) => d.topics).filter((t) => t.progress);
  const next = written.find((t) => t.progress!.stepsDone < t.progress!.steps) ?? written[0];
  const finished = written.filter((t) => t.progress!.steps && t.progress!.stepsDone === t.progress!.steps).length;
  // The terminal opens beside the next topic that uses the running lab.
  const nextLab = next && "lab" in next ? next.lab : null;
  const labTopic = lab.lab === nextLab ? next : written.find((t) => "lab" in t && t.lab === lab.lab);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
      <p className="mt-3 text-muted">
        You have finished {finished} of {written.length} available topics.
      </p>

      {next && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">Continue</h2>
          <div className="rounded-md border border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm text-muted">{domains.find((d) => d.topics.includes(next))?.name}</p>
                <p className="text-lg font-semibold">{next.name}</p>
                <span className="mt-1 flex items-center gap-3 text-sm tabular-nums text-muted">
                  <span className="w-40"><Meter done={next.progress!.stepsDone} total={next.progress!.steps} /></span>
                  {next.progress!.stepsDone} of {next.progress!.steps} steps
                </span>
              </div>
              <Link to={`/t/${next.id}`} className="rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90">
                Continue
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Lab</h2>
        {nextLab ? (
          <PrepareLab lab={nextLab} terminal={labTopic ? `/t/${labTopic.id}?terminal=1` : null} />
        ) : (
          <p className="text-muted">This topic has no lab.</p>
        )}
        <Link to="/labs" className="mt-2 inline-block text-sm text-accent hover:underline">All labs</Link>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">Domains</h2>
          <span className="text-sm text-muted">Pass mark {PASS}%</span>
        </div>
        <ul className="mt-4 space-y-4">
          {domains
            .filter((d) => d.weight !== null)
            .map((d) => {
              const scores = d.topics.map((t) => t.progress?.bestScore ?? 0);
              const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
              const done = d.topics.filter((t) => t.progress?.steps && t.progress.stepsDone === t.progress.steps).length;
              return (
                <li key={d.name}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                    <span className="font-semibold">
                      {d.name} <span className="font-normal text-muted">{d.weight}%</span>
                    </span>
                    <span className="tabular-nums text-muted">
                      {done} of {d.topics.length} topics finished · practice average {avg}%
                    </span>
                  </div>
                  <span className="relative mt-1.5 block h-2 rounded-full bg-line" title={`${avg}% against a ${PASS}% pass mark`}>
                    <span className={`block h-full rounded-full ${avg >= PASS ? "bg-done" : "bg-accent"}`} style={{ width: `${avg}%` }} />
                    <span aria-hidden className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${PASS}%` }} />
                  </span>
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
              <th className="w-28 py-2 font-normal sm:w-44">Progress</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Quiz missed</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Best score</th>
            </tr>
          </thead>
          {domains.map((d) => (
            <tbody key={d.name}>
              <tr>
                <th colSpan={4} className="pt-6 pb-2 text-left font-bold">
                  {d.name} {d.weight !== null && <span className="font-normal text-muted">{d.weight}%</span>}
                </th>
              </tr>
              {d.topics.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={4} className="py-2 text-sm text-muted">Coming soon</td>
                </tr>
              )}
              {d.topics.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-2">
                    {t.progress ? (
                      <Link to={`/t/${t.id}`} className="hover:text-accent hover:underline">
                        {t.name}
                      </Link>
                    ) : (
                      <span className="text-muted">{t.name}</span>
                    )}
                    {(missed(t) || score(t)) && (
                      <span className="mt-0.5 block text-sm text-muted sm:hidden">
                        {[missed(t) && `Quiz missed ${missed(t)}`, score(t) && `Best score ${score(t)}`].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {t.progress ? (
                      <span className="flex items-center gap-3 text-sm tabular-nums">
                        <span className="flex-1"><Meter done={t.progress.stepsDone} total={t.progress.steps} /></span>
                        {t.progress.stepsDone}/{t.progress.steps}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Coming soon</span>
                    )}
                  </td>
                  <td className={`hidden py-2 text-right tabular-nums sm:table-cell ${t.progress?.missed ? "text-missed" : "text-muted"}`}>
                    {missed(t)}
                  </td>
                  <td className={`hidden py-2 text-right tabular-nums sm:table-cell ${t.progress?.bestScore != null ? "" : "text-muted"}`}>
                    {score(t)}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

export { Problem as ErrorBoundary } from "~/root";
