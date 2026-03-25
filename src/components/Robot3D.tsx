import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface Robot3DProps {
  expression: string;
  action: string;
  isSpeaking: boolean;
  faceX?: number;
  faceY?: number;
  audioLevel?: number;
}

const RobotModel: React.FC<Robot3DProps> = ({ expression, action, isSpeaking, faceX = 0, faceY = 0, audioLevel = 0 }) => {
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const screenRef = useRef<THREE.Group>(null);

  // Materials based on the image and user request
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, metalness: 0.1 }), []);
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({ 
    color: '#f1f5f9',
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.95,
    thickness: 0.5,
    envMapIntensity: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.05
  }), []);
  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.1, metalness: 0.8 }), []);
  const orangeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fb923c', roughness: 0.5, metalness: 0.2 }), []);
  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 }), []);
  const emissiveMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#60a5fa', emissive: '#60a5fa', emissiveIntensity: 4 }), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (headRef.current) {
      // Head tracking
      const targetRotationY = faceX * 0.6;
      const targetRotationX = faceY * -0.4;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetRotationY, 0.1);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetRotationX, 0.1);
    }

    if (bodyRef.current) {
      // Breathing / Idle sway
      bodyRef.current.position.y = Math.sin(t * 1.5) * 0.03;
      bodyRef.current.rotation.y = Math.sin(t * 0.5) * 0.02;
    }

      // Arm and Body movement
      if (leftArmRef.current && rightArmRef.current && bodyRef.current && headRef.current) {
        const armSway = Math.sin(t * 1.5) * 0.05;
        
        // Base targets
        let leftTargetX = 0;
        let rightTargetX = 0;
        let leftTargetZ = 0.2 + armSway;
        let rightTargetZ = -0.2 - armSway;
        let bodyTargetY = Math.sin(t * 1.5) * 0.03;
        let bodyTargetRotY = Math.sin(t * 0.5) * 0.02;
        let headTargetRotZ = 0;

        // Coordinated Actions mapping
        switch (action) {
          case '挥手':
          case 'Waving':
            // Enthusiastic waving
            rightTargetX = -1.8 + Math.sin(t * 2) * 0.1;
            rightTargetZ = -0.8 + Math.sin(t * 12) * 0.6;
            bodyTargetRotY = 0.1 + Math.sin(t * 2) * 0.05;
            headTargetRotZ = Math.sin(t * 2) * 0.1;
            break;
          
          case '竖起大拇指':
            // Thumbs up with a little "pump" motion
            rightTargetX = -1.4 + Math.sin(t * 8) * 0.1;
            rightTargetZ = -0.4;
            bodyTargetY += 0.05 + Math.sin(t * 8) * 0.02;
            headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -0.2, 0.1);
            break;

          case '比耶':
            // Victory sign with both arms slightly raised
            leftTargetX = -1.5 + Math.sin(t * 3) * 0.1;
            rightTargetX = -1.5 + Math.cos(t * 3) * 0.1;
            leftTargetZ = 0.6 + Math.sin(t * 6) * 0.15;
            rightTargetZ = -0.6 - Math.sin(t * 6) * 0.15;
            bodyTargetY += Math.sin(t * 4) * 0.03;
            break;

          case '张开双臂':
            // Big hug motion
            leftTargetZ = 1.3 + Math.sin(t * 2) * 0.1;
            rightTargetZ = -1.3 - Math.sin(t * 2) * 0.1;
            leftTargetX = -0.4;
            rightTargetX = -0.4;
            bodyTargetY += 0.08;
            headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -0.1, 0.1);
            break;

          case '开心摇摆':
            // Full body happy dance
            bodyTargetRotY = Math.sin(t * 5) * 0.3;
            bodyTargetY += Math.abs(Math.sin(t * 10)) * 0.05;
            leftTargetX = -0.5 + Math.sin(t * 5) * 0.4;
            rightTargetX = -0.5 + Math.cos(t * 5) * 0.4;
            leftTargetZ = 0.4 + Math.sin(t * 5) * 0.2;
            rightTargetZ = -0.4 - Math.cos(t * 5) * 0.2;
            break;

          case '低头安慰':
            // Sad/Empathy pose
            headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0.5, 0.1);
            leftTargetX = -0.4;
            rightTargetX = -0.4;
            leftTargetZ = 0.3;
            rightTargetZ = -0.3;
            bodyTargetY -= 0.08;
            bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0.1, 0.1);
            break;

          case '害怕后退':
            // Retreating in fear
            bodyRef.current.position.z = THREE.MathUtils.lerp(bodyRef.current.position.z, -0.8, 0.05);
            leftTargetZ = 0.9;
            rightTargetZ = -0.9;
            leftTargetX = -0.2;
            rightTargetX = -0.2;
            headTargetRotZ = Math.sin(t * 20) * 0.15;
            bodyTargetY += Math.sin(t * 15) * 0.01;
            break;

          case '后仰惊讶':
          case 'Surprised':
            // Sudden surprise
            bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, -0.4, 0.2);
            bodyRef.current.position.z = THREE.MathUtils.lerp(bodyRef.current.position.z, -0.3, 0.1);
            leftTargetZ = 1.4;
            rightTargetZ = -1.4;
            leftTargetX = -1.0;
            rightTargetX = -1.0;
            headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -0.3, 0.2);
            break;

          case '捂耳朵/转头':
            // Reacting to loud noise
            leftTargetX = -2.0;
            rightTargetX = -2.0;
            leftTargetZ = 0.3;
            rightTargetZ = -0.3;
            headTargetRotZ = Math.sin(t * 25) * 0.25;
            bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0.1, 0.2);
            break;

          case '歪头询问':
            // Curious head tilt
            headTargetRotZ = 0.4 + Math.sin(t * 2) * 0.05;
            bodyTargetRotY = -0.1;
            break;

          case '挠头困惑':
          case 'Thinking':
            // Thinking/Confused scratching head
            leftTargetX = -2.4 + Math.sin(t * 15) * 0.1;
            leftTargetZ = 0.2;
            headTargetRotZ = -0.25;
            bodyTargetRotY = 0.1;
            break;

          case '左右环顾':
            // Looking around
            headRef.current.rotation.y = Math.sin(t * 1.5) * 1.0;
            bodyTargetRotY = Math.sin(t * 1.5) * 0.2;
            break;

          case '转身离开':
            // Turning away
            bodyTargetRotY = Math.PI * 0.85;
            bodyRef.current.position.z = THREE.MathUtils.lerp(bodyRef.current.position.z, -2, 0.01);
            break;
          
          case '观察环境':
            // Scanning environment
            headRef.current.rotation.y = Math.sin(t * 0.8) * 1.2;
            headRef.current.rotation.x = Math.cos(t * 0.5) * 0.3;
            bodyTargetRotY = Math.sin(t * 0.8) * 0.3;
            break;

          case '主动搭话':
            // Leaning forward to talk
            bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0.2, 0.1);
            bodyRef.current.position.z = THREE.MathUtils.lerp(bodyRef.current.position.z, 0.3, 0.1);
            leftTargetX = Math.sin(t * 5) * 0.2;
            rightTargetX = Math.cos(t * 5) * 0.2;
            break;

          default:
            if (isSpeaking) {
              // Animated talking gestures
              leftTargetX = Math.sin(t * 12) * 0.2;
              rightTargetX = Math.cos(t * 12) * 0.2;
              leftTargetZ = 0.3 + Math.sin(t * 3) * 0.1;
              rightTargetZ = -0.3 - Math.cos(t * 3) * 0.1;
              bodyTargetY += Math.sin(t * 6) * 0.02;
            }
            // Reset position z and rotation x if not in specific action
            bodyRef.current.position.z = THREE.MathUtils.lerp(bodyRef.current.position.z, 0, 0.05);
            bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, 0.1);
            break;
        }

        // Apply lerped values
        bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, bodyTargetY, 0.1);
        bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, bodyTargetRotY, 0.1);
        headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, headTargetRotZ, 0.1);

        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, leftTargetX, 0.1);
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, rightTargetX, 0.1);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, leftTargetZ, 0.1);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, rightTargetZ, 0.1);
      }

    // Mouth movement (on screen)
    if (mouthRef.current) {
      const targetScale = isSpeaking ? 1 + audioLevel * 4 : 0.1;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetScale, 0.2);
    }

    // Screen expression animation
    if (screenRef.current) {
      const blink = Math.sin(t * 3) > 0.98 ? 0.1 : 1;
      screenRef.current.children.forEach((child, i) => {
        if (child.name === 'eye') {
          child.scale.y = THREE.MathUtils.lerp(child.scale.y, blink, 0.5);
        }
      });
    }
  });

  return (
    <group position={[0, -0.5, 0]}>
      {/* Torso & Waist */}
      <group ref={bodyRef}>
        {/* Upper Torso (White) */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.4, 8, 16]} />
          <primitive object={whiteMat} attach="material" />
        </mesh>
        
        {/* Chest Detail */}
        <mesh position={[0, 1.3, 0.2]}>
          <capsuleGeometry args={[0.05, 0.1, 4, 8]} />
          <primitive object={jointMat} attach="material" />
        </mesh>

        {/* Waist Joint */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.15, 0.18, 0.2, 16]} />
          <primitive object={jointMat} attach="material" />
        </mesh>

        {/* Hips */}
        <mesh position={[0, 0.75, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <primitive object={whiteMat} attach="material" />
        </mesh>

        {/* Head Assembly */}
        <group ref={headRef} position={[0, 1.75, 0]}>
          {/* Neck Joint */}
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
            <primitive object={jointMat} attach="material" />
          </mesh>
          
          {/* Head Outer Shell (Glass) */}
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.4, 0.35]} />
            <primitive object={glassMat} attach="material" />
          </mesh>

          {/* Inner Screen (Dark) */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.35, 0.35, 0.2]} />
            <primitive object={screenMat} attach="material" />
          </mesh>

          {/* Face Elements on Screen */}
          <group ref={screenRef} position={[0, 0, 0.16]}>
            {/* Eyes */}
            <mesh name="eye" position={[-0.08, 0.05, 0]}>
              <planeGeometry args={[0.06, 0.06]} />
              <primitive object={emissiveMat} attach="material" />
            </mesh>
            <mesh name="eye" position={[0.08, 0.05, 0]}>
              <planeGeometry args={[0.06, 0.06]} />
              <primitive object={emissiveMat} attach="material" />
            </mesh>
            {/* Mouth */}
            <mesh ref={mouthRef} position={[0, -0.08, 0]}>
              <planeGeometry args={[0.12, 0.02]} />
              <primitive object={emissiveMat} attach="material" />
            </mesh>
          </group>
        </group>

        {/* Arms */}
        <group ref={leftArmRef} position={[-0.3, 1.4, 0]}>
          <mesh position={[-0.2, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
            <primitive object={whiteMat} attach="material" />
          </mesh>
          <mesh position={[-0.4, -0.1, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <primitive object={jointMat} attach="material" />
          </mesh>
          <mesh position={[-0.55, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
            <primitive object={whiteMat} attach="material" />
          </mesh>
        </group>

        <group ref={rightArmRef} position={[0.3, 1.4, 0]}>
          <mesh position={[0.2, -0.1, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
            <primitive object={whiteMat} attach="material" />
          </mesh>
          <mesh position={[0.4, -0.1, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <primitive object={jointMat} attach="material" />
          </mesh>
          <mesh position={[0.55, -0.1, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
            <primitive object={whiteMat} attach="material" />
          </mesh>
        </group>
      </group>

      {/* Legs */}
      <group position={[-0.15, 0.7, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
          <primitive object={whiteMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <primitive object={jointMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.85, 0]}>
          <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
          <primitive object={whiteMat} attach="material" />
        </mesh>
        <mesh position={[0, -1.15, 0.1]}>
          <boxGeometry args={[0.15, 0.1, 0.25]} />
          <primitive object={orangeMat} attach="material" />
        </mesh>
      </group>

      <group position={[0.15, 0.7, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
          <primitive object={whiteMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <primitive object={jointMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.85, 0]}>
          <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
          <primitive object={whiteMat} attach="material" />
        </mesh>
        <mesh position={[0, -1.15, 0.1]}>
          <boxGeometry args={[0.15, 0.1, 0.25]} />
          <primitive object={orangeMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
};

export const Robot3D: React.FC<Robot3DProps> = (props) => {
  return (
    <div className="w-full h-full min-h-[250px] relative">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={45} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <RobotModel {...props} />
        
        <Environment preset="city" />
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          minPolarAngle={Math.PI / 2.5} 
          maxPolarAngle={Math.PI / 1.5} 
          minAzimuthAngle={-Math.PI / 6}
          maxAzimuthAngle={Math.PI / 6}
        />
      </Canvas>
      
      {/* Glow effect overlay */}
      <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-blue-500/5 to-transparent" />
    </div>
  );
};
