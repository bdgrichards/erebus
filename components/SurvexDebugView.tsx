import React, { useState } from 'react';
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
    
    // Write to log file in cache directory (iOS compatible)
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      const logPath = `${FileSystem.cacheDirectory}survex-debug.log`;
      await FileSystem.writeAsStringAsync(logPath, logEntry, { encoding: FileSystem.EncodingType.UTF8 });
      // Don't log success to avoid spam
    } catch {
      // Silent fail to avoid log spam - just use console
      // console.error('Failed to write log:', error);
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

      let uint8Array: Uint8Array = new Uint8Array([]);
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
          const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
          await addDebugLog(`📁 File read failed: ${errorMessage}`);
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
    // Create a minimal valid Survex v8 file for testing according to spec
    await addDebugLog('📝 Creating demo Survex v8 binary data...');
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
    
    // Survey title (linefeed-terminated, like the real file)
    const titlePart = encoder.encode('Demo Cave\n');
    parts.push(titlePart);
    await addDebugLog(`📝 Added survey title: ${titlePart.length} bytes`);
    
    // Timestamp string "@" + Unix timestamp + linefeed
    const timestamp = Math.floor(Date.now() / 1000);
    const timestampPart = encoder.encode(`@${timestamp}\n`);
    parts.push(timestampPart);
    await addDebugLog(`📝 Added timestamp: ${timestampPart.length} bytes, value: @${timestamp}`);
    
    // File-wide flags (8-bit)
    const flagsPart = new Uint8Array([0]);
    parts.push(flagsPart);
    await addDebugLog(`📝 Added flags: ${flagsPart.length} bytes`);
    
    // Now add some survey data items according to v8 spec
    await addDebugLog('📝 Adding survey data items...');
    
    // Add a MOVE item (type 0x0f) to (10000, 20000, 30000) centimeters = (100, 200, 300) meters
    const moveItem = new Uint8Array(13); // 1 byte type + 12 bytes coordinates
    moveItem[0] = 0x0f; // MOVE type
    new DataView(moveItem.buffer, 1).setInt32(0, 10000, true); // x in centimeters
    new DataView(moveItem.buffer, 5).setInt32(0, 20000, true); // y in centimeters
    new DataView(moveItem.buffer, 9).setInt32(0, 30000, true); // z in centimeters
    parts.push(moveItem);
    await addDebugLog(`📝 Added MOVE item (0x0f): ${moveItem.length} bytes`);
    
    // Add a LINE item (type 0x40) with relative coordinates (5000, 3000, -1000) cm = (50, 30, -10) m
    const lineItem = new Uint8Array(13); // 1 byte type + 12 bytes coordinates
    lineItem[0] = 0x40; // LINE type (0x40-0x7f range)
    new DataView(lineItem.buffer, 1).setInt32(0, 5000, true); // dx in centimeters
    new DataView(lineItem.buffer, 5).setInt32(0, 3000, true); // dy in centimeters
    new DataView(lineItem.buffer, 9).setInt32(0, -1000, true); // dz in centimeters
    parts.push(lineItem);
    await addDebugLog(`📝 Added LINE item (0x40): ${lineItem.length} bytes`);
    
    // Add a LABEL item (type 0x80) at (15000, 23000, 29000) cm = (150, 230, 290) m
    const labelCoords = new Uint8Array(12); // 12 bytes coordinates (no separate flags field)
    new DataView(labelCoords.buffer, 0).setInt32(0, 15000, true); // x in centimeters
    new DataView(labelCoords.buffer, 4).setInt32(0, 23000, true); // y in centimeters
    new DataView(labelCoords.buffer, 8).setInt32(0, 29000, true); // z in centimeters
    
    const labelText = encoder.encode('station1\0');
    const labelItem = new Uint8Array(1 + labelCoords.length + labelText.length);
    labelItem[0] = 0x80; // LABEL type (0x80-0xff range)
    labelItem.set(labelCoords, 1);
    labelItem.set(labelText, 1 + labelCoords.length);
    parts.push(labelItem);
    await addDebugLog(`📝 Added LABEL item (0x80): ${labelItem.length} bytes`);
    
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


  const renderHeader = (header: any) => (
    <ThemedView style={styles.section}>
      <ThemedText style={styles.sectionTitle}>📄 File Header</ThemedText>
      <ThemedText style={styles.item}>File ID: {header.fileId}</ThemedText>
      <ThemedText style={styles.item}>Version: {header.version}</ThemedText>
      <ThemedText style={styles.item}>Title: {header.title}</ThemedText>
      <ThemedText style={styles.item}>Separator: &apos;{header.separator}&apos;</ThemedText>
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
        {error && (
          <ThemedText style={styles.error}>❌ {error}</ThemedText>
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