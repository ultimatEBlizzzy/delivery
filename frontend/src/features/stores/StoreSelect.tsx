import { useQuery } from '@tanstack/react-query';
import { storeApi } from '@/api/stores';
import { Select, type SelectProps } from '@/components/ui/Input';

/** Drop-down of stores for admin filters/forms (first 100 by newest; use search on the stores page for more). */
export function StoreSelect({
  emptyLabel,
  ...props
}: Omit<SelectProps, 'children'> & { emptyLabel?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stores', 'options'],
    queryFn: () => storeApi.adminList({ limit: 100 }),
    staleTime: 60_000,
  });
  const stores = [...(data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Select disabled={isLoading || props.disabled} {...props}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} – {s.city}
        </option>
      ))}
    </Select>
  );
}
