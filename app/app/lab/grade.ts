export type TaskResult = { n: number; weight: number; score: number; checks: { ok: boolean; what: string }[] };

/** Reads grade-lib.sh output: "Task 1 (20%)", "  ✓ what" / "  ✗ what", "   task 1: 12.5 of 20%". */
export function parseGrade(out: string): TaskResult[] {
  const tasks: TaskResult[] = [];
  for (const line of out.split("\n")) {
    const head = line.match(/^Task (\d+) \((\d+)%\)/);
    const check = line.match(/^ {2}([✓✗]) (.*)$/);
    const total = line.match(/^ {3}task (\d+): ([\d.]+) of/);
    if (head) tasks.push({ n: Number(head[1]), weight: Number(head[2]), score: 0, checks: [] });
    else if (check && tasks.length) tasks.at(-1)!.checks.push({ ok: check[1] === "✓", what: check[2] });
    else if (total && tasks.length) tasks.at(-1)!.score = Number(total[2]);
  }
  return tasks;
}
