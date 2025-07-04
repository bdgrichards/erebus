import React, { useState, useRef } from 'react';
import { View, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { ThemedText } from '@/components/ThemedText';

export default function Demo() {

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
      setIsRotating(true);
      setLastTouch({
        x: evt.nativeEvent.pageX,
        y: evt.nativeEvent.pageY,
      });
    },
    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;
      
      if (touches.length === 1 && isRotating && !isPinching) {
        const deltaX = evt.nativeEvent.pageX - lastTouch.x;
        const deltaY = evt.nativeEvent.pageY - lastTouch.y;
        
        const sensitivity = 0.01;
        const newTheta = cameraRotationRef.current.theta + deltaX * sensitivity;
        const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraRotationRef.current.phi - deltaY * sensitivity));
        
        cameraRotationRef.current = { theta: newTheta, phi: newPhi };
        
        setLastTouch({
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        });
      } else if (touches.length === 2) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const centerX = (touch1.pageX + touch2.pageX) / 2;
        const centerY = (touch1.pageY + touch2.pageY) / 2;
        const currentDistance = calculateDistance(touch1, touch2);
        
        if (!isPinching) {
          setIsPinching(true);
          setLastTouch({ x: centerX, y: centerY });
          setInitialPinchDistance(currentDistance);
          setGestureMode('none');
        } else {
          const distanceChange = Math.abs(currentDistance - initialPinchDistance);
          const positionChange = Math.sqrt(
            Math.pow(centerX - lastTouch.x, 2) + Math.pow(centerY - lastTouch.y, 2)
          );
          
          if (gestureMode === 'none') {
            if (distanceChange > 10) {
              setGestureMode('pinch');
            } else if (positionChange > 5) {
              setGestureMode('pan');
            }
          }
          
          if (gestureMode === 'pinch') {
            const zoomFactor = currentDistance / initialPinchDistance;
            const currentCameraDistance = cameraDistanceRef.current;
            const zoomSensitivity = 0.8;
            const scaledZoom = Math.pow(zoomFactor, zoomSensitivity);
            const newDistance = Math.max(2, Math.min(50, currentCameraDistance / scaledZoom));
            
            cameraDistanceRef.current = newDistance;
            setInitialPinchDistance(currentDistance);
          }
          
          else if (gestureMode === 'pan') {
            const deltaX = centerX - lastTouch.x;
            const deltaY = centerY - lastTouch.y;
            
            if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
              const panSensitivity = 0.02;
              const rotation = cameraRotationRef.current;
              const currentTarget = cameraTargetRef.current;
              
              const cosTheta = Math.cos(rotation.theta - Math.PI / 2);
              const sinTheta = Math.sin(rotation.theta - Math.PI / 2);
              
              const panX = -deltaX * panSensitivity;
              const worldPanX = panX * cosTheta;
              const worldPanZ = panX * sinTheta;
              
              const newTarget = {
                x: currentTarget.x + worldPanX,
                y: currentTarget.y + deltaY * panSensitivity,
                z: currentTarget.z + worldPanZ
              };
              
              cameraTargetRef.current = newTarget;
              setLastTouch({ x: centerX, y: centerY });
            }
          }
        }
      }
    },
    onPanResponderRelease: () => {
      setIsRotating(false);
      if (isPinching) {
        setIsPinching(false);
        setGestureMode('none');
      }
    },
  });

  const onContextCreate = async (gl: any) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      wireframe: false 
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    scene.add(wireframe);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    const render = () => {
      requestAnimationFrame(render);
      
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

  const handleBack = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>
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