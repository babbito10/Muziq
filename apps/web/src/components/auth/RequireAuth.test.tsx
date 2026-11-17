import { render, screen } from '@testing-library/react';
import { RequireAuth } from './RequireAuth';

const replace = jest.fn();
let auth: { status: string; anonymousReason: string };
jest.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/account',
}));

beforeEach(() => replace.mockReset());

describe('RequireAuth', () => {
  it('renders children when authenticated', () => {
    auth = { status: 'authenticated', anonymousReason: 'no_session' };
    render(<RequireAuth>secret</RequireAuth>);
    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows a loading state, never the content, while the session is restored', () => {
    auth = { status: 'loading', anonymousReason: 'no_session' };
    render(<RequireAuth>secret</RequireAuth>);
    expect(screen.queryByText('secret')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your account');
  });

  it('sends visitors without a session to sign in and back', () => {
    auth = { status: 'anonymous', anonymousReason: 'no_session' };
    render(<RequireAuth>secret</RequireAuth>);
    expect(replace).toHaveBeenCalledWith('/login?next=%2Faccount');
  });

  it('sends a deliberate sign-out home', () => {
    auth = { status: 'anonymous', anonymousReason: 'signed_out' };
    render(<RequireAuth>secret</RequireAuth>);
    expect(replace).toHaveBeenCalledWith('/');
  });
});
