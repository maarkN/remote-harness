import { create } from 'zustand'
import type { Notice } from './select'

type NoticesStore = {
  /** The notice shown, the newest one; `null` when none. */
  current: Notice | null
  /** The session on screen, kept by the main layout: its own events get no notice. */
  onScreen: string | null
  show(notice: Notice): void
  /** Hides `id` (a stale timer must not hide a newer notice); without an id, whatever is shown. */
  dismiss(id?: string): void
}

export const useNoticesStore = create<NoticesStore>((set) => ({
  current: null,
  onScreen: null,
  show: (notice) => set({ current: notice }),
  dismiss: (id) => set((state) => (id === undefined || state.current?.id === id ? { current: null } : state)),
}))
