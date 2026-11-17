import type { Paginated } from '@musicverse/types';
import { AppError } from '../errors/app-error';

/** Opaque cursor wrapping a row id (rows are ordered by `createdAt desc, id desc`). */
export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      id?: unknown;
    };
    if (typeof parsed.id === 'string' && /^[0-9a-f-]{36}$/i.test(parsed.id)) return parsed.id;
  } catch {
    // fall through
  }
  throw AppError.badRequest('VALIDATION_FAILED', 'Invalid pagination cursor.', [
    { path: 'cursor', message: 'Invalid pagination cursor' },
  ]);
}

/** Prisma args for a page: fetch `limit + 1` rows to know whether another page exists. */
export function pageArgs(limit: number, cursor: string | undefined) {
  const id = decodeCursor(cursor);
  return {
    take: limit + 1,
    ...(id ? { cursor: { id }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  };
}

export function toPage<Row extends { id: string }, Out>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Out,
): Paginated<Out> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    data: pageRows.map(map),
    page: { nextCursor: hasMore && last ? encodeCursor(last.id) : null, limit },
  };
}
