import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@hardware-delivery/shared';
import { useAuthStore } from '@/store/auth.store';
import { RequireRole } from './RequireRole';

function LoginProbe() {
  const location = useLocation();
  return <p>login page (from: {(location.state as { from?: string } | null)?.from ?? 'none'})</p>;
}

function renderGuard(role: Role, path = '/admin/orders?page=2') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/login" element={<LoginProbe />} />
        <Route path="/store/login" element={<LoginProbe />} />
        <Route element={<RequireRole role={role} />}>
          <Route path="/admin/orders" element={<p>secret admin page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const user = (roles: Role[]) => ({
  id: '1',
  email: 'x@y.co',
  firstName: 'X',
  lastName: 'Y',
  roles,
  phone: null,
  avatarUrl: null,
  isActive: true,
  createdAt: '',
});

describe('RequireRole', () => {
  beforeEach(() => useAuthStore.setState({ status: 'loading', user: null, accessToken: null }));

  it('shows a loader while the session is being restored', () => {
    renderGuard(Role.ADMIN);
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByText('secret admin page')).not.toBeInTheDocument();
  });

  it('redirects anonymous visitors to the portal sign-in, remembering where they were going', () => {
    useAuthStore.setState({ status: 'anonymous' });
    renderGuard(Role.ADMIN);
    expect(screen.getByText('login page (from: /admin/orders?page=2)')).toBeInTheDocument();
  });

  it('blocks signed-in users that lack the role (no redirect loop)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: user([Role.CUSTOMER]),
      accessToken: 't',
    });
    renderGuard(Role.ADMIN);
    expect(screen.getByText(/don’t have access/i)).toBeInTheDocument();
    expect(screen.queryByText('secret admin page')).not.toBeInTheDocument();
  });

  it('renders the page for users with the role', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: user([Role.CUSTOMER, Role.ADMIN]),
      accessToken: 't',
    });
    renderGuard(Role.ADMIN);
    expect(screen.getByText('secret admin page')).toBeInTheDocument();
  });
});
