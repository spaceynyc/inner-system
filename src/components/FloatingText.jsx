import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Float } from '@react-three/drei'
import { easing } from 'maath'
import { prefersReducedMotion } from '../motion'

const TITLE_FONT = '/fonts/inter-400.woff'
const BASE_TEXT_Z = 3.4
const CAMERA_Z = 8
const CAMERA_FOV = 45
// Width of "THE INNER" in text units at fontSize 1 with 0.1 letter spacing (the widest line).
const WIDEST_LINE_UNITS = 7.6
// Two lines of the title at fontSize 1, including line height.
const TWO_LINE_HEIGHT_UNITS = 2.4
// Sit slightly above centre so the tagline and scroll cue below never collide with the title.
const TITLE_Y = 0.25

export default function FloatingText({ scrollData }) {
    const textRef = useRef()
    const materialRef = useRef()
    const size = useThree(state => state.size)
    const reduceMotion = prefersReducedMotion()

    // Fit the title to the visible width at its own depth so it never crops on
    // narrow viewports or spills past the edge on wide ones.
    const aspect = size.width / Math.max(1, size.height)
    const visibleHeight = 2 * (CAMERA_Z - BASE_TEXT_Z) * Math.tan((CAMERA_FOV * Math.PI) / 360)
    const visibleWidth = visibleHeight * aspect
    const maxWidth = visibleWidth * 0.92
    const widthFit = maxWidth / WIDEST_LINE_UNITS
    const heightFit = (visibleHeight * 0.44) / TWO_LINE_HEIGHT_UNITS
    const fontSize = Math.min(1, Math.max(0.3, Math.min(widthFit, heightFit)))

    useFrame((state, delta) => {
        if (!textRef.current || !materialRef.current) return

        const scrollOffset = scrollData?.current?.offset || 0

        // Fade the title out by the end of the intro section so it never sits behind card copy
        const targetOpacity = 1 - scrollOffset * 4
        easing.damp(materialRef.current, 'opacity', Math.max(0, targetOpacity), 0.2, delta)

        // Scale down and move back as user scrolls
        const targetScale = 1 - scrollOffset * 0.5
        easing.damp3(textRef.current.scale, [targetScale, targetScale, targetScale], 0.2, delta)

        // Move text position based on scroll
        const targetZ = BASE_TEXT_Z - scrollOffset * 3
        easing.damp(textRef.current.position, 'z', targetZ, 0.2, delta)
    })

    return (
        <Float
            speed={reduceMotion ? 0 : 2}
            rotationIntensity={reduceMotion ? 0 : 0.2}
            floatIntensity={reduceMotion ? 0 : 0.5}
        >
            <Text
                ref={textRef}
                font={TITLE_FONT}
                fontSize={fontSize}
                color="white"
                position={[0, TITLE_Y, BASE_TEXT_Z]}
                anchorX="center"
                anchorY="middle"
                maxWidth={maxWidth}
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
