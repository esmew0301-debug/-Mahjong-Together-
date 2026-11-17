/**
 * Learning-group matching (deterministic, explainable). Each viewer's interest profile is the SET of topics of the
 * public questions they asked or explicitly +1'd ("I have the same question"). Repeating a topic adds nothing.
 * Private Coach conversations are never used. Similarity = Jaccard overlap of topic sets.
 */
import type { Discussion, Group, Topic } from "./types";

export function interestProfiles(d: Discussion): Record<string, Topic[]> {
  const sets: Record<string, Set<Topic>> = {};
  for (const q of d.questions) for (const sid of q.same) (sets[sid] ||= new Set()).add(q.topic); // same[] includes the author
  return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [...v].sort()]));
}
export const jaccard = (a: Topic[], b: Topic[]) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
};
const shared = (members: string[], prof: Record<string, Topic[]>) =>
  members.map((m) => prof[m] || []).reduce<Topic[]>((acc, t, i) => (i === 0 ? [...t] : acc.filter((x) => t.includes(x))), []);

/** Pairs of viewers who shared at least one specific question (strongest evidence). */
function sharedQuestionCount(d: Discussion) {
  const c: Record<string, number> = {};
  for (const q of d.questions) for (const a of q.same) for (const b of q.same) if (a < b) c[`${a}|${b}`] = (c[`${a}|${b}`] || 0) + 1;
  return (a: string, b: string) => c[a < b ? `${a}|${b}` : `${b}|${a}`] || 0;
}

/**
 * Greedy grouping into groups of four (three as a fallback) whose members ALL share at least one topic.
 * Seeds are the most active viewers; candidates are ranked by shared questions, then topic overlap. Deterministic:
 * ties break by spectator id. Viewers who cannot be placed with evidence are left for the general beginner group.
 */
export function recommendGroups(d: Discussion, eligible: string[], now = Date.now(), newId: () => string): Group[] {
  const prof = interestProfiles(d);
  const sq = sharedQuestionCount(d);
  const pool = eligible.filter((id) => (prof[id] || []).length).sort((a, b) => prof[b].length - prof[a].length || (a < b ? -1 : 1));
  const used = new Set<string>();
  const groups: Group[] = [];
  const score = (g: string[], c: string) => g.reduce((s, m) => s + sq(m, c) * 2 + jaccard(prof[m], prof[c]), 0);
  for (const size of [4, 3]) {
    for (const seed of pool) {
      if (used.has(seed)) continue;
      const g = [seed];
      while (g.length < size) {
        const cands = pool.filter((c) => !used.has(c) && !g.includes(c) && shared([...g, c], prof).length > 0)
          .sort((a, b) => score(g, b) - score(g, a) || (a < b ? -1 : 1));
        if (!cands.length) break;
        g.push(cands[0]);
      }
      if (g.length === size) {
        g.forEach((m) => used.add(m));
        groups.push({ id: newId(), kind: "topic", members: g, topics: shared(g, prof), status: Object.fromEntries(g.map((m) => [m, "invited"])), createdAt: now });
      }
    }
  }
  return groups;
}

/** "You all asked about Pung and Ding Que." */
export function joinWords(ws: string[]) {
  return ws.length <= 1 ? ws.join("") : ws.length === 2 ? `${ws[0]} and ${ws[1]}` : `${ws.slice(0, -1).join(", ")}, and ${ws[ws.length - 1]}`;
}
