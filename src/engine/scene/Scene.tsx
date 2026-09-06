import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Line, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { PALETTES } from '../../contracts/composition'
import { journey, useStudio } from '../../state/studio'
import { audioEngine } from '../audio/AudioEngine'
import { captureScene } from '../../state/render'

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function OpticalSculpture({ onReady }: { onReady: () => void }) {
  const shape = useStudio((s) => s.composition.shape)
  const { scene } = useGLTF(`/models/${shape}.glb`)
  const group = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Group>(null)
  const nucleus = useRef<THREE.Mesh>(null)
  const frame = useRef({ angle: 0, reveal: 0, pulse: 0 })
  const { size, viewport } = useThree()
  const mobile = useMemo(() => window.matchMedia('(max-width: 759px)').matches, [size.width])
  const orbitPoints = useMemo(() => Array.from({ length: 161 }, (_, i) => {
    const a = i / 160 * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * 2.28, Math.sin(a) * 2.28, 0)
  }), [])
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#c0ccff', metalness: 0.06, roughness: 0.065,
    transmission: 0.96, thickness: 1.2, ior: 1.52,
    clearcoat: 1, clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color('#7389dd'), attenuationDistance: 3.7,
    envMapIntensity: 1.9, dispersion: 0.8,
  }), [])
  const facets = useMemo(() => {
    const result: { geometry: THREE.BufferGeometry; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }[] = []
    scene.updateMatrixWorld(true)
    scene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3()
        node.matrixWorld.decompose(position, quaternion, scale)
        result.push({ geometry: node.geometry, position, quaternion, scale })
      }
    })
    return result
  }, [scene])
  useEffect(() => { frame.current.reveal = 0; onReady() }, [scene, onReady])
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, dt) => {
    if (!group.current) return
    const delta = Math.min(dt, 0.05)
    const state = useStudio.getState()
    const config = state.composition
    const reduced = state.reducedMotion
    const quiet = state.quiet
    const p = state.open ? 2.8 : journey.progress
    const l = audioEngine.levels
    const energy = quiet ? 0 : l.bass * config.response
    const f = frame.current
    f.reveal = THREE.MathUtils.damp(f.reveal, 1, 4, delta)
    if (!reduced) f.angle += delta * (0.055 + energy * 0.09 + (quiet ? 0 : l.mid * config.response * 0.15))
    f.pulse = THREE.MathUtils.damp(f.pulse, journey.pulse, 8, delta)
    journey.pulse *= Math.exp(-delta * 3)
    const chapterMix = (values: number[]) => {
      const index = Math.min(2, Math.floor(p))
      const t = THREE.MathUtils.smoothstep(p - index, 0, 1)
      return THREE.MathUtils.lerp(values[index], values[index + 1], t)
    }
    const targetX = mobile || state.immersive ? 0 : state.open ? -viewport.width * 200 / size.width : chapterMix([0.225, -0.215, 0.22, 0.21]) * viewport.width
    const targetY = state.immersive ? 0 : mobile ? viewport.height * (state.open ? 0.3 : size.height < 760 ? -0.2 : -0.12) : chapterMix([0.0, 0.04, 0.12, 0])
    const targetScale = mobile ? Math.min(viewport.width * (state.open ? 0.115 : 0.18), 0.88) : Math.min(viewport.width * (state.open ? (1 - 400 / size.width) * 0.19 : 0.112), viewport.height * 0.31, 1.42)
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, reduced ? 30 : 4, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY + (reduced ? 0 : Math.sin(f.angle * 1.7) * 0.045), 4, delta)
    const scale = targetScale * (0.88 + f.reveal * 0.12) * (1 + energy * 0.035 + f.pulse * 0.025)
    group.current.scale.setScalar(scale)
    group.current.rotation.set(
      0.17 + (reduced ? 0 : journey.pointerY * 0.055),
      -0.4 + f.angle + (reduced ? 0 : journey.pointerX * 0.09),
      0.12,
    )
    const separation = (reduced ? 0 : Math.sin(Math.max(0, Math.min(1, (p - 1.25) / 1.25)) * Math.PI) * 0.19) + energy * 0.028 + f.pulse * 0.06
    group.current.children.forEach((child, i) => {
      if (i < facets.length) child.position.copy(facets[i].position).multiplyScalar(1 + separation)
    })
    const color = PALETTES[config.palette]
    material.color.set(color.color).lerp(new THREE.Color('#eef2ff'), 0.78)
    material.roughness = 0.02 + (1 - config.clarity) * 0.31
    material.dispersion = config.dispersion * 1.8
    material.envMapIntensity = 1.6 + (quiet ? 0 : l.high * 0.75)
    if (halo.current) { halo.current.visible = config.orbit; halo.current.rotation.z = reduced ? 0 : f.angle * 0.35 }
    if (nucleus.current) {
      const mat = nucleus.current.material as THREE.MeshStandardMaterial
      mat.color.set(color.secondary)
      mat.emissive.set(color.color)
      mat.emissiveIntensity = 0.12 + energy * 0.7
      nucleus.current.rotation.y = -f.angle * 0.7
    }
  })

  return <group ref={group} name="optical-sculpture" position={[2.6, 0, 0]}>
    {facets.map((facet, i) => <mesh key={`${shape}-${i}`} geometry={facet.geometry} material={material}
      position={facet.position} quaternion={facet.quaternion} scale={facet.scale}
      onClick={(event) => { event.stopPropagation(); useStudio.getState().cycle(); journey.pulse = 1 }} />)}
    <mesh ref={nucleus} scale={0.9}>
      <torusKnotGeometry args={[0.67, 0.026, 144, 8, 2, 3]} /><meshStandardMaterial color="#8b99ed" metalness={0.8} roughness={0.18} emissive="#5264f5" emissiveIntensity={0.12} />
    </mesh>
    <group ref={halo} rotation={[1.22, 0.24, -0.2]}>
      <Line points={orbitPoints} color="#a9b6fa" lineWidth={0.55} transparent opacity={0.4} />
    </group>
  </group>
}

function ChamberBackdrop() {
  const ref = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uAccent: { value: new THREE.Color('#121b49') } }), [])
  useFrame(() => {
    const palette = useStudio.getState().composition.palette
    ref.current?.uniforms.uAccent.value.set(palette === 'indigo' ? '#251a50' : palette === 'eclipse' ? '#121527' : '#131d48')
  })
  return <mesh position={[0, 0, -25]} renderOrder={-10}>
    <planeGeometry args={[130, 85]} />
    <shaderMaterial ref={ref} uniforms={uniforms} depthWrite={false}
      vertexShader="varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
      fragmentShader={`
        varying vec2 vUv;
        uniform vec3 uAccent;
        void main() {
          vec2 p = (vUv - vec2(.53, .5)) * vec2(4.5, 3.0);
          float glow = exp(-dot(p, p) * 13.0);
          vec3 color = mix(vec3(.0012, .0017, .004), uAccent, glow * .58);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `} />
  </mesh>
}

function Chamber({ onReady, onContext }: { onReady: () => void; onContext: (lost: boolean) => void }) {
  const { gl, scene, camera, invalidate, setDpr } = useThree()
  const quality = useStudio((s) => s.quality)
  const reduced = useStudio((s) => s.reducedMotion)
  const perf = useRef({ elapsed: 0, frames: 0, downgraded: false })
  const changedAt = useRef(0)
  useEffect(() => {
    const wake = () => { changedAt.current = performance.now(); invalidate() }
    const unsubscribe = useStudio.subscribe(wake)
    const unsubscribeAudio = audioEngine.subscribe(wake)
    window.addEventListener('scroll', wake, { passive: true })
    window.addEventListener('resize', wake)
    wake()
    return () => { unsubscribe(); unsubscribeAudio(); window.removeEventListener('scroll', wake); window.removeEventListener('resize', wake) }
  }, [invalidate])
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onContext(true) }
    const restored = () => { onContext(false); invalidate() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    gl.domElement.addEventListener('webglcontextrestored', restored)
    return () => { gl.domElement.removeEventListener('webglcontextlost', lost); gl.domElement.removeEventListener('webglcontextrestored', restored) }
  }, [gl, invalidate, onContext])
  useEffect(() => {
    setDpr(quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 1.5))
    gl.transmissionResolutionScale = quality === 'low' ? 0.45 : 0.75
    perf.current = { elapsed: 0, frames: 0, downgraded: false }
  }, [quality, setDpr, gl])
  useEffect(() => {
    captureScene.current = () => new Promise<Blob>((resolve, reject) => {
      const originalSize = gl.getSize(new THREE.Vector2())
      const originalDpr = gl.getPixelRatio()
      try {
        const sculpture = scene.getObjectByName('optical-sculpture')
        if (!sculpture) throw new Error('Sculpture is still loading')
        const center = sculpture.getWorldPosition(new THREE.Vector3())
        const exportCamera = new THREE.PerspectiveCamera(39, 1, 0.1, 100)
        exportCamera.position.copy(center).add(new THREE.Vector3(0, 0.08, sculpture.scale.x * 7.8))
        exportCamera.lookAt(center)
        gl.setPixelRatio(1); gl.setSize(1600, 1600, false)
        gl.render(scene, exportCamera)
        gl.domElement.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image could not be captured.')), 'image/png')
      } catch { reject(new Error('Image export is unavailable on this device.')) }
      finally { gl.setPixelRatio(originalDpr); gl.setSize(originalSize.x, originalSize.y, false); gl.render(scene, camera); invalidate() }
    })
    return () => { captureScene.current = null }
  }, [gl, scene, camera, invalidate])
  useFrame((_, delta) => {
    audioEngine.sample(delta)
    const meter = perf.current
    if (quality === 'auto' && !meter.downgraded && delta < 0.2) {
      meter.elapsed += delta; meter.frames++
      if (meter.elapsed > 4) {
        if (meter.frames / meter.elapsed < 38) { setDpr(1); gl.transmissionResolutionScale = 0.45; meter.downgraded = true }
        meter.elapsed = 0; meter.frames = 0
      }
    }
    if (!document.hidden && (!reduced || audioEngine.getSnapshot().status === 'playing' || performance.now() - changedAt.current < 1600)) invalidate()
  })
  return <>
    <color attach="background" args={['#040613']} />
    <ChamberBackdrop />
    <Environment resolution={256} frames={1} environmentIntensity={1}>
      <color attach="background" args={['#283054']} />
      <Lightformer form="rect" intensity={5} color="#e9edff" position={[-4, 3, 2]} scale={[2.8, 8, 1]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer form="rect" intensity={7} color="#6377ff" position={[4, 1, 0]} scale={[1.8, 7, 1]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={3.5} color="#bfbaff" position={[0, 5, -3]} scale={[8, 0.22, 1]} rotation={[Math.PI / 3, 0, 0]} />
      <Lightformer form="rect" intensity={2} color="#263ac6" position={[-3, -2, -4]} scale={[6, 2, 1]} />
      <Lightformer form="rect" intensity={2.5} color="#a6b8ff" position={[1, 0, 5]} scale={[0.12, 5, 1]} />
    </Environment>
    <ambientLight intensity={0.12} />
    <directionalLight position={[-4, 5, 5]} intensity={2} color="#c9d5ff" />
    <pointLight position={[3, -1, 3]} intensity={6} color="#4a56cc" distance={12} />
    <Suspense fallback={null}><OpticalSculpture onReady={onReady} /></Suspense>
    {quality !== 'low' && !reduced && <EffectComposer multisampling={0}>
      <Bloom intensity={0.3} luminanceThreshold={1.9} luminanceSmoothing={0.5} mipmapBlur />
    </EffectComposer>}
  </>
}

export default function Scene({ onReady }: { onReady: () => void }) {
  const [failed, setFailed] = useState(false)
  const [lost, setLost] = useState(false)
  const [generation, setGeneration] = useState(0)
  const invalidateRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const awake = () => { if (!document.hidden) invalidateRef.current?.() }
    window.addEventListener('visibilitychange', awake)
    return () => window.removeEventListener('visibilitychange', awake)
  }, [])
  return <div className={`scene-stage ${failed ? 'scene-unavailable' : ''}`} aria-hidden={!failed && !lost}>
    <SceneBoundary key={generation} onFailure={() => { setFailed(true); onReady() }}>
      <Canvas camera={{ position: [0, 0.35, 9.4], fov: 39, near: 0.1, far: 100 }}
        dpr={[1, 1.5]} frameloop="demand"
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, invalidate }) => {
          gl.setClearColor('#03040b', 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.1
          invalidateRef.current = invalidate
        }}>
        <Chamber onReady={onReady} onContext={setLost} />
      </Canvas>
    </SceneBoundary>
    {(failed || lost) && <div className="graphics-fallback" role="status">
      <p>{lost ? 'The visual signal was interrupted.' : 'The 3D view is unavailable on this device.'}</p>
      <button onClick={() => { setFailed(false); setLost(false); setGeneration((v) => v + 1) }}>Retry visuals</button>
      <span>You can still listen and use the instrument.</span>
    </div>}
  </div>
}
