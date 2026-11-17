/**
 * Pure, immutable playback-queue engine. Platform audio adapters (HTMLAudioElement on web,
 * expo-audio on mobile) are driven by this state; it contains no I/O.
 */

export interface QueueItem {
  /** Unique per queue entry (the same track may appear twice). */
  entryId: string;
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl?: string | null;
  durationMs?: number | null;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueState {
  /** Items in their original (unshuffled) order. */
  items: QueueItem[];
  /** Play order as indexes into `items`. Identity when shuffle is off. */
  order: number[];
  /** Position within `order` of the current item, or -1 when nothing is loaded. */
  position: number;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Entry ids of previously played items, most recent last (bounded). */
  history: string[];
}

export const HISTORY_LIMIT = 100;

export type RandomFn = () => number;

export type QueueAction =
  | { type: 'load'; items: QueueItem[]; startIndex?: number; random?: RandomFn }
  | { type: 'next'; auto?: boolean }
  | { type: 'previous' }
  | { type: 'jump'; entryId: string }
  | { type: 'enqueue'; items: QueueItem[] }
  | { type: 'playNext'; items: QueueItem[] }
  | { type: 'remove'; entryId: string }
  | { type: 'setRepeat'; repeat: RepeatMode }
  | { type: 'cycleRepeat' }
  | { type: 'setShuffle'; shuffle: boolean; random?: RandomFn }
  | { type: 'clear' };

export function createQueueState(): QueueState {
  return { items: [], order: [], position: -1, repeat: 'off', shuffle: false, history: [] };
}

export function currentItem(state: QueueState): QueueItem | null {
  if (state.position < 0) return null;
  const index = state.order[state.position];
  return index === undefined ? null : (state.items[index] ?? null);
}

/** Items that will play after the current one, in play order. */
export function upcoming(state: QueueState): QueueItem[] {
  return state.order
    .slice(state.position + 1)
    .map((i) => state.items[i])
    .filter((item): item is QueueItem => item !== undefined);
}

export function hasNext(state: QueueState): boolean {
  if (state.position < 0) return false;
  return state.repeat !== 'off' || state.position < state.order.length - 1;
}

const identity = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Fisher–Yates shuffle that keeps `pinned` (if given) at the front. */
function shuffledOrder(length: number, random: RandomFn, pinned?: number): number[] {
  const rest = identity(length).filter((i) => i !== pinned);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return pinned === undefined ? rest : [pinned, ...rest];
}

function pushHistory(state: QueueState): string[] {
  const item = currentItem(state);
  if (!item) return state.history;
  const history = [...state.history, item.entryId];
  return history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history;
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'load': {
      if (action.items.length === 0)
        return { ...createQueueState(), repeat: state.repeat, shuffle: state.shuffle };
      const start = Math.min(Math.max(action.startIndex ?? 0, 0), action.items.length - 1);
      const order = state.shuffle
        ? shuffledOrder(action.items.length, action.random ?? Math.random, start)
        : identity(action.items.length);
      return {
        ...state,
        items: [...action.items],
        order,
        position: state.shuffle ? 0 : start,
        history: pushHistory(state),
      };
    }

    case 'next': {
      if (state.position < 0) return state;
      // Automatic advance at track end honours repeat-one; a user "skip" always moves on.
      if (action.auto && state.repeat === 'one') return state;
      const atEnd = state.position >= state.order.length - 1;
      if (atEnd) {
        if (state.repeat === 'off') return state;
        return { ...state, position: 0, history: pushHistory(state) };
      }
      return { ...state, position: state.position + 1, history: pushHistory(state) };
    }

    case 'previous': {
      if (state.position < 0) return state;
      if (state.position === 0) {
        return state.repeat === 'all' ? { ...state, position: state.order.length - 1 } : state;
      }
      return { ...state, position: state.position - 1 };
    }

    case 'jump': {
      const itemIndex = state.items.findIndex((i) => i.entryId === action.entryId);
      if (itemIndex < 0) return state;
      const position = state.order.indexOf(itemIndex);
      return { ...state, position, history: pushHistory(state) };
    }

    case 'enqueue': {
      if (action.items.length === 0) return state;
      const base = state.items.length;
      const items = [...state.items, ...action.items];
      const order = [...state.order, ...action.items.map((_, i) => base + i)];
      return { ...state, items, order, position: state.position < 0 ? 0 : state.position };
    }

    case 'playNext': {
      if (action.items.length === 0) return state;
      if (state.position < 0) return queueReducer(state, { type: 'enqueue', items: action.items });
      const base = state.items.length;
      const items = [...state.items, ...action.items];
      const inserted = action.items.map((_, i) => base + i);
      const order = [
        ...state.order.slice(0, state.position + 1),
        ...inserted,
        ...state.order.slice(state.position + 1),
      ];
      return { ...state, items, order };
    }

    case 'remove': {
      const removeIndex = state.items.findIndex((i) => i.entryId === action.entryId);
      if (removeIndex < 0) return state;
      const removePosition = state.order.indexOf(removeIndex);
      const items = state.items.filter((_, i) => i !== removeIndex);
      const order = state.order
        .filter((i) => i !== removeIndex)
        .map((i) => (i > removeIndex ? i - 1 : i));
      let position = state.position;
      if (removePosition < state.position) position -= 1;
      if (position >= order.length) position = order.length - 1;
      if (items.length === 0) position = -1;
      return { ...state, items, order, position };
    }

    case 'setRepeat':
      return { ...state, repeat: action.repeat };

    case 'cycleRepeat': {
      const nextMode: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
      return { ...state, repeat: nextMode[state.repeat] };
    }

    case 'setShuffle': {
      if (action.shuffle === state.shuffle) return state;
      const currentIndex = state.position >= 0 ? state.order[state.position] : undefined;
      if (action.shuffle) {
        const order = shuffledOrder(state.items.length, action.random ?? Math.random, currentIndex);
        return { ...state, shuffle: true, order, position: currentIndex === undefined ? -1 : 0 };
      }
      const order = identity(state.items.length);
      return {
        ...state,
        shuffle: false,
        order,
        position: currentIndex === undefined ? -1 : currentIndex,
      };
    }

    case 'clear':
      return {
        ...createQueueState(),
        repeat: state.repeat,
        shuffle: state.shuffle,
        history: state.history,
      };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
