import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert, Avatar, Button, Checkbox, EmptyState, initials, TextField } from './index';

describe('Button', () => {
  it('defaults to type=button and handles clicks', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Play</Button>);
    const button = screen.getByRole('button', { name: 'Play' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and busy while loading', async () => {
    const onClick = jest.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('associates label, hint and error for assistive tech', () => {
    const { rerender } = render(<TextField label="Email" hint="We never share it" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never share it');
    expect(input).not.toBeInvalid();
    rerender(<TextField label="Email" hint="We never share it" error="Enter a valid email" />);
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email');
  });
});

describe('Checkbox', () => {
  it('toggles via its label', async () => {
    render(<Checkbox label="I accept the terms" />);
    const box = screen.getByRole('checkbox', { name: 'I accept the terms' });
    await userEvent.click(screen.getByText('I accept the terms'));
    expect(box).toBeChecked();
  });
});

describe('Alert', () => {
  it('uses role=alert for danger and role=status for info', () => {
    const { rerender } = render(<Alert tone="danger" title="Failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    rerender(<Alert tone="info" title="Saved" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});

describe('Avatar', () => {
  it('derives initials and exposes an accessible name', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  cher ')).toBe('C');
    expect(initials('')).toBe('?');
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(<EmptyState title="No sessions" description="Nothing here yet" action={<Button>Refresh</Button>} />);
    expect(screen.getByRole('heading', { name: 'No sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
