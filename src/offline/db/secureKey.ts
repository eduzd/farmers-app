import { Platform } from 'react-native';

/**
 * The key that encrypts the calculator database on the phone.
 * It is made once from secure random bytes and kept only in the phone's secure store
 * (Android Keystore / iOS Keychain), readable only by this app on this device. It never leaves the phone.
 */
const KEY_NAME = 'farmers_calc_db_key_v1';

let cached: string | null = null;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export async function getCalcDbKey(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (cached) return cached;
  const SecureStore = await import('expo-secure-store');
  const opts = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  let key = await SecureStore.getItemAsync(KEY_NAME, opts);
  if (!key || !/^[0-9a-f]{64}$/.test(key)) {
    const Crypto = await import('expo-crypto');
    key = toHex(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(KEY_NAME, key, opts);
  }
  cached = key;
  return key;
}
