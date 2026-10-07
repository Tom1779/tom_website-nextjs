"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rainStore } from "./store";
import { CAMERA_Z, worldPerPixel } from "./quality";
import { umbrellaState } from "./Umbrella";

const vertexShader = /* glsl */ `
  attribute vec4 aSeed;   // x offset, phase, depth, visibility threshold
  attribute vec2 aMotion; // speed, length

  uniform float uTime;
  uniform float uIntensity;
  uniform float uWind;
  uniform vec2 uView;      // visible world size at z = 0
  uniform float uPx;       // world units per px at z = 0
  uniform float uCamZ;
  uniform vec3 uUmb;       // umbrella rim centre (x, y) on z = 0 plane, z = active
  uniform vec2 uUmbShape;  // radius, canopy height
  uniform float uUmbTilt;
  uniform float uStopY;    // z = 0 plane y where the rain stops (the pool's far edge)

  varying float vAlpha;
  varying float vT;

  void main() {
    float z = aSeed.z;
    float depthScale = (uCamZ - z) / uCamZ;
    vec2 area = uView * depthScale * 1.3;

    float y = (fract(aSeed.y - uTime * aMotion.x) - 0.5) * area.y;
    float x = aSeed.x * area.x - uWind * y;

    float visible = step(aSeed.w, uIntensity);

    // Shelter: drop head projected onto the z = 0 plane
    vec2 p0 = vec2(x, y) / depthScale;
    float xAtRim = p0.x - uWind * (uUmb.y - p0.y) - uUmb.x;
    // canopy is tilted, so its top line leans with the tilt
    float r = max(uUmbShape.x, 1e-4);
    float canopyTop = uUmb.y + uUmbShape.y * max(0.0, 1.0 - (xAtRim / r) * (xAtRim / r)) + xAtRim * sin(uUmbTilt);
    float under = step(abs(xAtRim), r * 0.97) * step(p0.y, canopyTop);
    float depthBelow = uUmb.y - p0.y;
    // shelter fades out far below the umbrella, as wind blows rain back in
    float shelter = under * (1.0 - smoothstep(r * 2.6, r * 4.0, depthBelow)) * uUmb.z;
    visible *= 1.0 - shelter;

    vec2 dir = normalize(vec2(uWind, -1.0));
    vec2 perp = vec2(-dir.y, dir.x);
    float len = aMotion.y * uView.y * (0.65 + 0.5 * uIntensity);
    float width = uPx * mix(1.4, 2.6, smoothstep(-8.0, 6.0, z));

    // the rain lands on the sidewalk under the buildings and stops there (test the streak's lower tip)
    // the rain falls over the pool and stops at the pool's far edge (test the streak's lower tip)
    float tipY = (y + dir.y * len * 0.5) / depthScale;
    visible *= step(uStopY, tipY);

    vec2 pos = vec2(x, y) + perp * position.x * width + dir * position.y * len;
    pos *= visible;

    vT = position.y + 0.5;
    vAlpha = mix(0.18, 0.5, smoothstep(-8.0, 6.0, z)) * visible;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, z, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFlash;
  varying float vAlpha;
  varying float vT;
  void main() {
    float a = vAlpha * (0.15 + 0.85 * vT * vT);
    vec3 col = mix(vec3(0.62, 0.72, 0.88), vec3(1.0), uFlash);
    gl_FragColor = vec4(col, a * (1.0 + uFlash));
  }
`;

export default function Rain({ count }: { count: number }) {
  const size = useThree((s) => s.size);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.instanceCount = count;

    const seed = new Float32Array(count * 4);
    const motion = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      seed[i * 4] = Math.random() - 0.5;
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = -10 + Math.random() * 16; // depth: behind and in front of the glass
      seed[i * 4 + 3] = Math.random();
      motion[i * 2] = 0.7 + Math.random() * 0.5; // area-heights per second
      motion[i * 2 + 1] = 0.035 + Math.random() * 0.045;
    }
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
    geo.setAttribute("aMotion", new THREE.InstancedBufferAttribute(motion, 2));
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.5 },
      uWind: { value: 0.12 },
      uView: { value: new THREE.Vector2(1, 1) },
      uPx: { value: 0.01 },
      uCamZ: { value: CAMERA_Z },
      uUmb: { value: new THREE.Vector3(0, 0, 0) },
      uUmbShape: { value: new THREE.Vector2(1, 0.4) },
      uUmbTilt: { value: 0 },
      uStopY: { value: -1e5 },
      uFlash: { value: 0 },
    }),
    [],
  );

  // R3F copies uniform values into the material, so update them through the material itself
  useFrame((state, delta) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    const k = worldPerPixel(size.height, 0);
    u.uTime.value += delta;
    u.uView.value.set(size.width * k, size.height * k);
    u.uPx.value = k;
    // ease toward the scroll-driven intensity so heavier rain ramps in smoothly
    u.uIntensity.value += (rainStore.intensity - u.uIntensity.value) * Math.min(1, delta * 2);
    u.uWind.value = 0.1 + Math.sin(state.clock.elapsedTime * 0.15) * 0.05;
    u.uUmb.value.set(umbrellaState.rimX, umbrellaState.rimY, umbrellaState.open);
    u.uUmbShape.value.set(umbrellaState.radius, umbrellaState.height);
    u.uUmbTilt.value = umbrellaState.tilt;
    u.uFlash.value = rainStore.flash;
    // the sidewalk under the buildings, in world y on the z = 0 plane
    const stopPx = rainStore.streetTop - 3 - window.scrollY;
    u.uStopY.value = Number.isFinite(stopPx) ? -(stopPx - size.height / 2) * k : -1e5;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={5}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
