import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

// uuid needs crypto.getRandomValues, which React Native does not provide on phones.
// expo-crypto gives secure random values from the operating system.
if (Platform.OS !== 'web') {
  const g: any = globalThis as any;
  if (!g.crypto) g.crypto = {};
  if (typeof g.crypto.getRandomValues !== 'function') {
    g.crypto.getRandomValues = (arr: any) => ExpoCrypto.getRandomValues(arr);
  }
}
