import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { RecentFile } from '@/lib/storage';

interface HomePageProps {
  onOpenFile: () => void;
  onOpenSettings: () => void;
  onOpenRecentFile?: (file: RecentFile) => void;
  recentFiles?: RecentFile[];
}

export default function HomePage({ onOpenFile, onOpenSettings, onOpenRecentFile, recentFiles = [] }: HomePageProps) {
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
        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
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
                >
                  <Text style={styles.recentFileName}>{file.name}</Text>
                  <Text style={styles.recentFileDate}>{formatDate(file.lastOpened)}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <TouchableOpacity style={styles.openButton} onPress={onOpenFile}>
        <Text style={styles.openButtonText}>Open New File</Text>
      </TouchableOpacity>
    </View>
  );
}