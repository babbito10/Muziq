import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserDetail } from './UserDetail';

const me = { id: 'admin-1', roles: ['listener', 'admin'] };
jest.mock('@/lib/auth-context', () => ({
  useAdminAuth: () => ({ user: me, can: (p: string) => p !== 'admin:roles.manage_staff' }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const target = {
  id: 'user-1',
  email: 'u@example.com',
  displayName: 'U',
  status: 'active',
  emailVerified: true,
  roles: ['listener'],
  createdAt: new Date().toISOString(),
  lastLoginAt: null,
  mfaEnabled: false,
  activeSessions: 1,
  linkedProviders: [],
};
const getUser = jest.fn();
const grantRole = jest.fn();
const suspend = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    admin: {
      getUser: (...a: unknown[]) => getUser(...a),
      grantRole: (...a: unknown[]) => grantRole(...a),
      suspend: (...a: unknown[]) => suspend(...a),
    },
  },
}));

beforeEach(() => {
  jest.resetAllMocks();
  getUser.mockResolvedValue(target);
});

describe('UserDetail', () => {
  it('only offers role changes the admin is allowed to make', async () => {
    render(<UserDetail id="user-1" />);
    expect(await screen.findByRole('button', { name: 'Grant Moderator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grant Artist' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant Administrator' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Grant Super administrator' })).toBeNull();
  });

  it('grants a role and requires a reason to suspend', async () => {
    grantRole.mockResolvedValue({ ...target, roles: ['listener', 'moderator'] });
    suspend.mockResolvedValue({ ...target, status: 'suspended' });
    render(<UserDetail id="user-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Grant Moderator' }));
    expect(grantRole).toHaveBeenCalledWith('user-1', { role: 'moderator' });
    expect(await screen.findByRole('button', { name: 'Revoke Moderator' })).toBeInTheDocument();

    const suspendButton = screen.getByRole('button', { name: 'Suspend' });
    expect(suspendButton).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText('Reason (recorded in the audit log)'),
      'Spam uploads',
    );
    await userEvent.click(suspendButton);
    expect(suspend).toHaveBeenCalledWith('user-1', { reason: 'Spam uploads' });
    expect(await screen.findByRole('button', { name: 'Reinstate' })).toBeInTheDocument();
  });

  it('shows load errors', async () => {
    getUser.mockRejectedValue(new Error('x'));
    render(<UserDetail id="user-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
