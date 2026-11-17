import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapabilitiesSection } from './CapabilitiesSection';

const setUser = jest.fn();
let user: Record<string, unknown>;
jest.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user, setUser }) }));
const addCapability = jest.fn();
const removeCapability = jest.fn();
jest.mock('@/lib/api', () => ({ api: { users: { addCapability: (...a: unknown[]) => addCapability(...a), removeCapability: (...a: unknown[]) => removeCapability(...a) } } }));

beforeEach(() => {
  jest.resetAllMocks();
  user = { emailVerified: true, roles: ['listener', 'producer'] };
});

describe('CapabilitiesSection', () => {
  it('disables adding capabilities until the email is verified', () => {
    user = { emailVerified: false, roles: ['listener'] };
    render(<CapabilitiesSection />);
    expect(screen.getByText('Verify your email to add creator capabilities.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Artist capability' })).toBeDisabled();
  });

  it('adds and removes capabilities', async () => {
    addCapability.mockResolvedValue({ roles: ['artist', 'listener', 'producer'] });
    removeCapability.mockResolvedValue({ roles: ['listener'] });
    render(<CapabilitiesSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Artist capability' }));
    expect(addCapability).toHaveBeenCalledWith({ role: 'artist' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove Producer capability' }));
    expect(removeCapability).toHaveBeenCalledWith('producer');
    expect(setUser).toHaveBeenCalledTimes(2);
  });

  it('shows API errors', async () => {
    addCapability.mockRejectedValue(new Error('boom'));
    render(<CapabilitiesSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Add DJ capability' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
