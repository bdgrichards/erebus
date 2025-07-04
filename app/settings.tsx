import React from 'react';
import { router } from 'expo-router';
import SettingsPage from '@/components/SettingsPage';

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

  return (
    <SettingsPage 
      onBack={handleBack}
      onOpenDebug={handleOpenDebug}
      onOpenDemo={handleOpenDemo}
    />
  );
}