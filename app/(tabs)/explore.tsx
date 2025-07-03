import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/ThemedView';
import SurvexDebugView from '@/components/SurvexDebugView';

export default function DebugScreen() {
  return (
    <ThemedView style={styles.container}>
      <SurvexDebugView />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
