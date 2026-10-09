import { expect, test } from "vitest";
import { parseGrade } from "../app/lab/grade";

test("reads each task's checks and score from grader output", () => {
  const out = `Task 1 (20%)
  ✓ repository podinfo points at the podinfo chart repo
  ✗ it was installed with 3 replicas
   task 1: 12.5 of 20%

Task 2 (25%)
  ✗ a revision of shop runs podinfo-6.15.0
   task 2: 0.0 of 25%

Score: 13% — FAIL (pass mark 66%)`;
  expect(parseGrade(out)).toEqual([
    {
      n: 1,
      weight: 20,
      score: 12.5,
      checks: [
        { ok: true, what: "repository podinfo points at the podinfo chart repo" },
        { ok: false, what: "it was installed with 3 replicas" },
      ],
    },
    { n: 2, weight: 25, score: 0, checks: [{ ok: false, what: "a revision of shop runs podinfo-6.15.0" }] },
  ]);
  expect(parseGrade("Error: No such container: controlplane")).toEqual([]);
});
