import { useState, useEffect, useCallback } from 'react';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

interface UseNetworkStatusResult {
  isOnline: boolean;
  status: NetworkStatus;
  checkConnection: () => Promise<boolean>;
}

export function useNetworkStatus(): UseNetworkStatusResult {
  const [status, setStatus] = useState<NetworkStatus>('unknown');

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        setStatus(isOnline ? 'online' : 'offline');
        return isOnline;
      }

      const networkState = await Network.getNetworkStateAsync();
      const isConnected = networkState.isConnected && networkState.isInternetReachable;
      setStatus(isConnected ? 'online' : 'offline');
      return isConnected ?? false;
    } catch (error) {
      console.warn('Failed to check network status:', error);
      setStatus('unknown');
      return false;
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (Platform.OS === 'web') {
      const handleOnline = () => setStatus('online');
      const handleOffline = () => setStatus('offline');
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    isOnline: status === 'online',
    status,
    checkConnection,
  };
}
