import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SurvexViewer from '@/components/SurvexViewer';
import { SurvexData } from '@/lib/survex-types';

export default function Viewer() {
  const params = useLocalSearchParams();
  
  // Parse survex data from params
  let survexData: SurvexData | undefined;
  if (params.survexData && typeof params.survexData === 'string') {
    try {
      survexData = JSON.parse(params.survexData);
    } catch (error) {
      console.error('Error parsing survex data:', error);
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    header: {
      position: 'absolute',
      top: 50,
      left: 20,
      zIndex: 1000,
    },
    backButton: {
      padding: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 25,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    content: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  });

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <SurvexViewer data={survexData} />
      </View>
    </View>
  );
}