import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface SettingsPageProps {
  onBack: () => void;
  onOpenDebug: () => void;
  onOpenDemo: () => void;
}

export default function SettingsPage({ onBack, onOpenDebug, onOpenDemo }: SettingsPageProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingTop: 60,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderColor: colors.text + '20',
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    menuIcon: {
      marginRight: 16,
    },
    menuContent: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    menuDescription: {
      fontSize: 14,
      color: colors.text + '80',
      marginTop: 4,
    },
    chevron: {
      marginLeft: 8,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer Tools</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={onOpenDebug}>
            <Ionicons name="terminal" size={24} color={colors.text} style={styles.menuIcon} />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Debug View</Text>
              <Text style={styles.menuDescription}>
                View file parsing details and debug information
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text + '60'} style={styles.chevron} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onOpenDemo}>
            <Ionicons name="cube" size={24} color={colors.text} style={styles.menuIcon} />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>3D Demo</Text>
              <Text style={styles.menuDescription}>
                Interactive 3D demo with touch controls
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text + '60'} style={styles.chevron} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}