import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as THREE from 'three';
import { SurvexParser } from '../lib/survex-parser';
import { SurvexData } from '../lib/survex-types';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface SurvexViewerProps {
  data?: SurvexData;
  style?: any;
}

// Get dynamic dimensions in render
const getDimensions = () => Dimensions.get('window');

export default function SurvexViewer({ data, style }: SurvexViewerProps) {
  const [error, setError] = useState<string | null>(null);
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
  const [compassHeading, setCompassHeading] = useState(0);
  const [tiltAngle, setTiltAngle] = useState(0);
  
  // Utility function to calculate distance between two touch points
  const calculateDistance = (touch1: any, touch2: any) => {
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Function to update compass and tilt indicators
  const updateCameraIndicators = (theta: number, phi: number) => {
    // Convert theta to compass heading (0 = North, 90 = East, 180 = South, 270 = West)
    let heading = ((theta * 180 / Math.PI) + 90) % 360;
    if (heading < 0) heading += 360;
    setCompassHeading(Math.round(heading));
    
    // Convert phi to tilt angle (0 = horizontal, +90 = looking down, -90 = looking up)
    // Invert the sign to match expected behavior
    const tilt = -(phi - Math.PI / 2) * 180 / Math.PI;
    setTiltAngle(Math.round(tilt));
  };
  
  // Use refs for camera values - keep upright view
  const cameraRotationRef = useRef({ theta: 0, phi: Math.PI / 2 }); // phi = 90 degrees for side view
  const cameraDistanceRef = useRef(100); // Will be dynamically set based on cave size
  const cameraTargetRef = useRef({ x: 0, y: 0, z: 0 });
  const caveSizeRef = useRef({ min: 10, max: 500 }); // Dynamic zoom bounds

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
        updateCameraIndicators(newTheta, newPhi);
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
            // Use dynamic zoom bounds based on cave size
            const bounds = caveSizeRef.current;
            const newDistance = Math.max(bounds.min, Math.min(bounds.max, currentCameraDistance / scaledZoom));
            
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


  const loadSurvexFile = async (fileUri?: string) => {
    try {
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
      1, // Increased near plane for better precision
      10000 // Increased far plane to handle max zoom distance
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
      
      // Calculate the maximum dimension of the cave to auto-scale appropriately
      const rawDimensions = {
        width: survexData.bounds.maxX - survexData.bounds.minX,
        height: survexData.bounds.maxY - survexData.bounds.minY,
        depth: survexData.bounds.maxZ - survexData.bounds.minZ
      };
      const maxDimension = Math.max(rawDimensions.width, rawDimensions.height, rawDimensions.depth);
      
      // Validate max dimension and use fallback if invalid
      let scale;
      if (maxDimension <= 0 || !isFinite(maxDimension)) {
        console.warn('3D Viewer: Invalid cave dimensions, using fallback scaling');
        scale = 1; // Fallback scale
      } else {
        // Scale so the largest dimension is about 50 units (good for camera distance 100)
        const targetSize = 50;
        scale = targetSize / maxDimension;
      }
      
      console.log('3D Viewer: Raw dimensions:', rawDimensions);
      console.log('3D Viewer: Max dimension:', maxDimension, 'Scale factor:', scale.toExponential(2));
      
      // Calculate final scaled bounds with coordinate rotation
      // Y becomes Z, Z becomes Y (90 degree rotation around X-axis in opposite direction)
      const scaledBounds = {
        minX: survexData.bounds.minX * scale,
        maxX: survexData.bounds.maxX * scale,
        minY: survexData.bounds.minZ * scale,   // Z becomes Y
        maxY: survexData.bounds.maxZ * scale,   // Z becomes Y
        minZ: survexData.bounds.minY * scale,   // Y becomes Z
        maxZ: survexData.bounds.maxY * scale    // Y becomes Z
      };
      const scaledDimensions = {
        width: scaledBounds.maxX - scaledBounds.minX,
        height: scaledBounds.maxY - scaledBounds.minY,
        depth: scaledBounds.maxZ - scaledBounds.minZ
      };
      
      // Calculate max scaled dimension for later use
      const maxScaledDimension = Math.max(scaledDimensions.width, scaledDimensions.height, scaledDimensions.depth);
      
      console.log('3D Viewer: Scaled bounds:', scaledBounds);
      console.log('3D Viewer: Scaled dimensions:', scaledDimensions);
      console.log('3D Viewer: Max scaled dimension:', maxScaledDimension.toFixed(3));
      
      // Create material for cave lines
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 2,
      });
      
      // Create geometry for cave survey lines (show all legs)
      const points: THREE.Vector3[] = [];
      const maxLegs = survexData.legs.length; // Show all legs, no limit
      
      for (let i = 0; i < maxLegs; i++) {
        const leg = survexData.legs[i];
        // Rotate coordinates: Y becomes Z, Z becomes Y (90 degree rotation around X-axis in opposite direction)
        const fromPoint = new THREE.Vector3(leg.fromX * scale, leg.fromZ * scale, leg.fromY * scale);
        const toPoint = new THREE.Vector3(leg.toX * scale, leg.toZ * scale, leg.toY * scale);
        points.push(fromPoint);
        points.push(toPoint);
        
        // Debug: Log first few points to understand scale
        if (i < 3) {
          console.log(`3D Viewer: Leg ${i}:`, {
            raw: { fromX: leg.fromX, fromY: leg.fromY, fromZ: leg.fromZ, toX: leg.toX, toY: leg.toY, toZ: leg.toZ },
            scaled: { from: fromPoint, to: toPoint }
          });
        }
      }
      
      if (points.length > 0) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const lines = new THREE.LineSegments(geometry, lineMaterial);
        scene.add(lines);
        console.log('3D Viewer: Added', points.length / 2, 'line segments');
      }
      
      // Create station markers (show all stations)
      // Size proportional to cave scale (1% of max dimension)
      let stationSize = maxScaledDimension * 0.01;
      
      // Validate station size and use fallback if invalid
      if (isNaN(stationSize) || !isFinite(stationSize) || stationSize <= 0) {
        console.warn('3D Viewer: Invalid station size calculated, using fallback. maxScaledDimension:', maxScaledDimension || 'undefined');
        stationSize = 0.5; // Fallback size
      } else {
        stationSize = Math.max(0.1, stationSize); // Ensure minimum size
      }
      
      const stationGeometry = new THREE.SphereGeometry(stationSize, 8, 8);
      console.log('3D Viewer: Station marker size:', stationSize.toFixed(3), 'maxScaledDimension:', (maxScaledDimension || 0).toFixed(3));
      const stationMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const maxStations = survexData.stations.length; // Show all stations, no limit
      
      for (let i = 0; i < maxStations; i++) {
        const station = survexData.stations[i];
        const stationMesh = new THREE.Mesh(stationGeometry, stationMaterial);
        // Rotate coordinates: Y becomes Z, Z becomes Y (90 degree rotation around X-axis in opposite direction)
        stationMesh.position.set(station.x * scale, station.z * scale, station.y * scale);
        scene.add(stationMesh);
      }
      
      console.log('3D Viewer: Added', maxStations, 'stations out of', survexData.stations.length, 'total');
      
      // Center camera on the actual cave center
      const centerX = (scaledBounds.minX + scaledBounds.maxX) / 2;
      const centerY = (scaledBounds.minY + scaledBounds.maxY) / 2;
      const centerZ = (scaledBounds.minZ + scaledBounds.maxZ) / 2;
      
      const target = { x: centerX, y: centerY, z: centerZ };
      setCameraTarget(target);
      cameraTargetRef.current = target;
      
      // Set camera distance to show the entire cave nicely
      // Use the largest scaled dimension to determine good viewing distance
      const initialDistance = maxScaledDimension * 2; // 2x the size for good overview
      cameraDistanceRef.current = initialDistance;
      
      // Set dynamic zoom bounds based on cave size
      const minZoom = maxScaledDimension * 0.5; // Can get quite close
      const maxZoom = maxScaledDimension * 5;   // Can zoom out to 5x the cave size
      caveSizeRef.current = { min: minZoom, max: maxZoom };
      
      console.log('3D Viewer: Cave center:', target);
      console.log('3D Viewer: Initial camera distance:', initialDistance.toFixed(1), 'for max dimension:', maxScaledDimension.toFixed(1));
      console.log('3D Viewer: Zoom bounds:', { min: minZoom.toFixed(1), max: maxZoom.toFixed(1) });
    } catch (error) {
      console.error('3D Viewer: Error creating geometry:', error);
    }
  };

  const onContextCreate = async (gl: any) => {
    const { scene, camera, renderer } = setupScene(gl);
    
    // Use provided data prop
    if (data) {
      console.log('3D Viewer: Creating cave geometry with data:', data.stations.length, 'stations,', data.legs.length, 'legs');
      createCaveGeometry(data, scene);
    } else {
      console.log('3D Viewer: No data provided');
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
      
      // Update indicators occasionally (every 30 frames = ~0.5 second)
      if (Math.random() < 0.033) { // ~1/30 chance each frame
        updateCameraIndicators(rotation.theta, rotation.phi);
        
        // Debug: Log camera info occasionally (every 60 frames = ~1 second)
        if (Math.random() < 0.5) { // Half the time when updating indicators
          console.log('3D Viewer: Camera -', {
            position: { x: x.toFixed(1), y: y.toFixed(1), z: z.toFixed(1) },
            target: { x: target.x.toFixed(1), y: target.y.toFixed(1), z: target.z.toFixed(1) },
            distance: distance.toFixed(1),
            rotation: { theta: rotation.theta.toFixed(2), phi: rotation.phi.toFixed(2) }
          });
        }
      }
      
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    
    render();
  };


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
      {!data && (
        <ThemedView style={styles.overlay}>
          <ThemedText style={styles.overlayText}>No 3D data loaded</ThemedText>
        </ThemedView>
      )}
      {data && (
        <View style={styles.glContainer}>
          <GLView
            style={styles.glView}
            onContextCreate={onContextCreate}
          />
          <View 
            style={styles.touchOverlay} 
            {...panResponder.panHandlers}
          />
          
          {/* Camera indicators overlay */}
          <View style={styles.indicatorsOverlay}>
            <View style={styles.compassIndicator}>
              <Text style={styles.indicatorLabel}>Compass</Text>
              <Text style={styles.indicatorValue}>{compassHeading}°</Text>
              <Text style={styles.indicatorDirection}>
                {compassHeading >= 337.5 || compassHeading < 22.5 ? 'N' :
                 compassHeading >= 22.5 && compassHeading < 67.5 ? 'NE' :
                 compassHeading >= 67.5 && compassHeading < 112.5 ? 'E' :
                 compassHeading >= 112.5 && compassHeading < 157.5 ? 'SE' :
                 compassHeading >= 157.5 && compassHeading < 202.5 ? 'S' :
                 compassHeading >= 202.5 && compassHeading < 247.5 ? 'SW' :
                 compassHeading >= 247.5 && compassHeading < 292.5 ? 'W' : 'NW'}
              </Text>
            </View>
            
            <View style={styles.tiltIndicator}>
              <Text style={styles.indicatorLabel}>Tilt</Text>
              <Text style={styles.indicatorValue}>{tiltAngle}°</Text>
              <Text style={styles.indicatorDirection}>
                {tiltAngle > 60 ? 'Down' :
                 tiltAngle > 30 ? 'Down-Angled' :
                 tiltAngle > -30 ? 'Horizontal' :
                 tiltAngle > -60 ? 'Up-Angled' : 'Up'}
              </Text>
            </View>
          </View>
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
  indicatorsOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    flexDirection: 'column',
    gap: 10,
  },
  compassIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  tiltIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  indicatorLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  indicatorValue: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  indicatorDirection: {
    color: '#cccccc',
    fontSize: 10,
    marginTop: 2,
  },
});