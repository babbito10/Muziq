import { isApiErrorBody } from './errors';
import { isCapabilityRole, isRoleKey, ROLE_KEYS } from './roles';

describe('isApiErrorBody', () => {
  it('accepts a well-formed error envelope', () => {
    expect(
      isApiErrorBody({
        error: { code: 'NOT_FOUND', message: 'Missing', details: null, requestId: 'r1' },
      }),
    ).toBe(true);
  });

  it.each([null, undefined, 'x', {}, { error: null }, { error: { code: 1, message: 'x' } }])(
    'rejects %p',
    (value) => {
      expect(isApiErrorBody(value)).toBe(false);
    },
  );
});

describe('role guards', () => {
  it('recognises every role key', () => {
    for (const key of ROLE_KEYS) expect(isRoleKey(key)).toBe(true);
    expect(isRoleKey('root')).toBe(false);
  });

  it('only treats self-service roles as capabilities', () => {
    expect(isCapabilityRole('artist')).toBe(true);
    expect(isCapabilityRole('admin')).toBe(false);
    expect(isCapabilityRole('listener')).toBe(false);
  });
});
