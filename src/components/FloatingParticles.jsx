import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Boosted colors for bloom (exceed luminance threshold when toneMapped is false)
const WHITE_BLOOM = new THREE.Color('#ffffff').multiplyScalar(1.5)
const CYAN_BLOOM = new THREE.Color('#00ffff').multiplyScalar(2.0)

function buildPositions(count, scale) {
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        positions[i3] = (Math.random() - 0.5) * scale
        positions[i3 + 1] = (Math.random() - 0.5) * scale
        positions[i3 + 2] = (Math.random() - 0.5) * scale
    }

    return positions
}

function StarLayer({ count, scale, size, opacity, color }) {
    const pointsRef = useRef()
    const positions = useMemo(() => buildPositions(count, scale), [count, scale])

    useFrame((_, delta) => {
        if (!pointsRef.current) return
        pointsRef.current.rotation.y += delta * 0.02
        pointsRef.current.rotation.x += delta * 0.01
    })

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                color={color}
                size={size}
                sizeAttenuation
                opacity={opacity}
                depthWrite={false}
                alphaTest={0.01}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
            />
        </Points>
    )
}

export default function FloatingParticles({ scrollData }) {
    const group1Ref = useRef()
    const group2Ref = useRef()

    useFrame(() => {
        const scrollOffset = scrollData?.current?.offset || 0

        // Rotate particle groups based on scroll
        if (group1Ref.current) {
            group1Ref.current.rotation.y = scrollOffset * Math.PI * 2
            group1Ref.current.rotation.x = scrollOffset * Math.PI * 0.5
        }
        if (group2Ref.current) {
            group2Ref.current.rotation.y = -scrollOffset * Math.PI * 1.5
            group2Ref.current.rotation.z = scrollOffset * Math.PI * 0.3
        }
    })

    return (
        <>
            <group ref={group1Ref}>
                <StarLayer
                    count={120}
                    scale={10}
                    size={0.05}
                    opacity={0.5}
                    color={WHITE_BLOOM}
                />
            </group>
            <group ref={group2Ref}>
                <StarLayer
                    count={70}
                    scale={15}
                    size={0.08}
                    opacity={0.2}
                    color={CYAN_BLOOM}
                />
            </group>
        </>
    )
}
