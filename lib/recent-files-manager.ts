export interface RecentFile {
  id: string;
  name: string;
  path: string;
  size?: number; // File size in bytes for better deduplication
  lastOpened: Date;
}

export interface RecentFilesStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export class RecentFilesManager {
  private readonly storage: RecentFilesStorage;
  private readonly storageKey: string;
  private readonly maxFiles: number;

  constructor(storage: RecentFilesStorage, storageKey: string = 'recent_files', maxFiles: number = 10) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.maxFiles = maxFiles;
  }

  async getRecentFiles(): Promise<RecentFile[]> {
    try {
      const stored = await this.storage.getItem(this.storageKey);
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
  }

  async addRecentFile(file: Omit<RecentFile, 'id' | 'lastOpened'>): Promise<void> {
    try {
      const recentFiles = await this.getRecentFiles();
      
      // Remove existing file with same name and size (better deduplication)
      const filtered = recentFiles.filter(f => {
        const sameFile = f.name === file.name && f.size === file.size;
        return !sameFile;
      });
      
      // Add new file at the beginning
      const newFile: RecentFile = {
        ...file,
        id: Date.now().toString(),
        lastOpened: new Date()
      };
      
      const updated = [newFile, ...filtered].slice(0, this.maxFiles);
      
      await this.storage.setItem(this.storageKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent file:', error);
      throw error;
    }
  }

  async clearRecentFiles(): Promise<void> {
    try {
      await this.storage.deleteItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing recent files:', error);
      throw error;
    }
  }

  // Pure function for testing the core logic
  static updateRecentFilesList(
    currentFiles: RecentFile[], 
    newFile: Omit<RecentFile, 'id' | 'lastOpened'>, 
    maxFiles: number = 10
  ): RecentFile[] {
    // Remove existing file with same name and size (better deduplication)
    const filtered = currentFiles.filter(f => {
      const sameFile = f.name === newFile.name && f.size === newFile.size;
      return !sameFile;
    });
    
    // Add new file at the beginning
    const fileWithTimestamp: RecentFile = {
      ...newFile,
      id: Date.now().toString(),
      lastOpened: new Date()
    };
    
    // Return updated list, limited to maxFiles
    return [fileWithTimestamp, ...filtered].slice(0, maxFiles);
  }
}