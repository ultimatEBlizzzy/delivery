import { useQuery } from '@tanstack/react-query';
import type { CategoryDto } from '@hardware-delivery/shared';
import { categoryApi } from '@/api/catalogue';
import { Select, type SelectProps } from '@/components/ui/Input';

export interface FlatCategory {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  isActive: boolean;
}

/** Depth-first flattening of the category tree (parents before children, sort order preserved). */
export function flattenCategories(tree: CategoryDto[], depth = 0): FlatCategory[] {
  return tree.flatMap((c) => [
    { id: c.id, name: c.name, depth, parentId: c.parentId, isActive: c.isActive },
    ...flattenCategories(c.children ?? [], depth + 1),
  ]);
}

export function descendantIdsOf(tree: CategoryDto[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (nodes: CategoryDto[], inside: boolean) => {
    for (const n of nodes) {
      const here = inside || n.id === id;
      if (here) out.add(n.id);
      walk(n.children ?? [], here);
    }
  };
  walk(tree, false);
  return out;
}

export function useCategoryTree(admin = false) {
  return useQuery({
    queryKey: ['categories', admin ? 'admin' : 'public'],
    queryFn: admin ? categoryApi.adminTree : categoryApi.tree,
    staleTime: 60_000,
  });
}

/** <select> showing the hierarchy with indentation. */
export function CategorySelect({
  admin = false,
  emptyLabel,
  excludeSubtreeOf,
  ...props
}: Omit<SelectProps, 'children'> & {
  admin?: boolean;
  emptyLabel?: string;
  excludeSubtreeOf?: string;
}) {
  const { data: tree, isLoading } = useCategoryTree(admin);
  const excluded =
    tree && excludeSubtreeOf ? descendantIdsOf(tree, excludeSubtreeOf) : new Set<string>();
  const flat = flattenCategories(tree ?? []).filter((c) => !excluded.has(c.id));
  return (
    <Select disabled={isLoading || props.disabled} {...props}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {flat.map((c) => (
        <option key={c.id} value={c.id}>
          {`${'\u00A0\u00A0'.repeat(c.depth)}${c.depth ? '— ' : ''}${c.name}${c.isActive ? '' : ' (inactive)'}`}
        </option>
      ))}
    </Select>
  );
}
