import React from 'react';
import { View, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import SurvexDebugView from '@/components/SurvexDebugView';

export default function Debug() {
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
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.text + '20',
    },
    backButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
  });

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <SurvexDebugView />
      </View>
    </View>
  );
}