'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Site = { id: string; name: string; code: string };

interface SiteStore {
  currentSite: Site | null;
  sites: Site[];
  setCurrentSite: (s: Site) => void;
  setSites: (list: Site[]) => void;
}

/**
 * Tracks the user's current site and their accessible site list.
 * Persisted to localStorage under `gei:site` so a refresh or new tab
 * keeps the selection. Cleared implicitly on sign-out when the next
 * fetch returns zero sites.
 *
 * Every data-fetch hook in the app reads `currentSite.id` from this
 * store and scopes queries. If it's null, the app shows a "no access"
 * screen instead of issuing site-less queries.
 */
export const useSiteStore = create<SiteStore>()(
  persist(
    (set) => ({
      currentSite: null,
      sites: [],
      setCurrentSite: (s) => set({ currentSite: s }),
      setSites: (list) => set({ sites: list }),
    }),
    { name: 'gei:site' },
  ),
);
