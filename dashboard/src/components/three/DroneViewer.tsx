/**
 * Three.js Drone Viewer Component
 * 3D visualization of drone with components
 */

'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Environment,
  PerspectiveCamera,
  Html,
  useHelper,
} from '@react-three/drei';
import * as THREE from 'three';

// Types
interface DroneConfig {
  frame: {
    type: 'quadcopter' | 'hexacopter' | 'octocopter';
    armLength: number;
    armCount: number;
  };
  motors: {
    id: string;
    position: { x: number; y: number; z: number };
    thrust: number;
  }[];
  propellers: {
    id: string;
    motorIndex: number;
    direction: 'CW' | 'CCW';
    spinning: boolean;
  }[];
  battery?: {
    position: { x: number; y: number; z: number };
  };
  payload?: {
    position: { x: number; y: number; z: number };
    weight: number;
  };
  tether?: {
    enabled: boolean;
    length: number;
    anchorPoint: { x: number; y: number; z: number };
  };
}

interface DroneViewerProps {
  config: DroneConfig;
  isSimulating?: boolean;
  droneState?: {
    position: { x: number; y: number; z: number };
    rotation: { roll: number; pitch: number; yaw: number };
    motorRpms: number[];
  };
  onComponentClick?: (componentId: string, type: string) => void;
  showGrid?: boolean;
  showAxes?: boolean;
}

// Drone Frame Component
function DroneFrame({ config, onClick }: { config: DroneConfig; onClick?: () => void }) {
  const armPositions = useMemo(() => {
    const positions: { x: number; z: number; angle: number }[] = [];
    const count = config.frame.armCount;

    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count + Math.PI / 4; // Offset for X config
      positions.push({
        x: Math.cos(angle) * config.frame.armLength,
        z: Math.sin(angle) * config.frame.armLength,
        angle: angle,
      });
    }

    return positions;
  }, [config.frame]);

  return (
    <group onClick={onClick}>
      {/* Center body */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 32]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Arms */}
      {armPositions.map((pos, i) => (
        <group key={i}>
          {/* Arm */}
          <mesh
            position={[pos.x / 2, 0, pos.z / 2]}
            rotation={[0, -pos.angle + Math.PI / 2, 0]}
            castShadow
          >
            <boxGeometry args={[config.frame.armLength, 0.015, 0.02]} />
            <meshStandardMaterial color="#2d2d44" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Motor Component
function Motor({
  position,
  thrust,
  index,
  onClick,
}: {
  position: { x: number; y: number; z: number };
  thrust: number;
  index: number;
  onClick?: () => void;
}) {
  const thrustColor = useMemo(() => {
    // Color based on thrust: green -> yellow -> red
    const t = Math.min(thrust / 100, 1);
    if (t < 0.5) {
      return new THREE.Color(0x00ff00).lerp(new THREE.Color(0xffff00), t * 2);
    }
    return new THREE.Color(0xffff00).lerp(new THREE.Color(0xff0000), (t - 0.5) * 2);
  }, [thrust]);

  return (
    <group position={[position.x, position.y, position.z]} onClick={onClick}>
      {/* Motor body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.015, 0.018, 0.025, 16]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Motor cap */}
      <mesh position={[0, 0.015, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
        <meshStandardMaterial color={thrustColor} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Motor index label */}
      <Html position={[0, 0.05, 0]} center>
        <div className="text-xs bg-black/70 text-white px-1 rounded">M{index + 1}</div>
      </Html>
    </group>
  );
}

// Propeller Component
function Propeller({
  position,
  rpm,
  direction,
  spinning,
}: {
  position: { x: number; y: number; z: number };
  rpm: number;
  direction: 'CW' | 'CCW';
  spinning: boolean;
}) {
  const propRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (propRef.current && spinning) {
      const rotationSpeed = (rpm / 60) * 2 * Math.PI * delta;
      propRef.current.rotation.y += direction === 'CW' ? rotationSpeed : -rotationSpeed;
    }
  });

  return (
    <group ref={propRef} position={[position.x, position.y + 0.025, position.z]}>
      {/* Propeller hub */}
      <mesh castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.01, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Propeller blades */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[0, 0.002, 0]}
          rotation={[0, (i * 2 * Math.PI) / 3, 0]}
          castShadow
        >
          <boxGeometry args={[0.08, 0.002, 0.012]} />
          <meshStandardMaterial
            color={direction === 'CW' ? '#00d4ff' : '#ff6b6b'}
            metalness={0.3}
            roughness={0.5}
            transparent
            opacity={spinning ? 0.7 : 1}
          />
        </mesh>
      ))}

      {/* Spinning disc effect */}
      {spinning && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.01, 0.09, 32]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// Battery Component
function Battery({
  position,
  onClick,
}: {
  position: { x: number; y: number; z: number };
  onClick?: () => void;
}) {
  return (
    <group position={[position.x, position.y, position.z]} onClick={onClick}>
      <mesh castShadow>
        <boxGeometry args={[0.06, 0.025, 0.03]} />
        <meshStandardMaterial color="#ff9f43" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Battery connector */}
      <mesh position={[0.035, 0, 0]} castShadow>
        <boxGeometry args={[0.01, 0.015, 0.02]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

// Payload Component
function Payload({
  position,
  weight,
  onClick,
}: {
  position: { x: number; y: number; z: number };
  weight: number;
  onClick?: () => void;
}) {
  const size = Math.cbrt(weight / 1000) * 0.05; // Scale based on weight

  return (
    <group position={[position.x, position.y, position.z]} onClick={onClick}>
      <mesh castShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color="#9b59b6" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  );
}

// Tether Component
function Tether({
  dronePosition,
  anchorPoint,
  enabled,
}: {
  dronePosition: { x: number; y: number; z: number };
  anchorPoint: { x: number; y: number; z: number };
  enabled: boolean;
}) {
  const points = useMemo(() => {
    if (!enabled) return [];

    const start = new THREE.Vector3(dronePosition.x, dronePosition.y - 0.02, dronePosition.z);
    const end = new THREE.Vector3(anchorPoint.x, anchorPoint.y, anchorPoint.z);

    // Create catenary curve
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y -= 0.1; // Sag

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(20);
  }, [dronePosition, anchorPoint, enabled]);

  if (!enabled || points.length === 0) return null;

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffa502" linewidth={2} />
      </line>

      {/* Anchor point */}
      <mesh position={[anchorPoint.x, anchorPoint.y, anchorPoint.z]}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
    </group>
  );
}

// Ground with grid
function Ground() {
  return (
    <group>
      <Grid
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#3a3a5c"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#5a5a8c"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        position={[0, -0.001, 0]}
      />

      {/* Ground plane for shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </group>
  );
}

// Coordinate axes
function Axes({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group>
      {/* X axis - Red */}
      <mesh position={[0.5, 0, 0]}>
        <boxGeometry args={[1, 0.005, 0.005]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <Html position={[1.1, 0, 0]}>
        <span className="text-red-500 text-xs font-bold">X</span>
      </Html>

      {/* Y axis - Green */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.005, 1, 0.005]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <Html position={[0, 1.1, 0]}>
        <span className="text-green-500 text-xs font-bold">Y</span>
      </Html>

      {/* Z axis - Blue */}
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.005, 0.005, 1]} />
        <meshBasicMaterial color="blue" />
      </mesh>
      <Html position={[0, 0, 1.1]}>
        <span className="text-blue-500 text-xs font-bold">Z</span>
      </Html>
    </group>
  );
}

// Main Drone Assembly
function DroneAssembly({
  config,
  droneState,
  isSimulating,
  onComponentClick,
}: {
  config: DroneConfig;
  droneState?: DroneViewerProps['droneState'];
  isSimulating?: boolean;
  onComponentClick?: (componentId: string, type: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Apply drone state transforms
  useFrame(() => {
    if (groupRef.current && droneState) {
      groupRef.current.position.set(
        droneState.position.x,
        droneState.position.y,
        droneState.position.z
      );
      groupRef.current.rotation.set(
        THREE.MathUtils.degToRad(droneState.rotation.roll),
        THREE.MathUtils.degToRad(droneState.rotation.yaw),
        THREE.MathUtils.degToRad(droneState.rotation.pitch)
      );
    }
  });

  const motorPositions = useMemo(() => {
    const positions: { x: number; y: number; z: number }[] = [];
    const count = config.frame.armCount;

    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count + Math.PI / 4;
      positions.push({
        x: Math.cos(angle) * config.frame.armLength,
        y: 0,
        z: Math.sin(angle) * config.frame.armLength,
      });
    }

    return positions;
  }, [config.frame]);

  return (
    <group ref={groupRef}>
      {/* Frame */}
      <DroneFrame config={config} onClick={() => onComponentClick?.('frame', 'frame')} />

      {/* Motors */}
      {motorPositions.map((pos, i) => (
        <Motor
          key={`motor-${i}`}
          position={pos}
          thrust={droneState?.motorRpms?.[i] || 50}
          index={i}
          onClick={() => onComponentClick?.(`motor-${i}`, 'motor')}
        />
      ))}

      {/* Propellers */}
      {motorPositions.map((pos, i) => (
        <Propeller
          key={`prop-${i}`}
          position={pos}
          rpm={droneState?.motorRpms?.[i] || (isSimulating ? 5000 : 0)}
          direction={i % 2 === 0 ? 'CW' : 'CCW'}
          spinning={isSimulating || false}
        />
      ))}

      {/* Battery */}
      {config.battery && (
        <Battery
          position={config.battery.position}
          onClick={() => onComponentClick?.('battery', 'battery')}
        />
      )}

      {/* Payload */}
      {config.payload && (
        <Payload
          position={config.payload.position}
          weight={config.payload.weight}
          onClick={() => onComponentClick?.('payload', 'payload')}
        />
      )}

      {/* Tether */}
      {config.tether && (
        <Tether
          dronePosition={droneState?.position || { x: 0, y: 0.1, z: 0 }}
          anchorPoint={config.tether.anchorPoint}
          enabled={config.tether.enabled}
        />
      )}
    </group>
  );
}

// Camera controller
function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0.5, 0.4, 0.5);
    camera.lookAt(0, 0.1, 0);
  }, [camera]);

  return null;
}

// Main DroneViewer Component
export default function DroneViewer({
  config,
  isSimulating = false,
  droneState,
  onComponentClick,
  showGrid = true,
  showAxes = false,
}: DroneViewerProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <PerspectiveCamera makeDefault position={[0.5, 0.4, 0.5]} fov={50} near={0.01} far={100} />
        <CameraController />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-5, 5, -5]} intensity={0.3} color="#00d4ff" />

        {/* Environment */}
        <Environment preset="city" background={false} />

        {/* Scene content */}
        {showGrid && <Ground />}
        <Axes visible={showAxes} />

        <DroneAssembly
          config={config}
          droneState={droneState}
          isSimulating={isSimulating}
          onComponentClick={onComponentClick}
        />

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.2}
          maxDistance={5}
          maxPolarAngle={Math.PI / 2 + 0.1}
          target={[0, 0.05, 0]}
        />
      </Canvas>

      {/* Overlay info */}
      <div className="absolute bottom-4 left-4 text-xs text-white/50">
        <div>Scroll to zoom • Drag to rotate • Shift+drag to pan</div>
      </div>
    </div>
  );
}
