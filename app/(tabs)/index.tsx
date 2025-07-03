import { StyleSheet, Dimensions } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import SurvexViewer from '@/components/SurvexViewer';

const { height } = Dimensions.get('window');

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">3D Cave Survey Viewer</ThemedText>
        <ThemedText type="subtitle">Real Survex Parser Working! 🎉</ThemedText>
      </ThemedView>
      <SurvexViewer style={styles.viewer} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  viewer: {
    flex: 1,
    minHeight: height * 0.7,
  },
});
