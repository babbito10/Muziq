import { AppError } from '../errors/app-error';
import { decodeCursor, encodeCursor, pageArgs, toPage } from './cursor';

const id = '7d9f2c1e-6a1b-4c3d-9e8f-0a1b2c3d4e5f';

describe('cursor pagination', () => {
  it('round-trips cursors', () => {
    expect(decodeCursor(encodeCursor(id))).toBe(id);
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('rejects tampered cursors', () => {
    expect(() => decodeCursor('garbage')).toThrow(AppError);
    expect(() => decodeCursor(Buffer.from('{"id":"1; drop"}').toString('base64url'))).toThrow(AppError);
  });

  it('builds prisma args', () => {
    expect(pageArgs(10, undefined)).toMatchObject({ take: 11 });
    expect(pageArgs(10, encodeCursor(id))).toMatchObject({ take: 11, skip: 1, cursor: { id } });
  });

  it('computes next cursor only when more rows exist', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = toPage(rows, 2, (r) => r.id);
    expect(page.data).toEqual(['a', 'b']);
    expect(page.page.nextCursor).toBe(encodeCursor('b'));
    expect(toPage(rows.slice(0, 2), 2, (r) => r.id).page.nextCursor).toBeNull();
  });
});
