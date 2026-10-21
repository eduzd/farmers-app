import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Network from 'expo-network';
import { syncRecordsToServer, getPendingRecordsCount, addSyncListener, fullSync } from '@/offline/db/syncService';
import { useAuthStore } from '@/lib/authStore';

type SyncState = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncContextValue {
  syncState: SyncState;
  pendingCount: number;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
  isOnline: boolean;
}

const SyncContext = createContext<SyncContextValue>({
  syncState: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  triggerSync: async () => {},
  isOnline: true,
});

export function useSyncContext() {
  return useContext(SyncContext);
}

interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const syncInProgress = useRef(false);
  const syncInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkNetwork = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        setIsOnline(typeof navigator !== 'undefined' && navigator.onLine);
        return;
      }
      const state = await Network.getNetworkStateAsync();
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    } catch {
      setIsOnline(false);
    }
  }, []);

  const updatePendingCount = useCallback(async () => {
    const count = await getPendingRecordsCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncInProgress.current) return;
    
    syncInProgress.current = true;
    setSyncState('syncing');

    try {
      const result = await syncRecordsToServer();
      
      if (result.success) {
        setSyncState('success');
        setLastSyncedAt(new Date());
      } else if (result.errors > 0) {
        setSyncState('error');
      } else {
        setSyncState('idle');
      }
      
      await updatePendingCount();
    } catch (error) {
      setSyncState('error');
    } finally {
      syncInProgress.current = false;
      setTimeout(() => {
        if (syncState === 'success') {
          setSyncState('idle');
        }
      }, 3000);
    }
  }, [updatePendingCount, syncState]);

  useEffect(() => {
    checkNetwork();
    updatePendingCount();

    const unsubscribe = addSyncListener((status) => {
      if (status === 'syncing') setSyncState('syncing');
      else if (status === 'success') {
        setSyncState('success');
        setLastSyncedAt(new Date());
        updatePendingCount();
      } else if (status === 'error') setSyncState('error');
      else setSyncState('idle');
    });

    return () => {
      unsubscribe();
    };
  }, [checkNetwork, updatePendingCount]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        await checkNetwork();
        await updatePendingCount();
        if (isOnline && pendingCount > 0) {
          triggerSync();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkNetwork, updatePendingCount, isOnline, pendingCount, triggerSync]);

  useEffect(() => {
    syncInterval.current = setInterval(async () => {
      await checkNetwork();
      await updatePendingCount();
      
      if (isOnline && pendingCount > 0 && !syncInProgress.current) {
        triggerSync();
      }
    }, 60000);

    return () => {
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, [checkNetwork, updatePendingCount, isOnline, pendingCount, triggerSync]);

  useEffect(() => {
    if (!isOnline) {
      setSyncState('offline');
    } else if (syncState === 'offline') {
      setSyncState('idle');
      if (pendingCount > 0) {
        triggerSync();
      }
    }
  }, [isOnline, syncState, pendingCount, triggerSync]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setIsOnline(true);
        updatePendingCount().then(() => {
          if (pendingCount > 0) triggerSync();
        });
      };
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [updatePendingCount, pendingCount, triggerSync]);

  // Phones: sync as soon as the connection comes back, and right after signing in.
  const authToken = useAuthStore((st) => st.token);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let wasOnline = true;
    const sub = Network.addNetworkStateListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && !wasOnline) {
        updatePendingCount().then(() => triggerSync());
      }
      wasOnline = online;
    });
    return () => sub.remove();
  }, [updatePendingCount, triggerSync]);

  useEffect(() => {
    if (!authToken) return;
    updatePendingCount().then(() => triggerSync());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  return (
    <SyncContext.Provider
      value={{
        syncState,
        pendingCount,
        lastSyncedAt,
        triggerSync,
        isOnline,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
