import { describe, expect, test } from 'bun:test';

import { applyFlowNodeSelection } from './flow-graph';

describe('applyFlowNodeSelection', () => {
  const nodes = [
    { id: 'a', position: { x: 0, y: 0 } },
    { id: 'b', position: { x: 200, y: 0 } },
    { id: 'c', position: { x: 400, y: 0 } },
  ];

  test('marks exactly one node selected for the active screen', () => {
    const selected = applyFlowNodeSelection(nodes, 'b');
    expect(selected.map((node) => [node.id, node.selected])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
  });

  test('null active screen selects nothing', () => {
    const selected = applyFlowNodeSelection(nodes, null);
    expect(selected.every((node) => node.selected === false)).toBe(true);
  });

  test('an active screen missing from the nodes selects nothing', () => {
    const selected = applyFlowNodeSelection(nodes, 'missing');
    expect(selected.every((node) => node.selected === false)).toBe(true);
  });

  test('moves selection instead of duplicating it when the active id changes', () => {
    expect(applyFlowNodeSelection(nodes, 'a').filter((n) => n.selected)).toHaveLength(1);
    expect(applyFlowNodeSelection(nodes, 'c').filter((n) => n.selected)).toHaveLength(1);
  });
});
