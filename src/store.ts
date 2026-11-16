// Estado global: ajustes, progreso, canciones importadas y navegación.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { SongDoc } from './engine/song';
import type { Notation } from './engine/theory';

export interface Settings {
  input: 'mic' | 'midi' | 'none';
  micDeviceId: string;
  sensitivity: number;
  octaveTolerant: boolean;
  chordTolerance: boolean;
  headphones: boolean;
  keys: number;
  notation: Notation;
  micLatencyMs: number;
  fallSeconds: number;
  labels: boolean;
  onboarded: boolean;
  name: string;
}

export interface SessionRec { date: string; songId: string; title: string; mode: string; accuracy: number; seconds: number }

export interface Progress {
  sessions: SessionRec[];
  best: Record<string, number>; // songId → mejor precisión
  lessons: Record<string, number>; // lessonId → estrellas
  days: Record<string, number>; // AAAA-MM-DD → segundos
  lastSongId: string | null;
}

export type Page = 'home' | 'course' | 'songs' | 'practice' | 'tools' | 'progress' | 'settings';
export interface PracticeTarget { song: SongDoc; lessonId?: string; mode?: 'watch' | 'wait' | 'realtime' }

interface State {
  settings: Settings;
  progress: Progress;
  imported: SongDoc[];
  page: Page;
  target: PracticeTarget | null;
  toast: string | null;
  set(p: Partial<Settings>): void;
  go(page: Page): void;
  practice(t: PracticeTarget): void;
  addSong(s: SongDoc): void;
  removeSong(id: string): void;
  loadSongs(): Promise<void>;
  addTime(seconds: number): void;
  record(r: Omit<SessionRec, 'date'>, lessonId?: string): void;
  resetAll(): void;
  notify(msg: string | null): void;
}

const defaultSettings: Settings = {
  input: 'mic', micDeviceId: '', sensitivity: 0.6, octaveTolerant: true, chordTolerance: true, headphones: false,
  keys: 61, notation: 'latin', micLatencyMs: 120, fallSeconds: 3, labels: true, onboarded: false, name: '',
};
const emptyProgress: Progress = { sessions: [], best: {}, lessons: {}, days: {}, lastSongId: null };

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const starsFor = (accuracy: number) => (accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.5 ? 1 : 0);

export function streakOf(days: Record<string, number>): number {
  let n = 0;
  const d = new Date();
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!days[key(d)]) d.setDate(d.getDate() - 1); // hoy aún no cuenta en contra
  while (days[key(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      progress: emptyProgress,
      imported: [],
      page: 'home',
      target: null,
      toast: null,
      set: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      go: (page) => set({ page }),
      practice: (target) => set((s) => ({ target, page: 'practice', progress: { ...s.progress, lastSongId: target.lessonId ? s.progress.lastSongId : target.song.id } })),
      addSong: (song) => {
        const imported = [song, ...get().imported.filter((x) => x.id !== song.id)];
        set({ imported });
        void idbSet('songs', imported);
      },
      removeSong: (id) => {
        const imported = get().imported.filter((x) => x.id !== id);
        set({ imported });
        void idbSet('songs', imported);
      },
      loadSongs: async () => {
        try { const v = await idbGet<SongDoc[]>('songs'); if (Array.isArray(v)) set({ imported: v }); } catch { /* sin IndexedDB */ }
      },
      addTime: (seconds) => set((s) => {
        const k = today();
        return { progress: { ...s.progress, days: { ...s.progress.days, [k]: (s.progress.days[k] ?? 0) + seconds } } };
      }),
      record: (r, lessonId) => set((s) => {
        const p = s.progress;
        const lessons = lessonId ? { ...p.lessons, [lessonId]: Math.max(p.lessons[lessonId] ?? 0, starsFor(r.accuracy)) } : p.lessons;
        return {
          progress: {
            ...p,
            lessons,
            sessions: [{ ...r, date: new Date().toISOString() }, ...p.sessions].slice(0, 200),
            best: { ...p.best, [r.songId]: Math.max(p.best[r.songId] ?? 0, r.accuracy) },
          },
        };
      }),
      resetAll: () => { set({ settings: defaultSettings, progress: emptyProgress, imported: [] }); void idbSet('songs', []); },
      notify: (toast) => set({ toast }),
    }),
    { name: 'piano-app', partialize: (s) => ({ settings: s.settings, progress: s.progress }) },
  ),
);
