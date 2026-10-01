import { describe, expect, it } from 'vitest';
import type { CategoryDto } from '@hardware-delivery/shared';
import { descendantIdsOf, flattenCategories } from './CategorySelect';

const cat = (
  id: string,
  parentId: string | null,
  children: CategoryDto[] = [],
  isActive = true,
): CategoryDto => ({
  id,
  parentId,
  name: id.toUpperCase(),
  slug: id,
  description: null,
  icon: null,
  imageUrl: null,
  sortOrder: 0,
  isActive,
  children,
});

const tree: CategoryDto[] = [
  cat('a', null, [cat('a1', 'a', [cat('a1x', 'a1')]), cat('a2', 'a')]),
  cat('b', null, [cat('b1', 'b')], false),
];

describe('category tree helpers', () => {
  it('flattens depth-first, parents before children, with depth', () => {
    expect(flattenCategories(tree).map((c) => `${c.depth}:${c.id}`)).toEqual([
      '0:a',
      '1:a1',
      '2:a1x',
      '1:a2',
      '0:b',
      '1:b1',
    ]);
  });

  it('keeps the inactive flag for display', () => {
    expect(flattenCategories(tree).find((c) => c.id === 'b')!.isActive).toBe(false);
  });

  it('finds a category and everything below it (used to stop a category being moved under itself)', () => {
    expect([...descendantIdsOf(tree, 'a1')].sort()).toEqual(['a1', 'a1x']);
    expect([...descendantIdsOf(tree, 'a')].sort()).toEqual(['a', 'a1', 'a1x', 'a2']);
    expect([...descendantIdsOf(tree, 'a2')]).toEqual(['a2']);
    expect(descendantIdsOf(tree, 'nope').size).toBe(0);
  });
});
