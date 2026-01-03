import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      currentView: 'none',
      currentChannelId: null,
      currentDMId: null,
      sidebarOpen: true,
    });
  });

  describe('initial state', () => {
    it('should have currentView as "none"', () => {
      expect(useUIStore.getState().currentView).toBe('none');
    });

    it('should have null channel and DM IDs', () => {
      const state = useUIStore.getState();
      expect(state.currentChannelId).toBeNull();
      expect(state.currentDMId).toBeNull();
    });

    it('should have sidebar open by default', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('setCurrentChannel', () => {
    it('should set current view to channel', () => {
      const { setCurrentChannel } = useUIStore.getState();

      setCurrentChannel('channel-123');

      const state = useUIStore.getState();
      expect(state.currentView).toBe('channel');
      expect(state.currentChannelId).toBe('channel-123');
    });

    it('should clear currentDMId when switching to channel', () => {
      useUIStore.setState({ currentDMId: 'dm-456' });

      const { setCurrentChannel } = useUIStore.getState();
      setCurrentChannel('channel-123');

      expect(useUIStore.getState().currentDMId).toBeNull();
    });
  });

  describe('setCurrentDM', () => {
    it('should set current view to dm', () => {
      const { setCurrentDM } = useUIStore.getState();

      setCurrentDM('dm-456');

      const state = useUIStore.getState();
      expect(state.currentView).toBe('dm');
      expect(state.currentDMId).toBe('dm-456');
    });

    it('should clear currentChannelId when switching to DM', () => {
      useUIStore.setState({ currentChannelId: 'channel-123' });

      const { setCurrentDM } = useUIStore.getState();
      setCurrentDM('dm-456');

      expect(useUIStore.getState().currentChannelId).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('should reset view to none', () => {
      useUIStore.setState({
        currentView: 'channel',
        currentChannelId: 'channel-123',
        currentDMId: 'dm-456',
      });

      const { clearSelection } = useUIStore.getState();
      clearSelection();

      const state = useUIStore.getState();
      expect(state.currentView).toBe('none');
      expect(state.currentChannelId).toBeNull();
      expect(state.currentDMId).toBeNull();
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar from open to closed', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);

      const { toggleSidebar } = useUIStore.getState();
      toggleSidebar();

      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it('should toggle sidebar from closed to open', () => {
      useUIStore.setState({ sidebarOpen: false });

      const { toggleSidebar } = useUIStore.getState();
      toggleSidebar();

      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });
});
