import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test/utils';
import { RegisterForm } from './RegisterForm';
import { mockUser } from '../../test/mocks';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../api/auth', () => ({
  register: vi.fn(),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      login: vi.fn(),
    })
  ),
}));

import * as authApi from '../../api/auth';

// Helper to get form inputs
const getFormInputs = () => {
  const inputs = document.querySelectorAll('input');
  return {
    emailInput: inputs[0] as HTMLInputElement,
    usernameInput: inputs[1] as HTMLInputElement,
    displayNameInput: inputs[2] as HTMLInputElement,
    passwordInput: inputs[3] as HTMLInputElement,
  };
};

describe('RegisterForm', () => {
  const mockOnSwitchToLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form with all fields', () => {
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(screen.getByText('Create an Account')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('has required fields for email, username, and password', () => {
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { emailInput, usernameInput, passwordInput } = getFormInputs();

    expect(emailInput).toBeRequired();
    expect(usernameInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('display name is optional', () => {
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { displayNameInput } = getFormInputs();
    expect(displayNameInput).not.toBeRequired();
  });

  it('password has minimum length requirement', () => {
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { passwordInput } = getFormInputs();
    expect(passwordInput).toHaveAttribute('minLength', '6');
  });

  it('allows typing in all fields', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { emailInput, usernameInput, displayNameInput, passwordInput } = getFormInputs();

    await user.type(emailInput, 'test@example.com');
    await user.type(usernameInput, 'testuser');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(usernameInput).toHaveValue('testuser');
    expect(displayNameInput).toHaveValue('Test User');
    expect(passwordInput).toHaveValue('password123');
  });

  it('calls onSwitchToLogin when clicking sign in link', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    await user.click(screen.getByText('Sign in'));

    expect(mockOnSwitchToLogin).toHaveBeenCalledTimes(1);
  });

  it('submits form and navigates on success', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockResolvedValueOnce({
      user: mockUser,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { emailInput, usernameInput, displayNameInput, passwordInput } = getFormInputs();

    await user.type(emailInput, 'test@example.com');
    await user.type(usernameInput, 'testuser');
    await user.type(displayNameInput, 'Test User');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { emailInput, usernameInput, passwordInput } = getFormInputs();

    await user.type(emailInput, 'test@example.com');
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('displays error message on registration failure', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockRejectedValueOnce(new Error('Email already exists'));

    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { emailInput, usernameInput, passwordInput } = getFormInputs();

    await user.type(emailInput, 'existing@example.com');
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('displays generic error for non-Error exceptions', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockRejectedValueOnce('something went wrong');

    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);
    const { emailInput, usernameInput, passwordInput } = getFormInputs();

    await user.type(emailInput, 'test@example.com');
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });
  });
});
