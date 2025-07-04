import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useColorScheme, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { RecentFile } from '@/lib/storage';

interface HomePageProps {
  onOpenFile: () => void;
  onOpenSettings: () => void;
  onOpenRecentFile?: (file: RecentFile) => void;
  recentFiles?: RecentFile[];
  isLoading?: boolean;
  loadingMessage?: string;
}

export default function HomePage({ onOpenFile, onOpenSettings, onOpenRecentFile, recentFiles = [], isLoading = false, loadingMessage = 'Loading...' }: HomePageProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingTop: 60,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    settingsButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    recentSection: {
      flex: 1,
      marginTop: 20,
    },
    recentTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    recentList: {
      flex: 1,
    },
    recentItem: {
      backgroundColor: colors.background,
      borderColor: colors.text + '20',
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
      marginBottom: 8,
    },
    recentFileName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    recentFileDate: {
      fontSize: 14,
      color: colors.text + '80',
      marginTop: 4,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 100,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text + '60',
      textAlign: 'center',
    },
    openButton: {
      backgroundColor: colors.tint,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      margin: 20,
      alignItems: 'center',
    },
    openButtonText: {
      color: colors.background,
      fontSize: 18,
      fontWeight: '600',
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    loadingContent: {
      backgroundColor: colors.background,
      padding: 24,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.text,
    },
  });

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Erebus</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings} disabled={isLoading}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent Files</Text>
          <ScrollView style={styles.recentList} showsVerticalScrollIndicator={false}>
            {recentFiles.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No files opened yet.{'\n'}Open a cave survey file to get started.
                </Text>
              </View>
            ) : (
              recentFiles.map((file) => (
                <TouchableOpacity 
                  key={file.id} 
                  style={styles.recentItem}
                  onPress={() => onOpenRecentFile?.(file)}
                  disabled={isLoading}
                >
                  <Text style={styles.recentFileName}>{file.name}</Text>
                  <Text style={styles.recentFileDate}>{formatDate(file.lastOpened)}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <TouchableOpacity style={styles.openButton} onPress={onOpenFile} disabled={isLoading}>
        <Text style={styles.openButtonText}>Open New File</Text>
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}