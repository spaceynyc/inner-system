import React, { useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PresentationControls, Environment, useScroll, Text } from '@react-three/drei'
import { easing } from 'maath'
import * as THREE from 'three'
import GlassShape from './GlassShape'
import DreamBackground from './DreamBackground'
import FloatingParticles from './FloatingParticles'
import FloatingText from './FloatingText'
import { useLoading } from './LoadingManager'

// Scroll section configuration
const SCROLL_SECTIONS = [
    {
        name: 'intro',
        cameraZ: 8,
        cameraY: 0,
        bgColor: new THREE.Color('#050520'),
        fogColor: new THREE.Color('#050520')
    },
    {
        name: 'explore',
        cameraZ: 5,
        cameraY: 1,
        bgColor: new THREE.Color('#0a0a30'),
        fogColor: new THREE.Color('#0a0a30')
    },
    {
        name: 'discover',
        cameraZ: 3,
        cameraY: 0,
        bgColor: new THREE.Color('#150a30'),
        fogColor: new THREE.Color('#150a30')
    },
    {
        name: 'transcend',
        cameraZ: 6,
        cameraY: -1,
        bgColor: new THREE.Color('#0a1530'),
        fogColor: new THREE.Color('#0a1530')
    }
]

// Audio analyser singleton to share across components
const AudioAnalyser = {
    context: null,
    analyser: null,
    dataArray: null,
    source: null,
    audioElement: null,
    isConnected: false,

    connect(audioElement) {
        if (this.isConnected || !audioElement) return false

        try {
            this.audioElement = audioElement
            this.context = new (window.AudioContext || window.webkitAudioContext)()
            this.analyser = this.context.createAnalyser()
            this.analyser.fftSize = 256
            this.analyser.smoothingTimeConstant = 0.75

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
            this.source = this.context.createMediaElementSource(audioElement)
            this.source.connect(this.analyser)
            this.analyser.connect(this.context.destination)

            this.isConnected = true
            return true
        } catch (error) {
            console.warn('AudioAnalyser connection failed:', error)
            return false
        }
    },

    getFrequencies() {
        if (!this.analyser || !this.dataArray) {
            return { bass: 0, lowMid: 0, mid: 0, high: 0, average: 0 }
        }

        this.analyser.getByteFrequencyData(this.dataArray)
        const data = this.dataArray

        const getBand = (start, end) => {
            let sum = 0
            for (let i = start; i < end; i++) sum += data[i]
            return (sum / (end - start)) / 255
        }

        return {
            bass: getBand(0, 4),        // Sub-bass & bass
            lowMid: getBand(4, 12),     // Low mids
            mid: getBand(12, 32),       // Mids
            high: getBand(32, 64),      // Highs
            average: data.reduce((a, b) => a + b, 0) / data.length / 255
        }
    },

    async resume() {
        if (this.context?.state === 'suspended') {
            await this.context.resume()
        }
    }
}

// Interpolate between scroll sections
function getScrollInterpolation(scrollOffset) {
    const sectionCount = SCROLL_SECTIONS.length
    const sectionProgress = scrollOffset * (sectionCount - 1)
    const currentSection = Math.floor(sectionProgress)
    const nextSection = Math.min(currentSection + 1, sectionCount - 1)
    const t = sectionProgress - currentSection

    const from = SCROLL_SECTIONS[currentSection]
    const to = SCROLL_SECTIONS[nextSection]

    return {
        cameraZ: THREE.MathUtils.lerp(from.cameraZ, to.cameraZ, t),
        cameraY: THREE.MathUtils.lerp(from.cameraY, to.cameraY, t),
        bgColor: from.bgColor.clone().lerp(to.bgColor, t),
        fogColor: from.fogColor.clone().lerp(to.fogColor, t),
        sectionIndex: currentSection,
        sectionProgress: t
    }
}

export default function Experience({ playState }) {
    const frequencyDataRef = useRef({ bass: 0, lowMid: 0, mid: 0, high: 0, average: 0 })
    const scrollDataRef = useRef({ offset: 0 })
    const { camera, scene } = useThree()
    const scroll = useScroll()
    const { setAssetLoaded } = useLoading()

    // Create audio element once
    const audioElement = useMemo(() => {
        if (typeof window === 'undefined') return null
        const audio = new Audio('/assets/track.mp3')
        audio.loop = true
        audio.crossOrigin = 'anonymous'
        return audio
    }, [])

    // Track audio loading
    useEffect(() => {
        if (!audioElement) {
            // No audio element, mark as loaded
            setAssetLoaded('audio')
            return
        }

        const handleCanPlayThrough = () => {
            setAssetLoaded('audio')
        }

        // Check if already loaded
        if (audioElement.readyState >= 4) {
            setAssetLoaded('audio')
        } else {
            audioElement.addEventListener('canplaythrough', handleCanPlayThrough, { once: true })
        }

        // Fallback timeout in case audio fails to load
        const timeout = setTimeout(() => {
            setAssetLoaded('audio')
        }, 3000)

        return () => {
            audioElement.removeEventListener('canplaythrough', handleCanPlayThrough)
            clearTimeout(timeout)
        }
    }, [audioElement, setAssetLoaded])

    // Connect audio analyser on mount
    useEffect(() => {
        if (audioElement && !AudioAnalyser.isConnected) {
            AudioAnalyser.connect(audioElement)
        }
    }, [audioElement])

    // Handle play/pause
    useEffect(() => {
        if (!audioElement) return

        if (playState) {
            AudioAnalyser.resume()
            audioElement.play().catch(e => console.warn('Audio play failed:', e))
        } else {
            audioElement.pause()
        }
    }, [playState, audioElement])

    // Update frequency data and scroll-driven animations every frame
    useFrame((state, delta) => {
        // Update audio data
        if (playState && AudioAnalyser.isConnected) {
            frequencyDataRef.current = AudioAnalyser.getFrequencies()
        } else {
            const decay = 0.95
            frequencyDataRef.current = {
                bass: frequencyDataRef.current.bass * decay,
                lowMid: frequencyDataRef.current.lowMid * decay,
                mid: frequencyDataRef.current.mid * decay,
                high: frequencyDataRef.current.high * decay,
                average: frequencyDataRef.current.average * decay
            }
        }

        // Update scroll data
        scrollDataRef.current.offset = scroll.offset

        // Get interpolated scroll values
        const scrollState = getScrollInterpolation(scroll.offset)

        // Smooth camera position based on scroll
        easing.damp3(
            camera.position,
            [0, scrollState.cameraY, scrollState.cameraZ],
            0.25,
            delta
        )

        // Update background and fog colors
        if (scene.background) {
            scene.background.lerp(scrollState.bgColor, delta * 4)
        }
        if (scene.fog) {
            scene.fog.color.lerp(scrollState.fogColor, delta * 4)
        }
    })

    return (
        <>
            <DreamBackground />

            <PresentationControls
                global
                config={{ mass: 2, tension: 500 }}
                snap={{ mass: 4, tension: 1500 }}
                rotation={[0, 0, 0]}
                polar={[-Math.PI / 4, Math.PI / 4]}
                azimuth={[-Math.PI / 4, Math.PI / 4]}
            >
                <group position={[0, 0, 0]}>
                    <GlassShape
                        playState={playState}
                        frequencyData={frequencyDataRef}
                        scrollData={scrollDataRef}
                    />
                    <FloatingText scrollData={scrollDataRef} />
                </group>
            </PresentationControls>

            <FloatingParticles scrollData={scrollDataRef} />

            {/* Scroll-triggered section labels */}
            <ScrollSections scrollData={scrollDataRef} />

            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        </>
    )
}

// Component to render scroll-triggered section content
function ScrollSections({ scrollData }) {
    const groupRef = useRef()
    const sectionsRef = useRef([])

    const sectionContent = [
        { text: '', y: 0 }, // Intro - no extra text
        { text: 'EXPLORE', y: -3 },
        { text: 'DISCOVER', y: -6 },
        { text: 'TRANSCEND', y: -9 }
    ]

    useFrame((state, delta) => {
        const offset = scrollData.current?.offset || 0

        sectionsRef.current.forEach((section, i) => {
            if (!section) return

            // Calculate visibility based on scroll position
            const sectionStart = i / 4
            const sectionEnd = (i + 1) / 4
            const inSection = offset >= sectionStart && offset < sectionEnd

            // Fade in/out based on section visibility
            const targetOpacity = inSection ? 1 : 0
            section.material.opacity += (targetOpacity - section.material.opacity) * delta * 3

            // Subtle floating animation when visible
            if (inSection) {
                section.position.y = sectionContent[i].y + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
            }
        })
    })

    return (
        <group ref={groupRef}>
            {sectionContent.map((content, i) => (
                content.text && (
                    <Text
                        key={i}
                        ref={el => sectionsRef.current[i] = el}
                        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                        fontSize={0.5}
                        color="#ffffff"
                        position={[0, content.y, -2]}
                        anchorX="center"
                        anchorY="middle"
                        letterSpacing={0.3}
                    >
                        {content.text}
                        <meshStandardMaterial
                            color="#ffffff"
                            transparent
                            opacity={0}
                            toneMapped={false}
                        />
                    </Text>
                )
            ))}
        </group>
    )
}
