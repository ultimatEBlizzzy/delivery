import { Link } from 'react-router-dom';
import { Role } from '@hardware-delivery/shared';
import { AuthShell } from './AuthShell';
import { LoginForm } from './LoginForm';

export function CustomerLoginPage() {
  return (
    <AuthShell
      portal="customer"
      title="Welcome back"
      subtitle="Sign in to order, track deliveries and manage your addresses."
      footer={
        <p className="space-x-3">
          <Link to="/driver/login" className="hover:text-slate-800 hover:underline">
            Driver sign in
          </Link>
          <span aria-hidden>·</span>
          <Link to="/store/login" className="hover:text-slate-800 hover:underline">
            Store sign in
          </Link>
        </p>
      }
    >
      <LoginForm role={Role.CUSTOMER} registerPath="/register" forgotHint />
    </AuthShell>
  );
}

export function DriverLoginPage() {
  return (
    <AuthShell
      portal="driver"
      title="Driver sign in"
      subtitle="Go online, accept jobs and track your earnings."
    >
      <LoginForm role={Role.DRIVER} registerPath="/driver/register" forgotHint />
    </AuthShell>
  );
}

export function StoreLoginPage() {
  return (
    <AuthShell
      portal="store"
      title="Store sign in"
      subtitle="Manage your listings, stock and incoming orders."
    >
      <LoginForm role={Role.STORE} forgotHint />
    </AuthShell>
  );
}

export function AdminLoginPage() {
  return (
    <AuthShell
      portal="admin"
      title="Admin console"
      subtitle="Authorised platform administrators only."
    >
      <LoginForm role={Role.ADMIN} />
    </AuthShell>
  );
}
