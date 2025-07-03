import React, { useState, useRef } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function DemoScreen() {
  // Touch handling state
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
  
  // Use refs to store values that render loop needs to access
  const cameraRotationRef = useRef({ theta: 0, phi: Math.PI / 4 });
  const cameraDistanceRef = useRef(10);
  const cameraTargetRef = useRef({ x: 0, y: 0, z: 0 });
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);

  // Pan responder for touch controls
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      console.log('Demo: Touch started');
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
        console.log('Demo: Rotation', newTheta.toFixed(2), newPhi.toFixed(2));
        
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
          console.log('Demo: Two-finger gesture started');
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
              console.log('Demo: Pinch mode activated');
            } else if (positionChange > 5) {
              setGestureMode('pan');
              console.log('Demo: Pan mode activated');
            }
          }
          
          // Handle pinch to zoom
          if (gestureMode === 'pinch') {
            const zoomFactor = currentDistance / initialPinchDistance;
            const currentCameraDistance = cameraDistanceRef.current;
            // Apply logarithmic scaling for smoother zoom
            const zoomSensitivity = 0.8;
            const scaledZoom = Math.pow(zoomFactor, zoomSensitivity);
            const newDistance = Math.max(2, Math.min(50, currentCameraDistance / scaledZoom));
            
            cameraDistanceRef.current = newDistance;
            console.log('Demo: Zoom:', zoomFactor.toFixed(2), 'Distance:', newDistance.toFixed(1));
            
            // Update initial distance for smooth continuous zooming
            setInitialPinchDistance(currentDistance);
          }
          
          // Handle camera-relative panning
          else if (gestureMode === 'pan') {
            const deltaX = centerX - lastTouch.x;
            const deltaY = centerY - lastTouch.y;
            
            if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
              const panSensitivity = 0.02;
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
              console.log('Demo: Camera-relative pan:', deltaX.toFixed(1), deltaY.toFixed(1), 'Target:', newTarget.x.toFixed(2), newTarget.y.toFixed(2));
              setLastTouch({ x: centerX, y: centerY });
            }
          }
        }
      }
    },
    onPanResponderRelease: () => {
      console.log('Demo: Touch released');
      setIsRotating(false);
      if (isPinching) {
        setIsPinching(false);
        setGestureMode('none');
        console.log('Demo: Two-finger gesture ended');
      }
    },
  });

  const onContextCreate = async (gl: any) => {
    console.log('Demo: Creating 3D scene');
    
    // Get current screen dimensions
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // Use the actual GL drawing buffer size for accurate rendering
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    
    console.log('Demo: Screen dimensions', screenWidth, screenHeight);
    console.log('Demo: GL buffer dimensions', width, height);
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    
    // Create renderer
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    
    console.log('Demo: Renderer configured for', width, height);
    
    // Store references
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    
    // Create a simple colored cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      wireframe: false 
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Add some wireframe edges to make rotation more visible
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    scene.add(wireframe);
    
    // Add some lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    console.log('Demo: Scene created with cube');
    
    // Render loop
    const render = () => {
      requestAnimationFrame(render);
      
      // Update camera position using spherical coordinates from refs
      const rotation = cameraRotationRef.current;
      const distance = cameraDistanceRef.current;
      const target = cameraTargetRef.current;
      
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

  return (
    <View style={styles.container}>
      <View style={styles.glContainer}>
        <GLView
          style={styles.glView}
          onContextCreate={onContextCreate}
        />
        <View 
          style={styles.touchOverlay} 
          {...panResponder.panHandlers}
        />
      </View>
      
      <View style={styles.debugOverlay}>
        <ThemedText style={styles.debugText}>Simple 3D Demo - Touch to rotate</ThemedText>
      </View>
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
  debugOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  debugText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
});