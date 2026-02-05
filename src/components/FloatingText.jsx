import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Float } from '@react-three/drei'
import { easing } from 'maath'

export default function FloatingText({ scrollData }) {
    const textRef = useRef()
    const materialRef = useRef()
    const baseTextZ = 3.4

    useFrame((state, delta) => {
        if (!textRef.current || !materialRef.current) return

        const scrollOffset = scrollData?.current?.offset || 0

        // Fade out main title as user scrolls
        const targetOpacity = 1 - scrollOffset * 2 // Fully faded by 50% scroll
        easing.damp(materialRef.current, 'opacity', Math.max(0, targetOpacity), 0.2, delta)

        // Scale down and move back as user scrolls
        const targetScale = 1 - scrollOffset * 0.5
        easing.damp3(textRef.current.scale, [targetScale, targetScale, targetScale], 0.2, delta)

        // Move text position based on scroll
        const targetZ = baseTextZ - scrollOffset * 3
        easing.damp(textRef.current.position, 'z', targetZ, 0.2, delta)
    })

    return (
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
            <Text
                ref={textRef}
                font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                fontSize={1}
                color="white"
                position={[0, 0, baseTextZ]}
                anchorX="center"
                anchorY="middle"
                maxWidth={10}
                textAlign="center"
                letterSpacing={0.1}
                renderOrder={20}
            >
                THE INNER SYSTEM
                <meshStandardMaterial
                    ref={materialRef}
                    color="white"
                    transparent
                    opacity={1}
                    toneMapped={false}
                    depthTest={false}
                    depthWrite={false}
                />
            </Text>
        </Float>
    )
}
