import * as SecureStore from 'expo-secure-store';
import { RecentFilesManager, RecentFilesStorage } from './recent-files-manager';

export type { RecentFile } from './recent-files-manager';

// Adapter to make expo-secure-store compatible with RecentFilesStorage interface
class ExpoSecureStoreAdapter implements RecentFilesStorage {
  async getItem(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}

// Create the manager instance
const recentFilesManager = new RecentFilesManager(
  new ExpoSecureStoreAdapter(),
  'recent_files',
  10
);

export const StorageService = {
  async getRecentFiles() {
    return await recentFilesManager.getRecentFiles();
  },

  async addRecentFile(file: Parameters<typeof recentFilesManager.addRecentFile>[0]) {
    return await recentFilesManager.addRecentFile(file);
  },

  async clearRecentFiles() {
    return await recentFilesManager.clearRecentFiles();
  }
};