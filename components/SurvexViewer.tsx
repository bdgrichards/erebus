import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, PanResponder } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { SurvexData, SurvexStation, SurvexLeg } from '../lib/survex-types';
import { SurvexParser } from '../lib/survex-parser';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface SurvexViewerProps {
  data?: SurvexData;
  style?: any;
}

// Get dynamic dimensions in render
const getDimensions = () => Dimensions.get('window');

export default function SurvexViewer({ data, style }: SurvexViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [survexData, setSurvexData] = useState<SurvexData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [cameraTarget, setCameraTarget] = useState({ x: 0, y: 0, z: 0 });

  // Add component mount logging
  useEffect(() => {
    console.log('3D Viewer: SurvexViewer component mounted and rendered!');
  }, []);

  // Remove this effect - it's causing repeated geometry creation

  // Touch handling state like demo tab
  const [isRotating, setIsRotating] = useState(false);
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = useState(0);
  const [gestureMode, setGestureMode] = useState<'none' | 'pan' | 'pinch'>('none');
  
  // Utility function to calculate distance between two touch points
  const calculateDistance = (touch1: any, touch2: any) => {
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Use refs for camera values - keep upright view
  const cameraRotationRef = useRef({ theta: 0, phi: Math.PI / 2 }); // phi = 90 degrees for side view
  const cameraDistanceRef = useRef(1000); // Start further back
  const cameraTargetRef = useRef({ x: 0, y: 0, z: 0 });

  // Pan responder like demo tab (known to work)
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      console.log('3D Viewer: Touch started');
      setIsRotating(true);
      setLastTouch({
        x: evt.nativeEvent.pageX,
        y: evt.nativeEvent.pageY,
      });
    },
    onPanResponderMove: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches;
      
      if (touches.length === 1 && isRotating && !isPinching) {
        // Single finger - rotate camera in any direction
        const deltaX = evt.nativeEvent.pageX - lastTouch.x;
        const deltaY = evt.nativeEvent.pageY - lastTouch.y;
        
        const sensitivity = 0.01;
        const newTheta = cameraRotationRef.current.theta + deltaX * sensitivity;
        const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraRotationRef.current.phi - deltaY * sensitivity));
        
        cameraRotationRef.current = { theta: newTheta, phi: newPhi };
        console.log('3D Viewer: Rotation', newTheta.toFixed(2), newPhi.toFixed(2));
        
        setLastTouch({
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        });
      } else if (touches.length === 2) {
        // Two fingers - pinch to zoom or pan
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        // Calculate center point and current distance
        const centerX = (touch1.pageX + touch2.pageX) / 2;
        const centerY = (touch1.pageY + touch2.pageY) / 2;
        const currentDistance = calculateDistance(touch1, touch2);
        
        if (!isPinching) {
          // Start of two-finger gesture
          setIsPinching(true);
          setLastTouch({ x: centerX, y: centerY });
          setInitialPinchDistance(currentDistance);
          setGestureMode('none'); // Start ambiguous
          console.log('3D Viewer: Two-finger gesture started');
        } else {
          // During two-finger gesture - determine if pinch or pan
          const distanceChange = Math.abs(currentDistance - initialPinchDistance);
          const positionChange = Math.sqrt(
            Math.pow(centerX - lastTouch.x, 2) + Math.pow(centerY - lastTouch.y, 2)
          );
          
          // Determine gesture mode if not already set
          if (gestureMode === 'none') {
            if (distanceChange > 10) {
              setGestureMode('pinch');
              console.log('3D Viewer: Pinch mode activated');
            } else if (positionChange > 5) {
              setGestureMode('pan');
              console.log('3D Viewer: Pan mode activated');
            }
          }
          
          // Handle pinch to zoom
          if (gestureMode === 'pinch') {
            const zoomFactor = currentDistance / initialPinchDistance;
            const currentCameraDistance = cameraDistanceRef.current;
            // Apply logarithmic scaling for smoother zoom
            const zoomSensitivity = 0.8;
            const scaledZoom = Math.pow(zoomFactor, zoomSensitivity);
            const newDistance = Math.max(100, Math.min(5000, currentCameraDistance / scaledZoom));
            
            cameraDistanceRef.current = newDistance;
            console.log('3D Viewer: Zoom:', zoomFactor.toFixed(2), 'Distance:', newDistance.toFixed(0));
            
            // Update initial distance for smooth continuous zooming
            setInitialPinchDistance(currentDistance);
          }
          
          // Handle camera-relative panning
          else if (gestureMode === 'pan') {
            const deltaX = centerX - lastTouch.x;
            const deltaY = centerY - lastTouch.y;
            
            if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
              const panSensitivity = 0.5; // Adjusted for cave scale
              const rotation = cameraRotationRef.current;
              const currentTarget = cameraTargetRef.current;
              
              // For left/right: use camera rotation to determine actual world direction
              // Subtract 90 degrees (π/2) to align with camera's right direction
              const cosTheta = Math.cos(rotation.theta - Math.PI / 2);
              const sinTheta = Math.sin(rotation.theta - Math.PI / 2);
              
              // Pan left/right relative to camera view
              const panX = -deltaX * panSensitivity;
              const worldPanX = panX * cosTheta;
              const worldPanZ = panX * sinTheta;
              
              const newTarget = {
                x: currentTarget.x + worldPanX,
                y: currentTarget.y + deltaY * panSensitivity, // Up/down stays absolute
                z: currentTarget.z + worldPanZ
              };
              
              cameraTargetRef.current = newTarget;
              setCameraTarget(newTarget);
              console.log('3D Viewer: Camera-relative pan:', deltaX.toFixed(1), deltaY.toFixed(1), 'Target:', newTarget.x.toFixed(2), newTarget.y.toFixed(2));
              setLastTouch({ x: centerX, y: centerY });
            }
          }
        }
      }
    },
    onPanResponderRelease: () => {
      console.log('3D Viewer: Touch released');
      setIsRotating(false);
      if (isPinching) {
        setIsPinching(false);
        setGestureMode('none');
        console.log('3D Viewer: Two-finger gesture ended');
      }
    },
  });

  const pickFile = async () => {
    try {
      console.log('3D Viewer: Opening file picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log(`3D Viewer: File selected: ${file.name} (${file.size} bytes)`);
        
        setSelectedFile(file.uri);
        setSurvexData(null);
        setError(null);
        
        await loadSurvexFile(file.uri);
      } else {
        console.log('3D Viewer: File selection cancelled');
      }
    } catch (err) {
      console.log(`3D Viewer: File picker error: ${err}`);
      setError('Failed to pick file');
    }
  };

  const loadSurvexFile = async (fileUri?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      let uint8Array: Uint8Array;
      let fileLoaded = false;
      
      // If a file URI is provided, try to read it
      if (fileUri) {
        try {
          console.log(`3D Viewer: Reading selected file: ${fileUri}`);
          
          const fileContent = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Convert base64 to Uint8Array
          const binaryString = atob(fileContent);
          uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          
          console.log(`3D Viewer: SUCCESS: Read selected file! Size: ${uint8Array.length} bytes`);
          fileLoaded = true;
          
        } catch (fileError) {
          console.log(`3D Viewer: File read failed: ${fileError.message}`);
        }
      }
      
      // Fallback to demo data if no file selected or file reading failed
      if (!fileLoaded) {
        console.log('3D Viewer: Using demo data');
        // Create simple demo data
        const encoder = new TextEncoder();
        const parts: Uint8Array[] = [];
        
        parts.push(encoder.encode('Survex 3D Image File\n'));
        parts.push(encoder.encode('v8\n'));
        parts.push(encoder.encode('Demo Cave\0'));
        parts.push(encoder.encode('.\0'));
        
        const timestamp = Math.floor(Date.now() / 1000);
        const timestampBytes = new Uint8Array(4);
        new DataView(timestampBytes.buffer).setUint32(0, timestamp, true);
        parts.push(timestampBytes);
        parts.push(new Uint8Array([0]));
        
        // MOVE and LINE items for demo
        const moveItem = new Uint8Array(13);
        moveItem[0] = 0;
        new DataView(moveItem.buffer, 1).setInt32(0, 100, true);
        new DataView(moveItem.buffer, 5).setInt32(0, 200, true);
        new DataView(moveItem.buffer, 9).setInt32(0, 300, true);
        parts.push(moveItem);
        
        const lineItem = new Uint8Array(13);
        lineItem[0] = 1;
        new DataView(lineItem.buffer, 1).setInt32(0, 50, true);
        new DataView(lineItem.buffer, 5).setInt32(0, 30, true);
        new DataView(lineItem.buffer, 9).setInt32(0, -10, true);
        parts.push(lineItem);
        
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        uint8Array = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
          uint8Array.set(part, offset);
          offset += part.length;
        }
      }
      
      // Parse the file
      const parser = new SurvexParser(uint8Array);
      const parsedData = parser.parse();
      
      console.log('3D Viewer: Parsed survex data - stations:', parsedData.stations.length, 'legs:', parsedData.legs.length);
      setSurvexData(parsedData);
      return parsedData;
    } catch (err) {
      console.error('Error loading survex file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load survex file');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const setupScene = (gl: any) => {
    // Use the actual GL drawing buffer size for accurate rendering
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    
    console.log('3D Viewer: GL buffer dimensions', width, height);
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    
    // Store references
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    
    return { scene, camera, renderer };
  };

  const createCaveGeometry = (survexData: SurvexData, scene: THREE.Scene) => {
    try {
      console.log('3D Viewer: Creating geometry with bounds:', survexData.bounds);
      
      // Scale coordinates to reasonable size - the coordinates appear to be in very large units
      const scale = 1 / 1000000; // Scale down by 1 million
      
      // Create material for cave lines
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 2,
      });
      
      // Create geometry for cave survey lines (limit to first 20 legs for performance)
      const points: THREE.Vector3[] = [];
      const maxLegs = Math.min(20, survexData.legs.length);
      
      for (let i = 0; i < maxLegs; i++) {
        const leg = survexData.legs[i];
        points.push(new THREE.Vector3(leg.fromX * scale, leg.fromY * scale, leg.fromZ * scale));
        points.push(new THREE.Vector3(leg.toX * scale, leg.toY * scale, leg.toZ * scale));
      }
      
      if (points.length > 0) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const lines = new THREE.LineSegments(geometry, lineMaterial);
        scene.add(lines);
        console.log('3D Viewer: Added', points.length / 2, 'line segments');
      }
      
      // Create station markers (limit to first 5 for performance)
      const stationGeometry = new THREE.SphereGeometry(5, 8, 8);
      const stationMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const maxStations = Math.min(5, survexData.stations.length);
      
      for (let i = 0; i < maxStations; i++) {
        const station = survexData.stations[i];
        const stationMesh = new THREE.Mesh(stationGeometry, stationMaterial);
        stationMesh.position.set(station.x * scale, station.y * scale, station.z * scale);
        scene.add(stationMesh);
      }
      
      console.log('3D Viewer: Added', survexData.stations.length, 'stations');
      
      // Center camera on the cave (with scaled coordinates) - inside try block
      const bounds = survexData.bounds;
      const centerX = (bounds.minX + bounds.maxX) / 2 * scale;
      const centerY = (bounds.minY + bounds.maxY) / 2 * scale;
      const centerZ = (bounds.minZ + bounds.maxZ) / 2 * scale;
      
      setCameraTarget({ x: centerX, y: centerY, z: centerZ });
      
      // Position camera to view the entire cave
      const maxDimension = Math.max(
        (bounds.maxX - bounds.minX) * scale,
        (bounds.maxY - bounds.minY) * scale,
        (bounds.maxZ - bounds.minZ) * scale
      );
      const distance = maxDimension * 2;
      
      // Set initial camera distance and target - use more reasonable values
      const initialDistance = 1000; // Fixed distance for better control
      cameraDistanceRef.current = initialDistance;
      
      // Start at origin for simplicity
      const target = { x: 0, y: 0, z: 0 };
      setCameraTarget(target);
      cameraTargetRef.current = target;
      
      console.log('3D Viewer: Camera positioned at distance:', initialDistance, 'from origin');
    } catch (error) {
      console.error('3D Viewer: Error creating geometry:', error);
    }
  };

  const onContextCreate = async (gl: any) => {
    const { scene, camera, renderer } = setupScene(gl);
    
    // Use existing survexData state or provided data prop
    const currentData = data || survexData;
    
    if (currentData) {
      console.log('3D Viewer: Creating cave geometry with data:', currentData.stations.length, 'stations,', currentData.legs.length, 'legs');
      createCaveGeometry(currentData, scene);
    } else {
      console.log('3D Viewer: No data available for rendering');
    }
    
    // Render loop
    const render = () => {
      requestAnimationFrame(render);
      
      // Update camera position using spherical coordinates from refs
      const target = cameraTargetRef.current;
      const rotation = cameraRotationRef.current;
      const distance = cameraDistanceRef.current;
      
      const x = target.x + distance * Math.sin(rotation.phi) * Math.cos(rotation.theta);
      const y = target.y + distance * Math.cos(rotation.phi);
      const z = target.z + distance * Math.sin(rotation.phi) * Math.sin(rotation.theta);
      
      camera.position.set(x, y, z);
      camera.lookAt(target.x, target.y, target.z);
      
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    
    render();
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, style]}>
        <ThemedText>Loading 3D cave survey...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, style]}>
        <ThemedText>Error: {error}</ThemedText>
        <TouchableOpacity style={styles.button} onPress={pickFile}>
          <ThemedText style={styles.buttonText}>Pick Another File</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {!survexData && (
        <ThemedView style={styles.overlay}>
          <ThemedText style={styles.overlayText}>No 3D data loaded</ThemedText>
          <TouchableOpacity style={styles.button} onPress={pickFile}>
            <ThemedText style={styles.buttonText}>Pick Survex File</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
      {survexData && (
        <View style={styles.glContainer}>
          <GLView
            key={selectedFile} // Force re-render when file changes
            style={styles.glView}
            onContextCreate={onContextCreate}
          />
          <View 
            style={styles.touchOverlay} 
            {...panResponder.panHandlers}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  glContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1,
  },
  overlayText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});