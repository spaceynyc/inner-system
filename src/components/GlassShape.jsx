import React, { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { easing } from 'maath'
import * as THREE from 'three'

// Reduced detail level for better performance
const DETAIL = 3
const NORMALS_RECALC_EVERY_N_FRAMES = 4

// Shape configurations used to project the shared base topology.
const SHAPES = [
    { name: 'icosahedron', create: () => new THREE.IcosahedronGeometry(1, 0) },
    { name: 'dodecahedron', create: () => new THREE.DodecahedronGeometry(1, 0) },
    { name: 'octahedron', create: () => new THREE.OctahedronGeometry(1, 0) },
]

function getNormalizedDirections(positions) {
    const directions = new Float32Array(positions.length)
    const vertexCount = positions.length / 3
    const fallback = new THREE.Vector3(0, 1, 0)

    // Build stable ray directions from the shared base geometry vertices.
    for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3
        const x = positions[idx]
        const y = positions[idx + 1]
        const z = positions[idx + 2]
        const len = Math.sqrt(x * x + y * y + z * z)

        if (len > 0) {
            directions[idx] = x / len
            directions[idx + 1] = y / len
            directions[idx + 2] = z / len
        } else {
            directions[idx] = fallback.x
            directions[idx + 1] = fallback.y
            directions[idx + 2] = fallback.z
        }
    }

    return directions
}

function projectDirectionsToGeometry(directions, geometry) {
    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.updateMatrixWorld(true)

    const projected = new Float32Array(directions.length)
    const vertexCount = directions.length / 3

    for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3
        direction.set(directions[idx], directions[idx + 1], directions[idx + 2]).normalize()
        raycaster.set(origin, direction)

        const hit = raycaster.intersectObject(mesh, false)[0]
        if (hit) {
            projected[idx] = hit.point.x
            projected[idx + 1] = hit.point.y
            projected[idx + 2] = hit.point.z
        } else {
            // Fallback keeps animation stable even if a ray misses a face edge.
            projected[idx] = direction.x
            projected[idx + 1] = direction.y
            projected[idx + 2] = direction.z
        }
    }

    // Normalize average radius to keep transitions between shape targets smooth.
    let radiusSum = 0
    for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3
        const x = projected[idx]
        const y = projected[idx + 1]
        const z = projected[idx + 2]
        radiusSum += Math.sqrt(x * x + y * y + z * z)
    }

    const averageRadius = radiusSum / vertexCount || 1
    const radiusScale = 1 / averageRadius

    for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3
        projected[idx] *= radiusScale
        projected[idx + 1] *= radiusScale
        projected[idx + 2] *= radiusScale
    }

    material.dispose()
    return projected
}

export default function GlassShape({ playState, frequencyData, scrollData }) {
    const mesh = useRef()
    const [hovered, setHover] = useState(false)
    const normalFrameCounter = useRef(0)

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

    // Build morph targets by projecting one shared topology onto each target shape.
    const { morphTargets, baseGeometry, vertexCount } = useMemo(() => {
        const baseSource = new THREE.IcosahedronGeometry(1, DETAIL)
        const baseDirections = getNormalizedDirections(baseSource.attributes.position.array)

        const targets = SHAPES.map(shape => {
            const geometry = shape.create()
            const projected = projectDirectionsToGeometry(baseDirections, geometry)
            geometry.dispose()
            return projected
        })

        const base = baseSource.clone()
        base.setAttribute('position', new THREE.BufferAttribute(targets[0].slice(), 3))
        base.computeVertexNormals()
        baseSource.dispose()

        return {
            morphTargets: targets,
            baseGeometry: base,
            vertexCount: targets[0].length / 3
        }
    }, [])

    useEffect(() => {
        return () => {
            baseGeometry.dispose()
        }
    }, [baseGeometry])

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
        const geometry = mesh.current.geometry
        let finishedMorphThisFrame = false

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

        const currentPositions = geometry.attributes.position.array

        // Handle morphing animation
        if (ms.isMorphing) {
            ms.progress += delta * 1.5 // Morph speed

            if (ms.progress >= 1) {
                ms.progress = 1
                ms.isMorphing = false
                finishedMorphThisFrame = true
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

        }

        geometry.attributes.position.needsUpdate = true
        normalFrameCounter.current += 1
        const normalsInterval = ms.isMorphing ? 2 : NORMALS_RECALC_EVERY_N_FRAMES
        if (finishedMorphThisFrame || normalFrameCounter.current % normalsInterval === 0) {
            geometry.computeVertexNormals()
            if (geometry.attributes.normal) {
                geometry.attributes.normal.needsUpdate = true
            }
        }

        // Audio-reactive rotation - faster with more energy
        const baseSpeed = playState ? 0.4 : 0.2
        const audioSpeed = baseSpeed + (mid * 0.6) // Mids affect rotation speed
        mesh.current.rotation.x += delta * audioSpeed
        mesh.current.rotation.y += delta * audioSpeed * 1.1

        const scrollOffset = scrollData?.current?.offset || 0

        // Shift the shape away from the active card side across sections.
        let targetX = 0
        if (scrollOffset <= 0.25) {
            targetX = THREE.MathUtils.lerp(0, 0.55, scrollOffset / 0.25)
        } else if (scrollOffset <= 0.5) {
            targetX = THREE.MathUtils.lerp(0.55, -1, (scrollOffset - 0.25) / 0.25)
        } else if (scrollOffset <= 0.75) {
            targetX = THREE.MathUtils.lerp(-1, -0.2, (scrollOffset - 0.5) / 0.25)
        } else {
            targetX = THREE.MathUtils.lerp(-0.2, 0, (scrollOffset - 0.75) / 0.25)
        }
        easing.damp(mesh.current.position, 'x', targetX, 0.2, delta)

        // Gentle floating animation with audio influence
        const floatAmount = 0.2 + bass * 0.3 // Bass makes it bob more
        mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * floatAmount

        // Audio-reactive scale - pulse on bass hits
        const morphPulse = ms.isMorphing ? Math.sin(ms.progress * Math.PI) * 0.08 : 0
        const bassPulse = bass * 0.18 // Scale pulse based on bass

        // Scroll-driven scale changes (grow as user scrolls closer)
        const scrollScale = 1 + scrollOffset * 0.08 // Keep growth subtle to protect text readability

        const baseScale = playState ? 1.45 : 1.35
        const targetScale = (baseScale + morphPulse + bassPulse) * scrollScale
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
