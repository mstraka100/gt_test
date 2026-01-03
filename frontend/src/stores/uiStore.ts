import { create } from 'zustand';

type ViewType = 'channel' | 'dm' | 'none';

interface UIState {
  currentView: ViewType;
  currentChannelId: string | null;
  currentDMId: string | null;
  sidebarOpen: boolean;

  setCurrentChannel: (id: string) => void;
  setCurrentDM: (id: string) => void;
  clearSelection: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'none',
  currentChannelId: null,
  currentDMId: null,
  sidebarOpen: true,

  setCurrentChannel: (id) =>
    set({
      currentView: 'channel',
      currentChannelId: id,
      currentDMId: null,
    }),

  setCurrentDM: (id) =>
    set({
      currentView: 'dm',
      currentChannelId: null,
      currentDMId: id,
    }),

  clearSelection: () =>
    set({
      currentView: 'none',
      currentChannelId: null,
      currentDMId: null,
    }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
