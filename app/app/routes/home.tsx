import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { Meter, pretty } from "~/root";


type Topic = Awaited<ReturnType<typeof rootLoader>>["domains"][number]["topics"][number];
const missed = (t: Topic) => (t.progress?.recall ? `${t.progress.missed} of ${t.progress.recall}` : "");
const score = (t: Topic) =>
  t.progress?.bestScore != null ? `${t.progress.bestScore}%` : t.progress?.hasPractice ? "Not attempted" : "";

export default function Home() {
  const { domains } = useRouteLoaderData<typeof rootLoader>("root")!;
  const written = domains.flatMap((d) => d.topics).filter((t) => t.progress);
  const next = written.find((t) => t.progress!.stepsDone < t.progress!.steps) ?? written[0];
  const started = written.some((t) => t.progress!.stepsDone > 0);
  const finished = written.filter((t) => t.progress!.steps && t.progress!.stepsDone === t.progress!.steps).length;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
      {!started && (
        <div className="mt-6 rounded-md border border-line bg-surface px-5 py-4">
          <h2 className="font-bold">Getting started</h2>
          <p className="mt-1 text-muted">Set up the lab, then start with the first topic.</p>
          <Link to="/doc/lab/README.md" className="mt-3 inline-block font-semibold text-accent hover:underline">
            Set up the lab
          </Link>
        </div>
      )}
      <p className="mt-3 text-muted">
        You have finished {finished} of {written.length} available topics.
      </p>
      {next && (
        <Link
          to={`/t/${next.id}`}
          className="mt-6 inline-block rounded bg-accent px-4 py-2 font-semibold text-paper hover:opacity-90"
        >
          Continue with {pretty(next.topic)}
        </Link>
      )}

      <div className="mt-10 overflow-x-auto">
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
                  {pretty(d.name)} {d.weight !== null && <span className="font-normal text-muted">{d.weight}%</span>}
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
                        {pretty(t.topic)}
                      </Link>
                    ) : (
                      <span className="text-muted">{pretty(t.topic)}</span>
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
