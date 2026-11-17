/**
 * Contract every platform audio adapter implements (web: HTMLAudioElement / MSE+HLS;
 * mobile: expo-audio). Adapters only play URLs issued by the streaming API (short-lived signed
 * URLs) — they never construct media URLs themselves.
 */
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  positionMs: number;
  durationMs: number | null;
  bufferedMs: number;
  volume: number;
  muted: boolean;
  error: string | null;
}

export interface AudioAdapter {
  load(source: { url: string; mimeType?: string }): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(positionMs: number): void;
  /** 0..1 */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  snapshot(): PlaybackSnapshot;
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
  destroy(): void;
}

export function clampVolume(volume: number): number {
  if (Number.isNaN(volume)) return 1;
  return Math.min(1, Math.max(0, volume));
}

/** Format milliseconds as m:ss or h:mm:ss for player UIs. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
