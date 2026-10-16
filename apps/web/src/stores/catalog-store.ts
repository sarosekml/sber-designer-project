import { create } from 'zustand';
import type { ComponentCatalog } from '@sber-designer/shared-types';

interface CatalogStoreState {
  catalog: ComponentCatalog | null;
  loading: boolean;
  error: string | null;
  /**
   * Bypass-cache reload. Wired by useCatalog at mount; null when no
   * sandbox is connected.
   */
  refresh: (() => Promise<void>) | null;

  setCatalog: (catalog: ComponentCatalog | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRefresh: (refresh: (() => Promise<void>) | null) => void;
}

export const useCatalogStore = create<CatalogStoreState>((set) => ({
  catalog: null,
  loading: false,
  error: null,
  refresh: null,
  setCatalog: (catalog) => set({ catalog, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setRefresh: (refresh) => set({ refresh }),
}));
