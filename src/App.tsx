import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// @ts-ignore
import tshirtImg from './assets/images/black_tshirt_smokey_1782037316227.jpg';

interface WavingTshirtMeshProps {
  texture: THREE.Texture;
}

function WavingTshirtMesh({ texture }: WavingTshirtMeshProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { viewport } = useThree();

  // vertexShader creates beautiful fluid wavy deformations to represent light wind on shirt
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float u_time;

    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Slower, ultra-smooth frequency-overlapped textile wave simulation
      float wave1 = sin(pos.x * 2.4 + u_time * 0.45) * cos(pos.y * 2.0 + u_time * 0.35) * 0.14;
      float wave2 = cos(pos.x * 3.5 - u_time * 0.25) * sin(pos.y * 2.8 + u_time * 0.3) * 0.06;
      float wave3 = sin(pos.y * 5.2 + u_time * 0.4) * 0.025;
      
      pos.z += wave1 + wave2 + wave3;
      
      // Subtle 3D volumetric parabolic distortion to shape garment silhouette
      float distFromCenter = length(uv - vec2(0.5));
      pos.z += (1.0 - pow(distFromCenter * 2.0, 2.0)) * 0.08;

      vPosition = pos;
      vNormal = normal;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // fragmentShader adjusts lighting & creates a pulsing red hot neon outline based on coordinate proximity
  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform sampler2D u_texture;
    uniform float u_time;
    uniform float u_aspect;
    uniform float u_textureAspect;

    void main() {
      vec2 uv = vUv;
      
      // Calculate background-size: cover (crop to fit) for the texture coordinates 
      // dynamically based on full screen viewport dimensions vs 16:9 texture dimensions
      if (u_aspect > u_textureAspect) {
        float diff = u_textureAspect / u_aspect;
        uv.y = (uv.y - 0.5) * diff + 0.5;
      } else if (u_aspect < u_textureAspect) {
        float diff = u_aspect / u_textureAspect;
        uv.x = (uv.x - 0.5) * diff + 0.5;
      }
      
      // Fine cosmetic coordinate warp mimicking small micro-wrinkles moving slower and smoother
      uv.x += sin(uv.y * 6.0 + u_time * 0.22) * 0.0018;
      uv.y += cos(uv.x * 6.0 + u_time * 0.22) * 0.0018;
      
      vec4 col = texture2D(u_texture, uv);
      
      // Detect bright red highlights from back environment
      float redAccent = col.r / (col.g + col.b + 0.01);
      if (col.r > 0.15 && redAccent > 1.25) {
        float dynamicPulse = sin(u_time * 0.8) * 0.5 + 0.5;
        col.rgb += vec3(0.26, 0.04, 0.04) * dynamicPulse * 1.2;
      }
      
      gl_FragColor = col;
    }
  `;

  const uniforms = useMemo(() => {
    return {
      u_time: { value: 0 },
      u_texture: { value: texture },
      u_aspect: { value: viewport.width / viewport.height },
      u_textureAspect: { value: 16.0 / 9.0 },
    };
  }, [texture]);

  // Update scaling uniforms on screen resize
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_aspect.value = viewport.width / viewport.height;
    }
  }, [viewport.width, viewport.height]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* High grid density planar geometry matched perfectly to cover the viewable viewport width & height */}
      <planeGeometry args={[viewport.width, viewport.height, 120, 120]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function App() {
  const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(null);

  // Load texture robustly without R3F Suspense hooks
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      tshirtImg,
      (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setLoadedTexture(tex);
      },
      undefined,
      (err) => {
        console.error('Error loading texture: ', err);
      }
    );
  }, []);

  return (
    <div className="w-screen h-screen bg-[#020205] text-slate-100 overflow-hidden relative select-none" id="full-viewport-shader">
      {/* Immersive 100% full screen GPU WebGL Canvas with no border/orbitcontrols to avoid empty background display */}
      {!loadedTexture ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-[#020205]">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-[10px] tracking-[0.25em] text-red-500 uppercase animate-pulse">
            Loading shader matrix...
          </span>
        </div>
      ) : (
        <Canvas
          camera={{ position: [0, 0, 1.0], fov: 75 }}
          gl={{ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
          style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
        >
          <ambientLight intensity={1.5} />
          <WavingTshirtMesh texture={loadedTexture} />
        </Canvas>
      )}
    </div>
  );
}
