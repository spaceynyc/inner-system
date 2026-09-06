import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStudio } from '../../state/studio'
import { PALETTES } from '../../contracts/composition'
import { gestureEngine as gesture } from '../performance/GestureEngine'

export function OrbitField() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const quality = useStudio((s) => s.quality)
  const positions = useMemo(() => {
    let seed = 8317
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    return Float32Array.from({ length: (quality === 'low' ? 260 : 840) * 3 }, (_, i) => i % 3 === 2 ? -2 - random() * 8 : (random() - 0.5) * 28)
  }, [quality])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCharge: { value: 0 }, uEcho: { value: 0 }, uColor: { value: new THREE.Color('#8e9dff') } }), [])
  useFrame(() => {
    if (!material.current) return
    const state = useStudio.getState()
    uniforms.uTime.value = state.reducedMotion ? 0 : gesture.time
    uniforms.uCharge.value = state.reducedMotion ? 0 : gesture.charge
    uniforms.uEcho.value = state.reducedMotion ? 0 : gesture.recoil
    uniforms.uColor.value.set(PALETTES[state.composition.palette].color).lerp(new THREE.Color('white'), 0.45)
  })
  return <points frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}
      vertexShader={`
        uniform float uTime, uCharge, uEcho;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float angle = uTime * .018 * (1.0 + uCharge * 2.0) + p.z * .06;
          mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
          p.xy = turn * p.xy * (1.0 - uCharge * .32 + uEcho * .16);
          p.y += sin(uTime * .22 + p.x) * .08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((22.0 + uCharge * 16.0) / -mv.z, 1.0, 4.0);
          vAlpha = .2 + .35 * fract(position.x * 17.1) + uCharge * .18;
        }`}
      fragmentShader={`
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - .5) * 2.0;
          if (d > 1.0) discard;
          gl_FragColor = vec4(uColor, pow(1.0 - d, 1.6) * vAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </points>
}

export function EchoRings() {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    const state = useStudio.getState()
    group.current.visible = state.observatory && !state.reducedMotion
    group.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
      const wave = gesture.waves[index]
      mesh.visible = !!wave
      if (!wave) return
      const t = wave.age / 3
      mesh.scale.setScalar(.45 + (1 - Math.pow(1 - t, 2)) * 6)
      mesh.rotation.set(.45 + index * .17, -.35, index * .4)
      mesh.material.opacity = wave.power * .55 * Math.pow(1 - t, 2)
      mesh.material.color.set(PALETTES[state.composition.palette].color).lerp(new THREE.Color('#e0e5ff'), .5)
    })
  })
  return <group ref={group}>{Array.from({ length: 6 }, (_, index) => <mesh key={index} visible={false}>
    <ringGeometry args={[1, 1.008, 160]} /><meshBasicMaterial color="#9aaaff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
  </mesh>)}</group>
}
