import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { Meter, pretty } from "~/root";


export default function Home() {
  const { domains } = useRouteLoaderData<typeof rootLoader>("root")!;
  const written = domains.flatMap((d) => d.topics).filter((t) => t.progress);
  const next = written.find((t) => t.progress!.stepsDone < t.progress!.steps) ?? written[0];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Where you are</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {written.length} of {domains.flatMap((d) => d.topics).length} topics are written. Commands run in your own terminal; this page
        keeps your ticks, Recall grades, timed runs and notes. Start with the <Link to="/doc/lab/README.md" className="text-accent underline">lab guide</Link> if the
        VMs are not built yet, and read the <Link to="/doc/EXAM.md" className="text-accent underline">exam format</Link> once.
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
        <table className="w-full min-w-[36rem] text-left">
          <thead className="text-sm text-muted">
            <tr>
              <th className="py-2 font-normal">Topic</th>
              <th className="w-44 py-2 font-normal">Steps</th>
              <th className="py-2 text-right font-normal">Recall missed</th>
              <th className="py-2 text-right font-normal">Best run</th>
            </tr>
          </thead>
          {domains.map((d) => (
            <tbody key={d.name}>
              <tr>
                <th colSpan={4} className="pt-6 pb-2 text-left font-bold">
                  {pretty(d.name)} {d.weight !== null && <span className="font-normal text-muted">({d.weight}% of the exam)</span>}
                </th>
              </tr>
              {d.topics.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-2">
                    {t.progress ? (
                      <Link to={`/t/${t.id}`} className="hover:text-accent hover:underline">
                        {pretty(t.topic)}
                      </Link>
                    ) : (
                      <span className="text-muted/70">{pretty(t.topic)}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {t.progress ? (
                      <span className="flex items-center gap-3 text-sm tabular-nums">
                        <span className="flex-1"><Meter done={t.progress.stepsDone} total={t.progress.steps} /></span>
                        {t.progress.stepsDone}/{t.progress.steps}
                      </span>
                    ) : (
                      <span className="text-sm text-muted/70">Not written</span>
                    )}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${t.progress?.missed ? "text-missed" : "text-muted"}`}>
                    {t.progress?.recall ? `${t.progress.missed} of ${t.progress.recall}` : ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {t.progress?.bestScore != null ? `${t.progress.bestScore}%` : t.progress?.hasPractice ? <span className="text-muted">Not run</span> : ""}
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
