import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from './ConfirmHost';
import { DataTable, type Column } from './DataTable';
import { QuantityStepper } from './QuantityStepper';
import { confirm } from '@/store/confirm.store';

describe('QuantityStepper', () => {
  function Harness({ min = 1, max = 5 }: { min?: number; max?: number }) {
    const [v, setV] = useState(2);
    return <QuantityStepper value={v} onChange={setV} min={min} max={max} label="Bags" />;
  }

  it('steps and clamps within [min, max]', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'Bags' });
    await user.click(screen.getByRole('button', { name: /increase bags/i }));
    expect(input).toHaveValue(3);
    await user.clear(input);
    await user.type(input, '99');
    expect(input).toHaveValue(5); // clamped to max
    expect(screen.getByRole('button', { name: /increase bags/i })).toBeDisabled();
  });

  it('disables decrease at the minimum', () => {
    render(<QuantityStepper value={1} onChange={() => undefined} min={1} />);
    expect(screen.getByRole('button', { name: /decrease quantity/i })).toBeDisabled();
  });
});

describe('DataTable', () => {
  interface Row {
    id: string;
    name: string;
  }
  const columns: Column<Row>[] = [{ key: 'name', header: 'Name', cell: (r) => r.name }];
  const meta = { page: 2, limit: 10, total: 25, totalPages: 3 };

  it('renders rows, an accessible caption and server pagination', async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        caption="Stores"
        columns={columns}
        rowKey={(r) => r.id}
        data={{ data: [{ id: '1', name: 'Malamulele Hardware' }], meta }}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByRole('table', { name: 'Stores' })).toBeInTheDocument();
    expect(screen.getByText('Malamulele Hardware')).toBeInTheDocument();
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('shows an empty state with guidance', () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rowKey={(r) => r.id}
        data={{ data: [] }}
        emptyTitle="No orders yet"
      />,
    );
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rowKey={(r) => r.id}
        error={new Error('boom')}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows skeleton rows while loading the first page', () => {
    const { container } = render(
      <DataTable caption="Orders" columns={columns} rowKey={(r) => r.id} loading />,
    );
    expect(container.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(screen.queryByText(/nothing here yet/i)).not.toBeInTheDocument();
  });

  it('supports keyboard activation of clickable rows', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Stores"
        columns={columns}
        rowKey={(r) => r.id}
        data={{ data: [{ id: '1', name: 'Row' }] }}
        onRowClick={onRowClick}
      />,
    );
    const row = within(screen.getByRole('table')).getByText('Row').closest('tr')!;
    row.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith({ id: '1', name: 'Row' });
  });
});

describe('confirm()', () => {
  it('resolves true when confirmed and false when cancelled', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);

    const first = confirm({
      title: 'Delete store?',
      message: 'This cannot be undone',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    expect(await screen.findByText('Delete store?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await expect(first).resolves.toBe(true);

    const second = confirm({ title: 'Sign out?' });
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await expect(second).resolves.toBe(false);
  });
});
