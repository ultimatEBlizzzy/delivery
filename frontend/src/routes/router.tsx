import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router-dom';
import { Role } from '@hardware-delivery/shared';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { ConfirmHost } from '@/components/ui/ConfirmHost';
import { Toaster } from '@/components/ui/Toaster';
import { adminNav } from '@/features/admin/nav';
import { RequireRole } from '@/features/auth/RequireRole';
import { driverNav } from '@/features/driver/nav';
import { storeNav } from '@/features/store/nav';
import { RouteError } from './RouteError';

/** Code-split a page: its chunk is only downloaded when the route is first visited. */
const page =
  <M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M = 'default') =>
  async () => ({ Component: (await loader())[name] as ComponentType });

function RootLayout() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
      <Toaster />
      <ConfirmHost />
    </>
  );
}

const AdminLayout = () => (
  <PortalLayout portal={Role.ADMIN} label="Admin" nav={adminNav} profilePath="/admin/profile" />
);
const StoreLayout = () => (
  <PortalLayout portal={Role.STORE} label="Store" nav={storeNav} profilePath="/store/profile" />
);
const DriverLayout = () => (
  <PortalLayout portal={Role.DRIVER} label="Driver" nav={driverNav} profilePath="/driver/profile" />
);

const customerProfile = async () => {
  const { ProfilePage } = await import('@/features/account/ProfilePage');
  return { Component: () => <ProfilePage portal={Role.CUSTOMER} /> };
};
const profileFor = (role: Role) => async () => {
  const { ProfilePage } = await import('@/features/account/ProfilePage');
  return { Component: () => <ProfilePage portal={role} /> };
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      // ---- Customer app ----------------------------------------------------------------------
      {
        element: <CustomerLayout />,
        children: [
          {
            index: true,
            handle: { fullBleed: true },
            lazy: page(() => import('@/pages/public/LandingPage')),
          },
          {
            element: <RequireRole role={Role.CUSTOMER} />,
            children: [{ path: 'profile', lazy: customerProfile }],
          },
        ],
      },
      {
        path: 'login',
        lazy: page(() => import('@/features/auth/LoginPages'), 'CustomerLoginPage'),
      },
      {
        path: 'register',
        lazy: page(() => import('@/features/auth/RegisterPage'), 'RegisterPage'),
      },

      // ---- Driver portal ---------------------------------------------------------------------
      {
        path: 'driver/login',
        lazy: page(() => import('@/features/auth/LoginPages'), 'DriverLoginPage'),
      },
      {
        path: 'driver',
        element: <RequireRole role={Role.DRIVER} />,
        children: [
          {
            element: <DriverLayout />,
            children: [
              { index: true, element: <Navigate to="/driver/profile" replace /> },
              { path: 'profile', lazy: profileFor(Role.DRIVER) },
            ],
          },
        ],
      },

      // ---- Store portal ----------------------------------------------------------------------
      {
        path: 'store/login',
        lazy: page(() => import('@/features/auth/LoginPages'), 'StoreLoginPage'),
      },
      {
        path: 'store',
        element: <RequireRole role={Role.STORE} />,
        children: [
          {
            element: <StoreLayout />,
            children: [
              { index: true, element: <Navigate to="/store/profile" replace /> },
              { path: 'profile', lazy: profileFor(Role.STORE) },
            ],
          },
        ],
      },

      // ---- Admin console ---------------------------------------------------------------------
      {
        path: 'admin/login',
        lazy: page(() => import('@/features/auth/LoginPages'), 'AdminLoginPage'),
      },
      {
        path: 'admin',
        element: <RequireRole role={Role.ADMIN} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="/admin/settings" replace /> },
              { path: 'settings', lazy: page(() => import('@/features/admin/SettingsPage')) },
              { path: 'audit-log', lazy: page(() => import('@/features/admin/AuditLogPage')) },
              { path: 'profile', lazy: profileFor(Role.ADMIN) },
            ],
          },
        ],
      },

      { path: '*', lazy: page(() => import('@/pages/public/NotFoundPage')) },
    ],
  },
]);
