/**
 * Layout choices kept in cookies, so the server draws the page the way it was left instead of
 * drawing the default and correcting it after load. `sidebar` and `pane` are true when hidden;
 * `split` is the left side's share of each divider in percent.
 */
export type Prefs = { sidebar: boolean; pane: boolean; split: Record<SplitName, number> };
export type SplitName = "lab" | "doc";

export function readPrefs(cookie: string | null): Prefs {
  const c = Object.fromEntries(
    (cookie ?? "")
      .split(";")
      .map((p) => p.trim().split("="))
      .filter(([k]) => k?.startsWith("cka-"))
      .map(([k, v]) => [k.slice(4), decodeURIComponent(v ?? "")]),
  );
  const share = (v: string | undefined) => (Number(v) > 0 && Number(v) < 100 ? Number(v) : 50);
  return { sidebar: c.sidebar === "hidden", pane: c.pane === "hidden", split: { lab: share(c["split-lab"]), doc: share(c["split-doc"]) } };
}

export function setPref(name: "sidebar" | "pane" | `split-${SplitName}`, value: string) {
  document.cookie = `cka-${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}
