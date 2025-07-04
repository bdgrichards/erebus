import SurvexViewer from "@/components/SurvexViewer";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SurvexData } from "@/lib/survex-types";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export default function Viewer() {
  const params = useLocalSearchParams();

  // Parse survex data from params
  let survexData: SurvexData | undefined;
  if (params.survexData && typeof params.survexData === "string") {
    try {
      survexData = JSON.parse(params.survexData);
    } catch (error) {
      console.error("Error parsing survex data:", error);
    }
  }

  const handleBack = () => {
    router.back();
  };

  const handleSettings = () => {
    // TODO: Implement settings
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />
      {survexData ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.titlesContainer}>
            <ThemedText
              style={styles.overlayText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {survexData?.header.title}
            </ThemedText>
            <ThemedText style={styles.overlaySubtext}>
              {survexData?.stations.length} stations, {survexData?.legs.length}{" "}
              legs
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettings}
          >
            <Ionicons name="settings-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        <ThemedView style={styles.header}>
          <ThemedText style={styles.overlayText}>No 3D data loaded</ThemedText>
        </ThemedView>
      )}
      <View style={styles.content}>
        <SurvexViewer data={survexData} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 50,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 1000,
    gap: 4,
  },
  backButton: {
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
  },
  settingsButton: {
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
  },
  content: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  titlesContainer: {
    padding: 4,
    flexShrink: 1,
    flexGrow: 0,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
  },
  overlayText: {
    textAlign: "center",
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  overlaySubtext: {
    textAlign: "center",
    color: "white",
    fontSize: 14,
  },
});
