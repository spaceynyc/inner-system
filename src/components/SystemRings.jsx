import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const RING_CONFIG = [
    { radius: 2.25, tilt: [0.9, 0.1, 0.25], color: '#7ad7ff', speed: 0.06, phase: 0.0 },
    { radius: 2.85, tilt: [-0.35, 0.8, -0.18], color: '#b99cff', speed: -0.045, phase: 1.6 },
    { radius: 3.35, tilt: [0.2, -0.55, 0.75], color: '#ffe4ff', speed: 0.032, phase: 3.2 },
    { radius: 4.05, tilt: [-0.7, -0.15, 0.42], color: '#78ffc9', speed: -0.024, phase: 4.6 }
]

function createRingGeometry(radius, wobble, phase) {
    const points = []
    const segments = 192

    for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2
        const harmonic = Math.sin(t * 3 + phase) * wobble + Math.sin(t * 7 - phase) * wobble * 0.45
        const r = radius + harmonic
        points.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, Math.sin(t * 2 + phase) * 0.05))
    }

    return new THREE.BufferGeometry().setFromPoints(points)
}

export default function SystemRings({ frequencyData, scrollData, playState }) {
    const groupRef = useRef()
    const ringsRef = useRef([])

    const geometries = useMemo(() => (
        RING_CONFIG.map((ring, index) => createRingGeometry(ring.radius, 0.045 + index * 0.012, ring.phase))
    ), [])

    useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries])

    useFrame((state, delta) => {
        const group = groupRef.current
        if (!group) return

        const freq = frequencyData?.current || { bass: 0, lowMid: 0, mid: 0, high: 0, average: 0 }
        const scroll = scrollData?.current?.offset || 0
        const time = state.clock.elapsedTime
        const active = playState ? 1 : 0

        const finalBloom = THREE.MathUtils.smoothstep(scroll, 0.62, 1)
        const targetScale = 0.82 + scroll * 0.16 + freq.bass * 0.08 + finalBloom * 0.18
        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), Math.min(delta * 3.5, 1))
        group.rotation.y += delta * (0.035 + freq.mid * 0.08)
        group.rotation.z = Math.sin(time * 0.12) * 0.07

        ringsRef.current.forEach((ring, index) => {
            if (!ring) return
            const config = RING_CONFIG[index]
            const material = ring.material
            const ringActivation = 0.18 + active * 0.34 + freq.average * 0.8 + finalBloom * 0.28
            const shimmer = Math.sin(time * (0.85 + index * 0.15) + config.phase) * 0.08
            material.opacity = THREE.MathUtils.clamp(ringActivation + shimmer, 0.08, 0.82)
            material.color.set(config.color).lerp(new THREE.Color('#ffffff'), freq.high * 0.35)
            ring.rotation.z += delta * (config.speed + freq.lowMid * 0.08)
            ring.scale.setScalar(1 + Math.sin(time * 1.1 + config.phase) * 0.015 + freq.bass * (0.035 + index * 0.008))
        })
    })

    return (
        <group ref={groupRef} position={[0, 0, -0.25]}>
            {RING_CONFIG.map((ring, index) => (
                <line
                    key={ring.color}
                    ref={el => { ringsRef.current[index] = el }}
                    rotation={ring.tilt}
                    renderOrder={-1}
                >
                    <primitive object={geometries[index]} attach="geometry" />
                    <lineBasicMaterial
                        color={ring.color}
                        transparent
                        opacity={0.16}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                    />
                </line>
            ))}
        </group>
    )
}
