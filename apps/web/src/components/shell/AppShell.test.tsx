import { render, screen, within } from '@testing-library/react';
import { AppShell } from './AppShell';

const auth = { status: 'anonymous', user: null, logout: jest.fn() };
jest.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
jest.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('AppShell', () => {
  it('links only to modules that exist and marks the rest as disabled', () => {
    render(<AppShell>content</AppShell>);
    const desktopNav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
    const home = within(desktopNav).getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(within(desktopNav).queryByRole('link', { name: /marketplace/i })).toBeNull();
    const marketplace = within(desktopNav).getByText('Marketplace').closest('[aria-disabled="true"]');
    expect(marketplace).not.toBeNull();
    expect(marketplace).toHaveAttribute('title', 'Marketplace arrives in Phase 5');
  });

  it('offers sign-in and registration to anonymous visitors and a skip link', () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });
});
