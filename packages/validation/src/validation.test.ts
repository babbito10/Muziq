import {
  adminListUsersQuerySchema,
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  registerSchema,
  toValidationIssues,
  updateProfileSchema,
  usernameSchema,
} from './index';

describe('registerSchema', () => {
  const valid = {
    email: '  Ada@Example.COM ',
    password: 'correct horse battery',
    displayName: 'Ada',
    acceptTerms: true,
  };

  it('normalises email and defaults client type', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('ada@example.com');
    expect(parsed.clientType).toBe('web');
  });

  it('rejects short and common passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'Password123' }).success).toBe(false);
  });

  it('requires accepting terms', () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('does not enforce password strength', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('rejects reusing the current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'a long password!!',
      newPassword: 'a long password!!',
    });
    expect(result.success).toBe(false);
  });
});

describe('usernameSchema', () => {
  it.each(['ada', 'ada.lovelace', 'dj_kim2'])('accepts %s', (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(true);
  });
  it.each(['ab', '.ada', 'ada.', 'ada lovelace', 'ada!'])('rejects %s', (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('requires at least one field', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ countryCode: 'ke' }).data).toEqual({
      countryCode: 'KE',
    });
  });
});

describe('adminListUsersQuerySchema', () => {
  it('coerces and bounds limit', () => {
    expect(adminListUsersQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(adminListUsersQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('issue helpers', () => {
  it('maps zod errors to field errors', () => {
    const result = registerSchema.safeParse({
      email: 'nope',
      password: 'x',
      displayName: '',
      acceptTerms: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(toValidationIssues(result.error));
    expect(Object.keys(errors).sort()).toEqual(['displayName', 'email', 'password']);
  });
});
