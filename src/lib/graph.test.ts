import { describe, expect, it } from 'vitest';
import { layoutGraph } from './graph';
import type { Commit } from '../types';
const commit = (id: string, parents: string[]): Commit => ({
  id,
  parents,
  author: 'Test',
  email: '',
  timestamp: 0,
  refs: [],
  subject: id,
});
describe('topological graph', () => {
  it('keeps linear ancestry on a single lane', () => {
    const rows = layoutGraph([
      commit('a', ['b']),
      commit('b', ['c']),
      commit('c', []),
    ]);
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(rows[2].segments).toHaveLength(0);
  });
  it('joins both sides of a merge without losing the pending parent', () => {
    const rows = layoutGraph([
      commit('merge', ['main', 'feature']),
      commit('feature', ['root']),
      commit('main', ['root']),
      commit('root', []),
    ]);
    expect(rows[0].segments.filter((s) => s.node)).toHaveLength(2);
    expect(rows[1].lane).not.toEqual(rows[2].lane);
    // Both the continuing feature lane and main's parent converge on root.
    expect(rows[2].segments.map((s) => s.to)).toEqual([0, 0]);
    expect(
      rows.flatMap((r) => r.segments).every((s) => s.from >= 0 && s.to >= 0),
    ).toBe(true);
    expect(rows[3].segments).toHaveLength(0);
  });
  it('handles disconnected roots, octopus merges, and page boundaries', () => {
    const rows = layoutGraph([
      commit('merge', ['a', 'b', 'c']),
      commit('other', []),
      commit('b', ['root']),
      commit('a', ['root']),
    ]);
    expect(rows[0].segments.filter((s) => s.node)).toHaveLength(3);
    expect(rows.every((r) => r.width >= r.lane + 1)).toBe(true);
  });
});
