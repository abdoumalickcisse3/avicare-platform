import * as SecureStore from 'expo-secure-store';
import { WELCOME_PENDING_KEY } from './steps';

export async function setWelcomePending(): Promise<void> {
  await SecureStore.setItemAsync(WELCOME_PENDING_KEY, '1');
}

export async function readAndClearWelcomePending(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(WELCOME_PENDING_KEY);
  if (v === '1') await SecureStore.deleteItemAsync(WELCOME_PENDING_KEY);
  return v === '1';
}
