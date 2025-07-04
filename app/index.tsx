import React, { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert } from 'react-native';
import HomePage from '@/components/HomePage';
import { StorageService, RecentFile } from '@/lib/storage';
import { FileLoaderService } from '@/lib/file-loader';

export default function Index() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  const loadRecentFiles = useCallback(async () => {
    const files = await StorageService.getRecentFiles();
    setRecentFiles(files);
  }, []);

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  // Refresh recent files when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecentFiles();
    }, [loadRecentFiles])
  );

  const handleOpenFile = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Opening file picker...');
      
      const result = await FileLoaderService.pickAndLoadFile();
      
      if (!result.success) {
        setIsLoading(false);
        if (result.error !== 'File selection cancelled') {
          Alert.alert('Error', result.error || 'Failed to load file');
        }
        return;
      }
      
      setLoadingMessage('Loading file...');
      
      if (result.data && result.fileName && result.filePath) {
        // Add to recent files
        await StorageService.addRecentFile({
          name: result.fileName,
          path: result.filePath,
          size: result.fileSize
        });
        
        // Refresh recent files list
        await loadRecentFiles();
        
        // Navigate to viewer with file data
        router.push({
          pathname: '/viewer',
          params: {
            survexData: JSON.stringify(result.data),
            fileName: result.fileName
          }
        });
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRecentFile = async (file: RecentFile) => {
    try {
      setIsLoading(true);
      setLoadingMessage(`Loading ${file.name}...`);
      
      const result = await FileLoaderService.loadSurvexFile(file.path, file.name, file.size);
      
      if (!result.success) {
        setIsLoading(false);
        Alert.alert('Error', result.error || 'Failed to load recent file');
        return;
      }
      
      if (result.data) {
        // Update recent files (this will move it to top)
        await StorageService.addRecentFile({
          name: file.name,
          path: file.path,
          size: file.size
        });
        
        // Refresh recent files list
        await loadRecentFiles();
        
        // Navigate to viewer with file data
        router.push({
          pathname: '/viewer',
          params: {
            survexData: JSON.stringify(result.data),
            fileName: file.name
          }
        });
      }
    } catch (error) {
      console.error('Error opening recent file:', error);
      Alert.alert('Error', 'Failed to open recent file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = () => {
    router.push('/settings');
  };

  return (
    <HomePage 
      onOpenFile={handleOpenFile}
      onOpenSettings={handleOpenSettings}
      onOpenRecentFile={handleOpenRecentFile}
      recentFiles={recentFiles}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
    />
  );
}