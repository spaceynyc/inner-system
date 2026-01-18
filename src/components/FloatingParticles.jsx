import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'

// Color palette for scroll-driven particle color shifts
const PARTICLE_COLORS = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#aaccff'),
    new THREE.Color('#ffaacc'),
    new THREE.Color('#aaffcc')
]

export default function FloatingParticles({ scrollData }) {
    const group1Ref = useRef()
    const group2Ref = useRef()

    useFrame((state, delta) => {
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
                <Sparkles
                    count={100}
                    scale={10}
                    size={4}
                    speed={0.4}
                    opacity={0.5}
                    color="#ffffff"
                />
            </group>
            <group ref={group2Ref}>
                <Sparkles
                    count={50}
                    scale={15}
                    size={10}
                    speed={0.2}
                    opacity={0.2}
                    color="#00ffff"
                />
            </group>
        </>
    )
}
