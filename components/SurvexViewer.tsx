import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import React, { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import * as THREE from "three";
import { SurvexData } from "../lib/survex-types";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

interface SurvexViewerProps {
  data?: SurvexData;
  style?: any;
}

export default function SurvexViewer({ data, style }: SurvexViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);

  // Touch handling state
  const [isRotating, setIsRotating] = useState(false);
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = useState(0);
  const [gestureMode, setGestureMode] = useState<"none" | "pan" | "pinch">(
    "none"
  );
  const [compassHeading, setCompassHeading] = useState(0);
  const [tiltAngle, setTiltAngle] = useState(0);

  // Camera control refs
  const cameraRotationRef = useRef({ theta: 0, phi: Math.PI / 4 });
  const cameraDistanceRef = useRef(100);
  const cameraTargetRef = useRef({ x: 0, y: 0, z: 0 });
  const caveSizeRef = useRef({ min: 10, max: 500 });

  // Utility function to calculate distance between two touch points
  const calculateDistance = (touch1: any, touch2: any) => {
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

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
        const newPhi = Math.max(
          0.1,
          Math.min(
            Math.PI - 0.1,
            cameraRotationRef.current.phi - deltaY * sensitivity
          )
        );

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
          setGestureMode("none");
        } else {
          const distanceChange = Math.abs(
            currentDistance - initialPinchDistance
          );
          const positionChange = Math.sqrt(
            Math.pow(centerX - lastTouch.x, 2) +
              Math.pow(centerY - lastTouch.y, 2)
          );

          if (gestureMode === "none") {
            if (distanceChange > 10) {
              setGestureMode("pinch");
            } else if (positionChange > 5) {
              setGestureMode("pan");
            }
          }

          if (gestureMode === "pinch") {
            const zoomFactor = currentDistance / initialPinchDistance;
            const currentCameraDistance = cameraDistanceRef.current;
            const zoomSensitivity = 0.8;
            const scaledZoom = Math.pow(zoomFactor, zoomSensitivity);
            const caveSize = caveSizeRef.current;
            const newDistance = Math.max(
              caveSize.min,
              Math.min(caveSize.max, currentCameraDistance / scaledZoom)
            );

            cameraDistanceRef.current = newDistance;
            setInitialPinchDistance(currentDistance);
          } else if (gestureMode === "pan") {
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
                z: currentTarget.z + worldPanZ,
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
        setGestureMode("none");
      }
    },
  });

  const updateCameraIndicators = (theta: number, phi: number) => {
    const heading = ((theta * 180) / Math.PI + 360) % 360;
    const tilt = ((Math.PI / 2 - phi) * 180) / Math.PI;

    setCompassHeading(Math.round(heading));
    setTiltAngle(Math.round(tilt));
  };

  const setupScene = (gl: any) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    return { scene, camera, renderer };
  };

  const createCaveGeometry = (survexData: SurvexData, scene: THREE.Scene) => {
    try {
      const rawDimensions = {
        width: survexData.bounds.maxX - survexData.bounds.minX,
        height: survexData.bounds.maxY - survexData.bounds.minY,
        depth: survexData.bounds.maxZ - survexData.bounds.minZ,
      };
      const maxDimension = Math.max(
        rawDimensions.width,
        rawDimensions.height,
        rawDimensions.depth
      );

      let scale;
      if (maxDimension <= 0 || !isFinite(maxDimension)) {
        scale = 1;
      } else {
        const targetSize = 50;
        scale = targetSize / maxDimension;
      }

      const scaledBounds = {
        minX: survexData.bounds.minX * scale,
        maxX: survexData.bounds.maxX * scale,
        minY: survexData.bounds.minZ * scale,
        maxY: survexData.bounds.maxZ * scale,
        minZ: survexData.bounds.minY * scale,
        maxZ: survexData.bounds.maxY * scale,
      };

      const scaledDimensions = {
        width: scaledBounds.maxX - scaledBounds.minX,
        height: scaledBounds.maxY - scaledBounds.minY,
        depth: scaledBounds.maxZ - scaledBounds.minZ,
      };

      const maxScaledDimension = Math.max(
        scaledDimensions.width,
        scaledDimensions.height,
        scaledDimensions.depth
      );

      // Create cave survey lines
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 2,
      });

      const points: THREE.Vector3[] = [];
      for (let i = 0; i < survexData.legs.length; i++) {
        const leg = survexData.legs[i];
        const fromPoint = new THREE.Vector3(
          leg.fromX * scale,
          leg.fromZ * scale,
          leg.fromY * scale
        );
        const toPoint = new THREE.Vector3(
          leg.toX * scale,
          leg.toZ * scale,
          leg.toY * scale
        );
        points.push(fromPoint);
        points.push(toPoint);
      }

      if (points.length > 0) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const lines = new THREE.LineSegments(geometry, lineMaterial);
        scene.add(lines);
      }

      // Create station markers
      let stationSize = maxScaledDimension * 0.01;
      if (isNaN(stationSize) || !isFinite(stationSize) || stationSize <= 0) {
        stationSize = 0.5;
      } else {
        stationSize = Math.max(0.1, stationSize);
      }

      const stationGeometry = new THREE.SphereGeometry(stationSize, 8, 8);
      const stationMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

      for (let i = 0; i < survexData.stations.length; i++) {
        const station = survexData.stations[i];
        const stationMesh = new THREE.Mesh(stationGeometry, stationMaterial);
        stationMesh.position.set(
          station.x * scale,
          station.z * scale,
          station.y * scale
        );
        scene.add(stationMesh);
      }

      // Center camera
      const centerX = (scaledBounds.minX + scaledBounds.maxX) / 2;
      const centerY = (scaledBounds.minY + scaledBounds.maxY) / 2;
      const centerZ = (scaledBounds.minZ + scaledBounds.maxZ) / 2;

      const target = { x: centerX, y: centerY, z: centerZ };
      cameraTargetRef.current = target;

      const initialDistance = maxScaledDimension * 2;
      cameraDistanceRef.current = initialDistance;

      const minZoom = maxScaledDimension * 0.5;
      const maxZoom = maxScaledDimension * 5;
      caveSizeRef.current = { min: minZoom, max: maxZoom };
    } catch (error) {
      console.error("3D Viewer: Error creating geometry:", error);
      setError("Failed to create 3D geometry");
    }
  };

  const onContextCreate = async (gl: any) => {
    const { scene, camera, renderer } = setupScene(gl);

    if (data) {
      createCaveGeometry(data, scene);
    }

    const render = () => {
      requestAnimationFrame(render);

      const rotation = cameraRotationRef.current;
      const distance = cameraDistanceRef.current;
      const target = cameraTargetRef.current;

      const x =
        target.x + distance * Math.sin(rotation.phi) * Math.cos(rotation.theta);
      const y = target.y + distance * Math.cos(rotation.phi);
      const z =
        target.z + distance * Math.sin(rotation.phi) * Math.sin(rotation.theta);

      camera.position.set(x, y, z);
      camera.lookAt(target.x, target.y, target.z);

      updateCameraIndicators(rotation.theta, rotation.phi);

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    render();
  };

  if (error) {
    return (
      <ThemedView style={[styles.container, style]}>
        <ThemedText>Error: {error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {data && (
        <View style={styles.glContainer}>
          <GLView style={styles.glView} onContextCreate={onContextCreate} />
          <View style={styles.touchOverlay} {...panResponder.panHandlers} />
        </View>
      )}
      {data && (
        <View style={styles.indicatorsOverlay}>
          <View style={styles.compassIndicator}>
            <Text style={styles.indicatorLabel}>Compass</Text>
            <Text style={styles.indicatorValue}>{compassHeading}°</Text>
            <Text style={styles.indicatorDirection}>
              {compassHeading >= 337.5 || compassHeading < 22.5
                ? "N"
                : compassHeading >= 22.5 && compassHeading < 67.5
                ? "NE"
                : compassHeading >= 67.5 && compassHeading < 112.5
                ? "E"
                : compassHeading >= 112.5 && compassHeading < 157.5
                ? "SE"
                : compassHeading >= 157.5 && compassHeading < 202.5
                ? "S"
                : compassHeading >= 202.5 && compassHeading < 247.5
                ? "SW"
                : compassHeading >= 247.5 && compassHeading < 292.5
                ? "W"
                : "NW"}
            </Text>
          </View>

          <View style={styles.tiltIndicator}>
            <Text style={styles.indicatorLabel}>Tilt</Text>
            <Text style={styles.indicatorValue}>{tiltAngle}°</Text>
            <Text style={styles.indicatorDirection}>
              {tiltAngle > 60
                ? "Down"
                : tiltAngle > 30
                ? "Down-Angled"
                : tiltAngle > -30
                ? "Horizontal"
                : tiltAngle > -60
                ? "Up-Angled"
                : "Up"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  glContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  touchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  indicatorsOverlay: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
    pointerEvents: "none",
  },
  compassIndicator: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    minWidth: 80,
  },
  tiltIndicator: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    width: 90,
  },
  indicatorLabel: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  indicatorValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 2,
  },
  indicatorDirection: {
    color: "white",
    fontSize: 10,
    marginTop: 2,
  },
});
