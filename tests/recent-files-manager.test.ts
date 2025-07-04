import { RecentFilesManager, RecentFile, RecentFilesStorage } from '../lib/recent-files-manager';

// Mock storage implementation for testing
class MockStorage implements RecentFilesStorage {
  private data: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.data.delete(key);
  }

  // Helper for tests
  clear() {
    this.data.clear();
  }
}

describe('RecentFilesManager', () => {
  let storage: MockStorage;
  let manager: RecentFilesManager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new RecentFilesManager(storage, 'test_recent_files', 3); // Use smaller max for testing
  });

  describe('getRecentFiles', () => {
    it('should return empty array when no files stored', async () => {
      const files = await manager.getRecentFiles();
      expect(files).toEqual([]);
    });

    it('should return parsed files with Date objects', async () => {
      const testData = [
        {
          id: '1',
          name: 'test.3d',
          path: '/test.3d',
          lastOpened: '2023-01-01T00:00:00.000Z'
        }
      ];
      await storage.setItem('test_recent_files', JSON.stringify(testData));

      const files = await manager.getRecentFiles();
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('test.3d');
      expect(files[0].lastOpened).toBeInstanceOf(Date);
    });

    it('should handle malformed JSON gracefully', async () => {
      await storage.setItem('test_recent_files', 'invalid json');
      const files = await manager.getRecentFiles();
      expect(files).toEqual([]);
    });
  });

  describe('addRecentFile', () => {
    it('should add a new file to empty list', async () => {
      await manager.addRecentFile({
        name: 'cave.3d',
        path: '/path/to/cave.3d'
      });

      const files = await manager.getRecentFiles();
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('cave.3d');
      expect(files[0].path).toBe('/path/to/cave.3d');
      expect(files[0].id).toBeDefined();
      expect(files[0].lastOpened).toBeInstanceOf(Date);
    });

    it('should move existing file to front when added again', async () => {
      // Add first file
      await manager.addRecentFile({
        name: 'cave1.3d',
        path: '/path/to/cave1.3d'
      });

      // Add second file
      await manager.addRecentFile({
        name: 'cave2.3d',
        path: '/path/to/cave2.3d'
      });

      // Re-add first file (should move to front)
      await manager.addRecentFile({
        name: 'cave1.3d',
        path: '/path/to/cave1.3d'
      });

      const files = await manager.getRecentFiles();
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('cave1.3d'); // Should be first
      expect(files[1].name).toBe('cave2.3d'); // Should be second
    });

    it('should limit files to maxFiles', async () => {
      // Add 5 files to a manager with max 3
      for (let i = 1; i <= 5; i++) {
        await manager.addRecentFile({
          name: `cave${i}.3d`,
          path: `/path/to/cave${i}.3d`
        });
      }

      const files = await manager.getRecentFiles();
      expect(files).toHaveLength(3);
      expect(files[0].name).toBe('cave5.3d'); // Most recent
      expect(files[1].name).toBe('cave4.3d');
      expect(files[2].name).toBe('cave3.3d');
    });

    it('should not create duplicates for same name and size', async () => {
      await manager.addRecentFile({
        name: 'cave.3d',
        path: '/original/path.3d',
        size: 12345
      });

      await manager.addRecentFile({
        name: 'cave.3d', // Same name and size
        path: '/different/path.3d', // Different path
        size: 12345
      });

      const files = await manager.getRecentFiles();
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('cave.3d');
      expect(files[0].path).toBe('/different/path.3d'); // Should have updated path
    });
  });

  describe('clearRecentFiles', () => {
    it('should clear all recent files', async () => {
      // Add some files
      await manager.addRecentFile({
        name: 'cave1.3d',
        path: '/path/to/cave1.3d'
      });
      await manager.addRecentFile({
        name: 'cave2.3d',
        path: '/path/to/cave2.3d'
      });

      // Verify files exist
      let files = await manager.getRecentFiles();
      expect(files).toHaveLength(2);

      // Clear files
      await manager.clearRecentFiles();

      // Verify files are cleared
      files = await manager.getRecentFiles();
      expect(files).toHaveLength(0);
    });
  });

  describe('updateRecentFilesList (static method)', () => {
    it('should add new file to empty list', () => {
      const result = RecentFilesManager.updateRecentFilesList(
        [],
        { name: 'test.3d', path: '/test.3d' },
        3
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test.3d');
      expect(result[0].id).toBeDefined();
      expect(result[0].lastOpened).toBeInstanceOf(Date);
    });

    it('should move existing file to front', () => {
      const existingFiles: RecentFile[] = [
        {
          id: '1',
          name: 'cave1.3d',
          path: '/cave1.3d',
          lastOpened: new Date('2023-01-01')
        },
        {
          id: '2',
          name: 'cave2.3d',
          path: '/cave2.3d',
          lastOpened: new Date('2023-01-02')
        }
      ];

      const result = RecentFilesManager.updateRecentFilesList(
        existingFiles,
        { name: 'cave1.3d', path: '/cave1.3d' },
        3
      );

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('/cave1.3d'); // Moved to front
      expect(result[1].path).toBe('/cave2.3d');
    });

    it('should respect max files limit', () => {
      const existingFiles: RecentFile[] = [
        {
          id: '1',
          name: 'cave1.3d',
          path: '/cave1.3d',
          lastOpened: new Date('2023-01-01')
        },
        {
          id: '2',
          name: 'cave2.3d',
          path: '/cave2.3d',
          lastOpened: new Date('2023-01-02')
        }
      ];

      const result = RecentFilesManager.updateRecentFilesList(
        existingFiles,
        { name: 'cave3.3d', path: '/cave3.3d' },
        2 // Max 2 files
      );

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('/cave3.3d'); // New file first
      expect(result[1].path).toBe('/cave1.3d'); // cave2.3d should be dropped
    });

    it('should handle same name and size with different path', () => {
      const existingFiles: RecentFile[] = [
        {
          id: '1',
          name: 'cave.3d',
          path: '/old/path.3d',
          size: 12345,
          lastOpened: new Date('2023-01-01')
        }
      ];

      const result = RecentFilesManager.updateRecentFilesList(
        existingFiles,
        { name: 'cave.3d', path: '/new/path.3d', size: 12345 },
        3
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cave.3d');
      expect(result[0].path).toBe('/new/path.3d'); // Should update to new path
      expect(result[0].size).toBe(12345);
    });
  });

  describe('DocumentPicker duplicate issue', () => {
    it('should handle DocumentPicker creating different URIs for same file', async () => {
      // Simulate DocumentPicker behavior - same file, different temp URIs
      await manager.addRecentFile({
        name: 'cave.3d',
        path: '/temp/cache/1234-cave.3d', // First temp URI
        size: 12345
      });

      await manager.addRecentFile({
        name: 'cave.3d', // Same file name
        path: '/temp/cache/5678-cave.3d', // Different temp URI  
        size: 12345 // Same file size
      });

      const files = await manager.getRecentFiles();
      console.log('Files after adding same name/size with different paths:', files.map(f => ({ name: f.name, path: f.path, size: f.size })));
      // Now it should deduplicate by name+size instead of path
      expect(files).toHaveLength(1); // Should NOT create duplicates anymore
      expect(files[0].name).toBe('cave.3d');
      expect(files[0].size).toBe(12345);
      expect(files[0].path).toBe('/temp/cache/5678-cave.3d'); // Should use the latest path
    });

    it('should allow files with same name but different sizes', async () => {
      await manager.addRecentFile({
        name: 'cave.3d',
        path: '/path1/cave.3d',
        size: 12345
      });

      await manager.addRecentFile({
        name: 'cave.3d', // Same name
        path: '/path2/cave.3d',
        size: 67890 // Different size
      });

      const files = await manager.getRecentFiles();
      expect(files).toHaveLength(2); // Should keep both files
      expect(files[0].size).toBe(67890); // Most recent first
      expect(files[1].size).toBe(12345);
    });
  });
});