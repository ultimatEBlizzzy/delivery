import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@hardware-delivery/shared';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth.store';
import { LoginForm } from './LoginForm';

vi.mock('@/api/auth', () => ({
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) },
}));

const response = (roles: Role[]) => ({
  user: {
    id: '1',
    email: 'a@b.co',
    firstName: 'A',
    lastName: 'B',
    roles,
    phone: null,
    avatarUrl: null,
    isActive: true,
    createdAt: '',
  },
  accessToken: 'tok',
  expiresIn: 900,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderForm(role: Role, state?: unknown) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[{ pathname: '/signin', state }]}>
        <Routes>
          <Route path="/signin" element={<LoginForm role={role} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(email = 'a@b.co', password = 'Passw0rd1') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email address/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.logout).mockClear();
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
  });

  it('validates input before calling the API', async () => {
    renderForm(Role.CUSTOMER);
    await userEvent.setup().click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('signs in and goes to the portal home', async () => {
    vi.mocked(authApi.login).mockResolvedValue(response([Role.ADMIN]));
    renderForm(Role.ADMIN);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'tok' });
  });

  it('returns the user to the page they were trying to open', async () => {
    vi.mocked(authApi.login).mockResolvedValue(response([Role.CUSTOMER]));
    renderForm(Role.CUSTOMER, { from: '/orders/123?tab=items' });
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/orders/123'));
  });

  it.each(['//evil.example/phish', 'https://evil.example', 'javascript:alert(1)'])(
    'ignores unsafe redirect target %s',
    async (from) => {
      vi.mocked(authApi.login).mockResolvedValue(response([Role.CUSTOMER]));
      renderForm(Role.CUSTOMER, { from });
      await fillAndSubmit();
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/'));
      expect(screen.getByTestId('where')).not.toHaveTextContent('evil');
    },
  );

  it('rejects accounts without the portal role and revokes the session it just created', async () => {
    vi.mocked(authApi.login).mockResolvedValue(response([Role.CUSTOMER]));
    renderForm(Role.ADMIN);
    await fillAndSubmit();
    expect(await screen.findByText(/can't use the admin console/i)).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('shows the server error for bad credentials', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Incorrect email or password'));
    renderForm(Role.CUSTOMER);
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });
});
