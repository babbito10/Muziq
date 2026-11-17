import { ApiError } from '@musicverse/api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

const login = jest.fn();
const completeMfa = jest.fn();
jest.mock('@/lib/auth-context', () => ({ useAuth: () => ({ login, completeMfa }) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => jest.resetAllMocks());

async function fill(email: string, password: string) {
  if (email) await userEvent.type(screen.getByLabelText(/email/i), email);
  if (password) await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  it('validates locally before calling the API', async () => {
    render(<LoginForm onSuccess={jest.fn()} />);
    await fill('not-an-email', '');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in and calls onSuccess', async () => {
    const onSuccess = jest.fn();
    login.mockResolvedValue({ mfaRequired: false });
    render(<LoginForm onSuccess={onSuccess} />);
    await fill('Ada@Example.com', 'secret');
    expect(login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret' });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows API errors', async () => {
    login.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CREDENTIALS',
        status: 401,
        message: 'Email or password is incorrect.',
      }),
    );
    render(<LoginForm onSuccess={jest.fn()} />);
    await fill('ada@example.com', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('asks for a TOTP code when MFA is required', async () => {
    const onSuccess = jest.fn();
    login.mockResolvedValue({ mfaRequired: true, mfaToken: 'challenge' });
    completeMfa.mockResolvedValue(undefined);
    render(<LoginForm onSuccess={onSuccess} />);
    await fill('ada@example.com', 'secret');
    const codeInput = await screen.findByLabelText('Authentication code');
    await userEvent.type(codeInput, '12a3456');
    expect(codeInput).toHaveValue('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(completeMfa).toHaveBeenCalledWith('challenge', '123456');
    expect(onSuccess).toHaveBeenCalled();
  });
});
