/**
 * Demo accounts created by `npm run db:seed`. Shared so the sign-in pages can offer one-click
 * demo logins. All data is fictional. The seed refuses to run in production.
 */
export const DEMO_PASSWORD = 'Demo@1234';

export interface DemoAccount {
  label: string;
  email: string;
  description?: string;
}

export const DEMO_ACCOUNTS: Readonly<
  Record<'ADMIN' | 'CUSTOMER' | 'STORE' | 'DRIVER', readonly DemoAccount[]>
> = {
  ADMIN: [{ label: 'Platform admin', email: 'admin@demo.test' }],
  CUSTOMER: [
    { label: 'Thandi Mokoena', email: 'thandi@demo.test', description: 'Malamulele' },
    { label: 'Sipho Baloyi', email: 'sipho@demo.test', description: 'Giyani' },
    { label: 'Lerato Molefe', email: 'lerato@demo.test', description: 'Polokwane' },
  ],
  STORE: [
    { label: 'Malamulele Hardware', email: 'owner.malamulele@demo.test' },
    { label: 'Polokwane Build Centre', email: 'owner.polokwane@demo.test' },
    { label: 'Limpopo Builders Warehouse', email: 'owner.limpopo@demo.test' },
    { label: 'Township Hardware', email: 'owner.township@demo.test' },
    { label: 'ProBuild Hardware', email: 'owner.probuild@demo.test' },
  ],
  DRIVER: [
    { label: 'Themba (motorcycle)', email: 'driver.moto@demo.test' },
    { label: 'Nomsa (car)', email: 'driver.car@demo.test' },
    { label: 'Kagiso (bakkie)', email: 'driver.bakkie1@demo.test' },
    { label: 'Mpho (bakkie)', email: 'driver.bakkie2@demo.test' },
    { label: 'Sello (panel van)', email: 'driver.van@demo.test' },
    { label: 'Johannes (truck)', email: 'driver.truck@demo.test' },
    {
      label: 'Pending approval',
      email: 'driver.pending@demo.test',
      description: 'Awaiting admin review',
    },
  ],
};
