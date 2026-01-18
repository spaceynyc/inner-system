import React, { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { easing } from 'maath'
import * as THREE from 'three'

// Reduced detail level for better performance
const DETAIL = 3

// Shape configurations - all with same detail level for consistent vertex count
const SHAPES = [
    { name: 'icosahedron', create: () => new THREE.IcosahedronGeometry(1, DETAIL) },
    { name: 'dodecahedron', create: () => new THREE.DodecahedronGeometry(1, DETAIL) },
    { name: 'octahedron', create: () => new THREE.OctahedronGeometry(1, DETAIL) },
]

// Project vertices onto unit sphere and sort by angle for consistent ordering
function createMorphTargets(geometry) {
    const positions = geometry.attributes.position.array.slice()
    const vertexCount = positions.length / 3

    // Normalize all vertices to unit sphere (they already should be, but ensure it)
    for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3
        const x = positions[idx]
        const y = positions[idx + 1]
        const z = positions[idx + 2]
        const len = Math.sqrt(x * x + y * y + z * z)
        if (len > 0) {
            positions[idx] = x / len
            positions[idx + 1] = y / len
            positions[idx + 2] = z / len
        }
    }

    return new Float32Array(positions)
}

export default function GlassShape({ playState, frequencyData, scrollData }) {
    const mesh = useRef()
    const [hovered, setHover] = useState(false)

    // Use refs for morph state to avoid stale closures in useFrame
    const morphState = useRef({
        currentIndex: 0,
        previousIndex: 0,
        progress: 1, // Start at 1 (fully morphed to first shape)
        isMorphing: false
    })

    // Audio-reactive state with smoothing
    const audioState = useRef({
        bass: 0,
        mid: 0,
        high: 0
    })

    // Track material quality for dynamic LOD
    const qualityState = useRef({
        samples: 8,
        resolution: 256
    })

    // Create all geometries with matching vertex counts
    const { morphTargets, baseGeometry, vertexCount } = useMemo(() => {
        const geos = SHAPES.map(s => s.create())

        // With same DETAIL level, all should have same vertex count
        // But different base shapes may still differ slightly, so we use the first one's structure
        const targets = geos.map(g => createMorphTargets(g))

        // Clone first geometry as the base (this is what we'll animate)
        const base = new THREE.BufferGeometry()
        base.setAttribute('position', new THREE.BufferAttribute(targets[0].slice(), 3))
        base.computeVertexNormals()

        // Dispose original geometries
        geos.forEach(g => g.dispose())

        return {
            morphTargets: targets,
            baseGeometry: base,
            vertexCount: targets[0].length / 3
        }
    }, [])

    // Handle click to cycle through shapes
    const handleClick = () => {
        const ms = morphState.current
        if (!ms.isMorphing) {
            ms.previousIndex = ms.currentIndex
            ms.currentIndex = (ms.currentIndex + 1) % SHAPES.length
            ms.isMorphing = true
            ms.progress = 0
        }
    }

    useFrame((state, delta) => {
        if (!mesh.current) return

        const ms = morphState.current

        // Get current frequency data
        const freq = frequencyData?.current || { bass: 0, lowMid: 0, mid: 0, high: 0, average: 0 }

        // Smooth the audio values for less jittery animation
        const smoothing = 0.15
        audioState.current.bass += (freq.bass - audioState.current.bass) * smoothing
        audioState.current.mid += (freq.mid - audioState.current.mid) * smoothing
        audioState.current.high += (freq.high - audioState.current.high) * smoothing

        // Calculate audio-reactive values
        const bass = audioState.current.bass
        const mid = audioState.current.mid
        const high = audioState.current.high

        const currentPositions = mesh.current.geometry.attributes.position.array

        // Handle morphing animation
        if (ms.isMorphing) {
            ms.progress += delta * 1.5 // Morph speed

            if (ms.progress >= 1) {
                ms.progress = 1
                ms.isMorphing = false
            }

            // Smooth easing function (ease in-out cubic)
            const t = ms.progress < 0.5
                ? 4 * ms.progress * ms.progress * ms.progress
                : 1 - Math.pow(-2 * ms.progress + 2, 3) / 2

            const fromPositions = morphTargets[ms.previousIndex]
            const toPositions = morphTargets[ms.currentIndex]

            // Interpolate vertices
            for (let i = 0; i < vertexCount; i++) {
                const idx = i * 3
                for (let j = 0; j < 3; j++) {
                    const from = fromPositions[idx + j]
                    const to = toPositions[idx + j]
                    currentPositions[idx + j] = from + (to - from) * t
                }
            }

            mesh.current.geometry.attributes.position.needsUpdate = true
            mesh.current.geometry.computeVertexNormals()
        } else {
            // When not morphing, apply audio-reactive displacement to current shape
            const targetPositions = morphTargets[ms.currentIndex]

            for (let i = 0; i < vertexCount; i++) {
                const idx = i * 3
                const x = targetPositions[idx]
                const y = targetPositions[idx + 1]
                const z = targetPositions[idx + 2]

                // Create wave distortion based on bass (subtle when no audio)
                const wave = bass > 0.01
                    ? Math.sin(state.clock.elapsedTime * 8 + x * 5 + y * 3) * bass * 0.08
                    : 0

                currentPositions[idx] = x + x * wave
                currentPositions[idx + 1] = y + y * wave
                currentPositions[idx + 2] = z + z * wave
            }

            mesh.current.geometry.attributes.position.needsUpdate = true
            mesh.current.geometry.computeVertexNormals()
        }

        // Audio-reactive rotation - faster with more energy
        const baseSpeed = playState ? 0.4 : 0.2
        const audioSpeed = baseSpeed + (mid * 0.6) // Mids affect rotation speed
        mesh.current.rotation.x += delta * audioSpeed
        mesh.current.rotation.y += delta * audioSpeed * 1.1

        // Gentle floating animation with audio influence
        const floatAmount = 0.2 + bass * 0.3 // Bass makes it bob more
        mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * floatAmount

        // Audio-reactive scale - pulse on bass hits
        const morphPulse = ms.isMorphing ? Math.sin(ms.progress * Math.PI) * 0.15 : 0
        const bassPulse = bass * 0.4 // Scale pulse based on bass

        // Scroll-driven scale changes (grow as user scrolls closer)
        const scrollOffset = scrollData?.current?.offset || 0
        const scrollScale = 1 + scrollOffset * 0.3 // Subtle growth with scroll

        const targetScale = ((playState ? 2.2 : 2) + morphPulse + bassPulse) * scrollScale
        easing.damp3(mesh.current.scale, [targetScale, targetScale, targetScale], 0.15, delta)

        // Scroll-driven rotation bias (add extra rotation based on scroll)
        const scrollRotationBias = scrollOffset * Math.PI * 0.5
        mesh.current.rotation.z = scrollRotationBias

        // Audio-reactive material properties
        // Roughness decreases with high frequencies (more glossy/shiny)
        const baseRoughness = hovered ? 0.2 : 0.5
        const audioRoughness = Math.max(0.05, baseRoughness - high * 0.4)
        easing.damp(mesh.current.material, 'roughness', audioRoughness, 0.2, delta)

        // Chromatic aberration increases with bass (color separation on beats)
        const baseChromaticAberration = hovered ? 0.5 : 0.1
        const audioChromaticAberration = baseChromaticAberration + bass * 1.5 // Strong effect on bass
        easing.damp(mesh.current.material, 'chromaticAberration', audioChromaticAberration, 0.1, delta)

        // Distortion increases with mid frequencies
        const baseDistortion = 0.5
        const audioDistortion = baseDistortion + mid * 0.8
        easing.damp(mesh.current.material, 'distortion', audioDistortion, 0.15, delta)

        // Temporal distortion for extra movement feel
        const audioTemporalDistortion = 0.2 + bass * 0.5
        easing.damp(mesh.current.material, 'temporalDistortion', audioTemporalDistortion, 0.2, delta)

        // Color shifts based on frequency content
        // More bass = warmer (pink/purple), more high = cooler (cyan/blue)
        const hue = 0.6 - bass * 0.15 + high * 0.1 // Shift hue based on frequencies
        const saturation = 0.3 + mid * 0.4
        const lightness = 0.7 + high * 0.2
        const audioColor = new THREE.Color().setHSL(hue, saturation, lightness)
        const baseColor = hovered ? new THREE.Color('#ffffff') : audioColor
        easing.dampC(mesh.current.material.color, baseColor, 0.25, delta)

        // IOR (index of refraction) subtle changes with average volume
        const baseIOR = 1.5
        const audioIOR = baseIOR + freq.average * 0.3
        easing.damp(mesh.current.material, 'ior', audioIOR, 0.3, delta)

        // Dynamic quality adjustment based on camera distance (scroll position)
        // When zoomed in (closer camera), reduce quality to maintain framerate
        const targetSamples = scrollOffset > 0.3 ? 4 : 8
        const targetResolution = scrollOffset > 0.3 ? 128 : 256

        if (qualityState.current.samples !== targetSamples) {
            qualityState.current.samples = targetSamples
            mesh.current.material.samples = targetSamples
        }
        if (qualityState.current.resolution !== targetResolution) {
            qualityState.current.resolution = targetResolution
            mesh.current.material.resolution = targetResolution
        }
    })

    return (
        <mesh
            ref={mesh}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
            onClick={handleClick}
        >
            <primitive object={baseGeometry} attach="geometry" />
            <MeshTransmissionMaterial
                backside
                backsideThickness={3}
                samples={8}
                resolution={256}
                thickness={1.5}
                roughness={0.5}
                transmission={1}
                ior={1.5}
                chromaticAberration={0.1}
                anisotropy={0.3}
                distortion={0.3}
                distortionScale={0.3}
                temporalDistortion={0.1}
                color="#aaccff"
            />
        </mesh>
    )
}
