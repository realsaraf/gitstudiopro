import type { Commit } from '../types';
export interface GraphSegment {
  from: number;
  to: number;
  color: number;
  node?: boolean;
}
export interface GraphRow {
  lane: number;
  color: number;
  segments: GraphSegment[];
  width: number;
}
/** Topological frontier: each lane names a pending parent, never a decorative line. */
export function layoutGraph(commits: Commit[]): GraphRow[] {
  let lanes: { id: string; color: number }[] = [];
  let nextColor = 0;
  return commits.map((commit) => {
    let lane = lanes.findIndex((l) => l.id === commit.id);
    if (lane < 0) {
      lane = lanes.length;
      lanes.push({ id: commit.id, color: nextColor++ % 6 });
    }
    const color = lanes[lane].color;
    const next = lanes.filter((_, i) => i !== lane);
    commit.parents.forEach((parent, i) => {
      if (!next.some((l) => l.id === parent))
        next.splice(i === 0 ? Math.min(lane, next.length) : next.length, 0, {
          id: parent,
          color: i === 0 ? color : nextColor++ % 6,
        });
    });
    const segments: GraphSegment[] = lanes.flatMap((l, from) =>
      from === lane
        ? []
        : [{ from, to: next.findIndex((n) => n.id === l.id), color: l.color }],
    );
    commit.parents.forEach((parent) =>
      segments.push({
        from: lane,
        to: next.findIndex((l) => l.id === parent),
        color,
        node: true,
      }),
    );
    const width = Math.max(lanes.length, next.length, 2);
    lanes = next;
    return { lane, color, segments, width };
  });
}
