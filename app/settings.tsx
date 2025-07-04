import React from 'react';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import SettingsPage from '@/components/SettingsPage';
import { StorageService } from '@/lib/storage';

export default function Settings() {
  const handleBack = () => {
    router.back();
  };

  const handleOpenDebug = () => {
    router.push('/debug');
  };

  const handleOpenDemo = () => {
    router.push('/demo');
  };

  const handleClearRecentFiles = () => {
    Alert.alert(
      'Clear Recent Files',
      'Are you sure you want to clear all recent files? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.clearRecentFiles();
              Alert.alert('Success', 'Recent files have been cleared.');
            } catch {
              Alert.alert('Error', 'Failed to clear recent files.');
            }
          },
        },
      ]
    );
  };

  return (
    <SettingsPage 
      onBack={handleBack}
      onOpenDebug={handleOpenDebug}
      onOpenDemo={handleOpenDemo}
      onClearRecentFiles={handleClearRecentFiles}
    />
  );
}