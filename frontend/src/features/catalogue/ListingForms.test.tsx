import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingDto } from '@hardware-delivery/shared';
import { listingApi } from '@/api/catalogue';
import { EditListingModal, PriceCell, StockAdjustModal } from './ListingForms';

const api = {
  update: vi.fn(),
  adjustStock: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  movements: vi.fn(),
};
vi.mock('@/api/catalogue', () => ({ listingApi: vi.fn(() => api) }));

const listing = (patch: Partial<ListingDto> = {}): ListingDto => ({
  id: 'l1',
  storeId: 's1',
  productId: 'p1',
  storeSku: null,
  price: 100,
  salePrice: null,
  effectivePrice: 100,
  onSale: false,
  stockQuantity: 10,
  minimumQuantity: 1,
  maximumQuantity: null,
  maxOrderable: 10,
  lowStockThreshold: 5,
  stockStatus: 'IN_STOCK',
  available: true,
  product: {
    id: 'p1',
    name: 'Cement 42.5R 50kg',
    slug: 'cement',
    sku: 'CEM-1',
    brand: null,
    unit: 'bag',
    packSize: '50 kg bag',
    weightKg: 50,
    primaryImageUrl: null,
    category: { id: 'c', name: 'Cement', slug: 'cement' },
    isActive: true,
  },
  updatedAt: '2026-01-01T00:00:00Z',
  ...patch,
});

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
        })
      }
    >
      {ui}
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  vi.mocked(listingApi).mockReturnValue(api as never);
});

describe('StockAdjustModal', () => {
  it('previews the new stock level and sends the right request', async () => {
    api.adjustStock.mockResolvedValue(listing({ stockQuantity: 18 }));
    const onClose = vi.fn();
    const user = userEvent.setup();
    wrap(<StockAdjustModal scope="store" listing={listing()} onClose={onClose} />);

    await user.type(screen.getByLabelText('Quantity'), '8');
    expect(screen.getByRole('status')).toHaveTextContent('10');
    expect(screen.getByRole('status')).toHaveTextContent('18');
    await user.type(screen.getByLabelText('Note'), 'supplier delivery');
    await user.click(screen.getByRole('button', { name: 'Update stock' }));

    await waitFor(() =>
      expect(api.adjustStock).toHaveBeenCalledWith('l1', {
        mode: 'ADD',
        quantity: 8,
        reason: 'RESTOCK',
        note: 'supplier delivery',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('refuses to remove more stock than exists', async () => {
    const user = userEvent.setup();
    wrap(<StockAdjustModal scope="store" listing={listing()} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('Remove stock'));
    await user.type(screen.getByLabelText('Quantity'), '11');
    expect(screen.getByText('You only have 10 in stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update stock' })).toBeDisabled();
    expect(api.adjustStock).not.toHaveBeenCalled();
  });

  it('"set exact level" allows zero and picks the stock-take reason', async () => {
    api.adjustStock.mockResolvedValue(listing({ stockQuantity: 0 }));
    const user = userEvent.setup();
    wrap(<StockAdjustModal scope="admin" listing={listing()} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('Set exact level'));
    await user.type(screen.getByLabelText('New stock level'), '0');
    await user.click(screen.getByRole('button', { name: 'Update stock' }));
    await waitFor(() =>
      expect(api.adjustStock).toHaveBeenCalledWith('l1', {
        mode: 'SET',
        quantity: 0,
        reason: 'ADJUSTMENT',
        note: undefined,
      }),
    );
  });
});

describe('EditListingModal', () => {
  it('blocks a sale price that is not lower than the price (no request is sent)', async () => {
    const user = userEvent.setup();
    wrap(<EditListingModal scope="store" listing={listing()} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/^Sale price/), '100');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Sale price must be lower than the regular price'),
    ).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('blocks a maximum below the minimum', async () => {
    const user = userEvent.setup();
    wrap(
      <EditListingModal
        scope="store"
        listing={listing({ minimumQuantity: 10 })}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/^Maximum order/), '5');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Maximum cannot be lower than the minimum')).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('sends numbers (not strings) and clears optional fields as null', async () => {
    api.update.mockResolvedValue(listing());
    const user = userEvent.setup();
    wrap(
      <EditListingModal
        scope="store"
        listing={listing({ salePrice: 90, maximumQuantity: 50 })}
        onClose={vi.fn()}
      />,
    );
    const price = screen.getByLabelText(/^Price/);
    await user.clear(price);
    await user.type(price, '120,50');
    await user.clear(screen.getByLabelText(/^Sale price/));
    await user.clear(screen.getByLabelText(/^Maximum order/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('l1', {
        price: 120.5,
        salePrice: null,
        minimumQuantity: 1,
        maximumQuantity: null,
        lowStockThreshold: 5,
        storeSku: null,
        available: true,
      }),
    );
  });
});

describe('PriceCell', () => {
  it('shows the sale price with the regular price struck through', () => {
    const { container } = render(
      <PriceCell listing={{ price: 100, salePrice: 80, onSale: true }} />,
    );
    expect(screen.getByText('R80.00')).toBeInTheDocument();
    expect(container.querySelector('.line-through')).toHaveTextContent('R100.00');
  });

  it('shows just the price when not on sale', () => {
    render(<PriceCell listing={{ price: 109.99, salePrice: null, onSale: false }} />);
    expect(screen.getByText('R109.99')).toBeInTheDocument();
  });
});
