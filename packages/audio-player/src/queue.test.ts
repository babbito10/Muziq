import { clampVolume, formatDuration } from './adapter';
import {
  createQueueState,
  currentItem,
  hasNext,
  queueReducer,
  upcoming,
  type QueueItem,
  type QueueState,
} from './queue';

const item = (n: number): QueueItem => ({
  entryId: `e${n}`,
  trackId: `t${n}`,
  title: `Track ${n}`,
  artistName: 'Artist',
});
const items = [1, 2, 3, 4].map(item);
const ids = (state: QueueState) => upcoming(state).map((i) => i.entryId);
// Deterministic "random" that always picks index 0 → reverses remaining items in Fisher–Yates.
const zero = () => 0;

function loaded(startIndex = 0): QueueState {
  return queueReducer(createQueueState(), { type: 'load', items, startIndex });
}

describe('queueReducer', () => {
  it('loads items and starts at the requested index', () => {
    const s = loaded(2);
    expect(currentItem(s)?.entryId).toBe('e3');
    expect(ids(s)).toEqual(['e4']);
  });

  it('stops at the end with repeat off, wraps with repeat all', () => {
    let s = loaded(3);
    expect(hasNext(s)).toBe(false);
    expect(queueReducer(s, { type: 'next' })).toBe(s);
    s = queueReducer(s, { type: 'setRepeat', repeat: 'all' });
    expect(currentItem(queueReducer(s, { type: 'next' }))?.entryId).toBe('e1');
  });

  it('repeat one holds on auto-advance but allows manual skip', () => {
    const s = queueReducer(loaded(0), { type: 'setRepeat', repeat: 'one' });
    expect(currentItem(queueReducer(s, { type: 'next', auto: true }))?.entryId).toBe('e1');
    expect(currentItem(queueReducer(s, { type: 'next' }))?.entryId).toBe('e2');
  });

  it('records history on advance', () => {
    const s = queueReducer(queueReducer(loaded(0), { type: 'next' }), { type: 'next' });
    expect(s.history).toEqual(['e1', 'e2']);
  });

  it('goes to previous and wraps only with repeat all', () => {
    const s = loaded(0);
    expect(queueReducer(s, { type: 'previous' })).toBe(s);
    const r = queueReducer(s, { type: 'setRepeat', repeat: 'all' });
    expect(currentItem(queueReducer(r, { type: 'previous' }))?.entryId).toBe('e4');
  });

  it('shuffles keeping the current track first and restores order when unshuffled', () => {
    const s = queueReducer(loaded(1), { type: 'setShuffle', shuffle: true, random: zero });
    expect(currentItem(s)?.entryId).toBe('e2');
    expect(s.order).toHaveLength(4);
    expect(new Set(s.order).size).toBe(4);
    const u = queueReducer(s, { type: 'setShuffle', shuffle: false });
    expect(currentItem(u)?.entryId).toBe('e2');
    expect(ids(u)).toEqual(['e3', 'e4']);
  });

  it('plays next and enqueues', () => {
    let s = queueReducer(loaded(0), { type: 'playNext', items: [item(9)] });
    expect(ids(s)).toEqual(['e9', 'e2', 'e3', 'e4']);
    s = queueReducer(s, { type: 'enqueue', items: [item(10)] });
    expect(ids(s).at(-1)).toBe('e10');
  });

  it('removes items and keeps the current track stable', () => {
    let s = loaded(2);
    s = queueReducer(s, { type: 'remove', entryId: 'e1' });
    expect(currentItem(s)?.entryId).toBe('e3');
    s = queueReducer(s, { type: 'remove', entryId: 'e3' });
    expect(currentItem(s)?.entryId).toBe('e4');
    s = queueReducer(s, { type: 'remove', entryId: 'e4' });
    expect(currentItem(s)?.entryId).toBe('e2');
  });

  it('becomes empty after removing all items', () => {
    let s = queueReducer(createQueueState(), { type: 'load', items: [item(1)] });
    s = queueReducer(s, { type: 'remove', entryId: 'e1' });
    expect(currentItem(s)).toBeNull();
    expect(s.position).toBe(-1);
  });

  it('jumps to an entry', () => {
    const s = queueReducer(loaded(0), { type: 'jump', entryId: 'e4' });
    expect(currentItem(s)?.entryId).toBe('e4');
  });

  it('cycles repeat modes', () => {
    let s = createQueueState();
    s = queueReducer(s, { type: 'cycleRepeat' });
    expect(s.repeat).toBe('all');
    s = queueReducer(s, { type: 'cycleRepeat' });
    expect(s.repeat).toBe('one');
    s = queueReducer(s, { type: 'cycleRepeat' });
    expect(s.repeat).toBe('off');
  });
});

describe('adapter helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(61_000)).toBe('1:01');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(null)).toBe('0:00');
  });

  it('clamps volume', () => {
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(1);
  });
});
