import * as SecureStore from 'expo-secure-store';

export interface RecentFile {
  id: string;
  name: string;
  path: string;
  lastOpened: Date;
}

const RECENT_FILES_KEY = 'recent_files';
const MAX_RECENT_FILES = 10;

export const StorageService = {
  async getRecentFiles(): Promise<RecentFile[]> {
    try {
      const stored = await SecureStore.getItemAsync(RECENT_FILES_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return parsed.map((file: any) => ({
        ...file,
        lastOpened: new Date(file.lastOpened)
      }));
    } catch (error) {
      console.error('Error loading recent files:', error);
      return [];
    }
  },

  async addRecentFile(file: Omit<RecentFile, 'id' | 'lastOpened'>): Promise<void> {
    try {
      const recentFiles = await this.getRecentFiles();
      
      // Remove existing file with same path if it exists
      const filtered = recentFiles.filter(f => f.path !== file.path);
      
      // Add new file at the beginning
      const newFile: RecentFile = {
        ...file,
        id: Date.now().toString(),
        lastOpened: new Date()
      };
      
      const updated = [newFile, ...filtered].slice(0, MAX_RECENT_FILES);
      
      await SecureStore.setItemAsync(RECENT_FILES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent file:', error);
    }
  },

  async clearRecentFiles(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(RECENT_FILES_KEY);
    } catch (error) {
      console.error('Error clearing recent files:', error);
    }
  }
};