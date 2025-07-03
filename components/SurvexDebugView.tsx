import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { SurvexData } from '../lib/survex-types';
import { SurvexParser } from '../lib/survex-parser';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

export default function SurvexDebugView() {
  const [survexData, setSurvexData] = useState<SurvexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Capture console logs
  const addDebugLog = async (message: string) => {
    console.log(message);
    setDebugLogs(prev => [...prev, message]);
    
    // Write to log file in a predictable location
    try {
      const logPath = '/tmp/survex-debug.log';
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      await FileSystem.writeAsStringAsync(logPath, logEntry, { append: true });
      console.log('📝 Log written to:', logPath);
    } catch (error) {
      console.error('Failed to write log:', error);
      // Fallback: try a different location
      try {
        const fallbackPath = `${FileSystem.cacheDirectory}survex-debug.log`;
        const logEntry = `[${timestamp}] ${message}\n`;
        await FileSystem.writeAsStringAsync(fallbackPath, logEntry, { append: true });
        console.log('📝 Log written to fallback:', fallbackPath);
      } catch (fallbackError) {
        console.error('Fallback log write failed:', fallbackError);
      }
    }
  };

  const pickFile = async () => {
    try {
      await addDebugLog('📱 Opening file picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        await addDebugLog(`📱 File selected: ${file.name} (${file.size} bytes)`);
        await addDebugLog(`📱 File URI: ${file.uri}`);
        
        setSelectedFile(file.uri);
        setSurvexData(null);
        setError(null);
        
        // Parse the selected file
        await loadAndParseSurvexFile(file.uri);
      } else {
        await addDebugLog('📱 File selection cancelled');
      }
    } catch (err) {
      await addDebugLog(`📱 File picker error: ${err}`);
      setError('Failed to pick file');
    }
  };

  // Remove the useEffect auto-load since we want manual file selection
  // useEffect(() => {
  //   loadAndParseSurvexFile();
  // }, []);

  const loadAndParseSurvexFile = async (fileUri?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      let uint8Array: Uint8Array;
      let fileLoaded = false;
      
      // If a file URI is provided, try to read it
      if (fileUri) {
        try {
          await addDebugLog(`📁 Reading selected file: ${fileUri}`);
          
          const fileContent = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Convert base64 to Uint8Array
          const binaryString = atob(fileContent);
          uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          
          await addDebugLog(`📁 SUCCESS: Read selected file! Size: ${uint8Array.length} bytes`);
          fileLoaded = true;
          
        } catch (fileError) {
          await addDebugLog(`📁 File read failed: ${fileError.message}`);
        }
      }
      
      // Fallback to demo data if no file selected or file reading failed
      if (!fileLoaded) {
        await addDebugLog('🔄 Using demo data for parser testing');
        const demoFileContent = await createDemoSurvexBinaryData();
        uint8Array = demoFileContent;
      }

      await addDebugLog(`File loaded, size: ${uint8Array.length} bytes`);
      await addDebugLog(`First 50 bytes: ${Array.from(uint8Array.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Parse the file
      const parser = new SurvexParser(uint8Array);
      const data = parser.parse();
      
      setSurvexData(data);
      await addDebugLog(`Parsed survex data: ${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      console.error('Error loading survex file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load survex file');
    } finally {
      setIsLoading(false);
    }
  };

  const createDemoSurvexBinaryData = async (): Promise<Uint8Array> => {
    // Create a minimal valid Survex v8 file for testing
    await addDebugLog('📝 Creating demo Survex binary data...');
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    
    // File ID
    const fileIdPart = encoder.encode('Survex 3D Image File\n');
    parts.push(fileIdPart);
    await addDebugLog(`📝 Added file ID: ${fileIdPart.length} bytes`);
    
    // Version
    const versionPart = encoder.encode('v8\n');
    parts.push(versionPart);
    await addDebugLog(`📝 Added version: ${versionPart.length} bytes`);
    
    // Title (null-terminated)
    const titlePart = encoder.encode('Demo Cave\0');
    parts.push(titlePart);
    await addDebugLog(`📝 Added title: ${titlePart.length} bytes`);
    
    // Separator (null-terminated)
    const separatorPart = encoder.encode('.\0');
    parts.push(separatorPart);
    await addDebugLog(`📝 Added separator: ${separatorPart.length} bytes`);
    
    // Timestamp (32-bit little-endian Unix timestamp)
    const timestamp = Math.floor(Date.now() / 1000);
    const timestampBytes = new Uint8Array(4);
    new DataView(timestampBytes.buffer).setUint32(0, timestamp, true);
    parts.push(timestampBytes);
    await addDebugLog(`📝 Added timestamp: ${timestampBytes.length} bytes, value: ${timestamp}`);
    
    // Flags (8-bit)
    const flagsPart = new Uint8Array([0]);
    parts.push(flagsPart);
    await addDebugLog(`📝 Added flags: ${flagsPart.length} bytes`);
    
    // Now add some survey data items
    await addDebugLog('📝 Adding survey data items...');
    
    // Add a MOVE item (type 0) to (100, 200, 300)
    const moveItem = new Uint8Array(13); // 1 byte type + 12 bytes coordinates
    moveItem[0] = 0; // MOVE type
    new DataView(moveItem.buffer, 1).setInt32(0, 100, true); // x
    new DataView(moveItem.buffer, 5).setInt32(0, 200, true); // y  
    new DataView(moveItem.buffer, 9).setInt32(0, 300, true); // z
    parts.push(moveItem);
    await addDebugLog(`📝 Added MOVE item: ${moveItem.length} bytes`);
    
    // Add a LINE item (type 1) with relative coordinates (50, 30, -10)
    const lineItem = new Uint8Array(13); // 1 byte type + 12 bytes coordinates
    lineItem[0] = 1; // LINE type
    new DataView(lineItem.buffer, 1).setInt32(0, 50, true); // dx
    new DataView(lineItem.buffer, 5).setInt32(0, 30, true); // dy
    new DataView(lineItem.buffer, 9).setInt32(0, -10, true); // dz
    parts.push(lineItem);
    await addDebugLog(`📝 Added LINE item: ${lineItem.length} bytes`);
    
    // Add a LABEL item (type 2) 
    const labelCoords = new Uint8Array(16); // 12 bytes coords + 4 bytes flags
    new DataView(labelCoords.buffer, 0).setInt32(0, 150, true); // x
    new DataView(labelCoords.buffer, 4).setInt32(0, 230, true); // y
    new DataView(labelCoords.buffer, 8).setInt32(0, 290, true); // z
    new DataView(labelCoords.buffer, 12).setUint32(0, 0, true); // flags
    
    const labelText = encoder.encode('station1\0');
    const labelItem = new Uint8Array(1 + labelCoords.length + labelText.length);
    labelItem[0] = 2; // LABEL type
    labelItem.set(labelCoords, 1);
    labelItem.set(labelText, 1 + labelCoords.length);
    parts.push(labelItem);
    await addDebugLog(`📝 Added LABEL item: ${labelItem.length} bytes`);
    
    // Calculate total length
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    await addDebugLog(`📝 Total file size with data: ${totalLength} bytes`);
    
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    
    await addDebugLog(`📝 Demo file created, first 50 bytes: ${Array.from(result.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    await addDebugLog(`📝 Demo file created, last 20 bytes: ${Array.from(result.slice(-20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    return result;
  };

  const formatBytes = (bytes: number) => {
    return bytes.toString(16).padStart(2, '0');
  };

  const renderHeader = (header: any) => (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>📄 File Header</ThemedText>
      <ThemedText style={styles.item}>File ID: {header.fileId}</ThemedText>
      <ThemedText style={styles.item}>Version: {header.version}</ThemedText>
      <ThemedText style={styles.item}>Title: {header.title}</ThemedText>
      <ThemedText style={styles.item}>Separator: '{header.separator}'</ThemedText>
      <ThemedText style={styles.item}>Timestamp: {header.timestamp.toISOString()}</ThemedText>
      <ThemedText style={styles.item}>Flags: {header.flags}</ThemedText>
    </ThemedView>
  );

  const renderStations = (stations: any[]) => (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>🏠 Stations ({stations.length})</ThemedText>
      {stations.map((station, index) => (
        <ThemedView key={index} style={styles.subsection}>
          <ThemedText style={styles.item}>Name: {station.name}</ThemedText>
          <ThemedText style={styles.item}>Position: ({station.x}, {station.y}, {station.z})</ThemedText>
          <ThemedText style={styles.item}>Flags: {station.flags}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );

  const renderLegs = (legs: any[]) => (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>🔗 Survey Legs ({legs.length})</ThemedText>
      {legs.map((leg, index) => (
        <ThemedView key={index} style={styles.subsection}>
          <ThemedText style={styles.item}>From: ({leg.fromX}, {leg.fromY}, {leg.fromZ})</ThemedText>
          <ThemedText style={styles.item}>To: ({leg.toX}, {leg.toY}, {leg.toZ})</ThemedText>
          <ThemedText style={styles.item}>Stations: {leg.fromStation} → {leg.toStation}</ThemedText>
          <ThemedText style={styles.item}>Flags: {leg.flags}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );

  const renderBounds = (bounds: any) => (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>📏 Survey Bounds</ThemedText>
      <ThemedText style={styles.item}>X: {bounds.minX} to {bounds.maxX} (range: {bounds.maxX - bounds.minX})</ThemedText>
      <ThemedText style={styles.item}>Y: {bounds.minY} to {bounds.maxY} (range: {bounds.maxY - bounds.minY})</ThemedText>
      <ThemedText style={styles.item}>Z: {bounds.minZ} to {bounds.maxZ} (range: {bounds.maxZ - bounds.minZ})</ThemedText>
    </ThemedView>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <ThemedText style={styles.title}>Loading Survex File...</ThemedText>
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>🐛 Debug Logs</ThemedText>
          {debugLogs.map((log, index) => (
            <ThemedText key={index} style={styles.item}>{log}</ThemedText>
          ))}
        </ThemedView>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
        <ThemedText style={styles.title}>❌ Error Loading File</ThemedText>
        <ThemedText style={styles.error}>{error}</ThemedText>
        
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>📱 File Selection</ThemedText>
          <TouchableOpacity style={styles.button} onPress={pickFile}>
            <ThemedText style={styles.buttonText}>
              📁 Try Pick File Again
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>🐛 Debug Logs</ThemedText>
          {debugLogs.map((log, index) => (
            <ThemedText key={index} style={styles.item}>{log}</ThemedText>
          ))}
        </ThemedView>
      </ScrollView>
    );
  }

  // Always show the main interface (no early return for "no data")

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <ThemedText style={styles.title}>🗂️ Survex File Debug View</ThemedText>
      
      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>📱 File Selection</ThemedText>
        <TouchableOpacity style={styles.button} onPress={pickFile}>
          <ThemedText style={styles.buttonText}>
            📁 Pick Survex File (.3d)
          </ThemedText>
        </TouchableOpacity>
        {selectedFile && (
          <ThemedText style={styles.item}>Selected: {selectedFile}</ThemedText>
        )}
        {!survexData && !isLoading && !selectedFile && (
          <ThemedText style={styles.item}>Tap button to select a .3d file from your phone</ThemedText>
        )}
      </ThemedView>

      {survexData && (
        <>
          {renderHeader(survexData.header)}
          {renderStations(survexData.stations)}
          {renderLegs(survexData.legs)}
          {renderBounds(survexData.bounds)}
          
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>📊 Summary</ThemedText>
            <ThemedText style={styles.item}>Total Stations: {survexData.stations.length}</ThemedText>
            <ThemedText style={styles.item}>Total Legs: {survexData.legs.length}</ThemedText>
            <ThemedText style={styles.item}>Survey Title: {survexData.header.title}</ThemedText>
          </ThemedView>
        </>
      )}

      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>🐛 Debug Logs</ThemedText>
        {debugLogs.map((log, index) => (
          <ThemedText key={index} style={styles.item}>{log}</ThemedText>
        ))}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  subsection: {
    marginLeft: 16,
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  item: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  error: {
    color: 'red',
    fontSize: 14,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});