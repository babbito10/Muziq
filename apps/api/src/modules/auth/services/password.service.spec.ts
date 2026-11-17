import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hashed = await service.hash('correct horse battery');
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hashed, 'correct horse battery')).resolves.toBe(true);
    await expect(service.verify(hashed, 'wrong password')).resolves.toBe(false);
  });

  it('treats malformed hashes as a mismatch', async () => {
    await expect(service.verify('not-a-hash', 'x')).resolves.toBe(false);
  });

  it('dummy verification always fails', async () => {
    await expect(service.verifyDummy('anything')).resolves.toBe(false);
  });
});
