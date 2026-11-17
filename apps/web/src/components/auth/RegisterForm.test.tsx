import { ApiError } from '@musicverse/api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './RegisterForm';

const register = jest.fn();
jest.mock('@/lib/auth-context', () => ({ useAuth: () => ({ register }) }));

beforeEach(() => jest.resetAllMocks());

describe('RegisterForm', () => {
  it('requires accepting the terms and a strong enough password', async () => {
    render(<RegisterForm onSuccess={jest.fn()} />);
    await userEvent.type(screen.getByLabelText(/display name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('You must accept the terms to create an account')).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInvalid();
    expect(register).not.toHaveBeenCalled();
  });

  it('submits valid details', async () => {
    const onSuccess = jest.fn();
    register.mockResolvedValue(undefined);
    render(<RegisterForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(/display name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'correct horse battery');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(register).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'correct horse battery',
      displayName: 'Ada',
      acceptTerms: true,
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('maps server-side field errors onto inputs', async () => {
    register.mockRejectedValue(
      new ApiError({
        code: 'VALIDATION_FAILED',
        status: 400,
        message: 'Some fields are invalid.',
        details: [{ path: 'email', message: 'Email domain not allowed' }],
      }),
    );
    render(<RegisterForm onSuccess={jest.fn()} />);
    await userEvent.type(screen.getByLabelText(/display name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'correct horse battery');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Email domain not allowed')).toBeInTheDocument();
  });
});
