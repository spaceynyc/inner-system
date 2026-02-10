import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
    EffectComposer,
    Bloom,
    ChromaticAberration,
    Noise,
    Vignette
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useDetectGPU } from '@react-three/drei'
import { Vector2 } from 'three'
import { audioState } from '../audioState'
import { scrollState } from '../scrollState'

export default function Effects() {
    const bloomRef = useRef()
    const caRef = useRef()
    const noiseRef = useRef()
    const vignetteRef = useRef()

    const gpu = useDetectGPU()
    const gpuTier = gpu?.tier ?? 3

    // Stable Vector2 for ChromaticAberration offset prop (animated via ref in useFrame)
    const caOffset = useMemo(() => new Vector2(0.0005, 0.0005), [])

    // Smoothed audio values to prevent jitter on effect parameters
    const smoothed = useRef({
        caBass: 0,
        noiseHigh: 0,
        vigBass: 0
    })

    useFrame((_, delta) => {
        const { bass, high, average, isPlaying } = audioState
        const scroll = scrollState.offset

        // --- Bloom: audio-reactive + final section crescendo ---
        if (bloomRef.current) {
            // Ramp bloom intensity in the final section for a visual payoff
            const finalT = Math.max(0, (scroll - 0.65) / 0.35) // 0→1 over last 35% (starts earlier)
            const finalBoost = finalT * finalT * 1.8 // much stronger crescendo

            const baseIntensity = 0.8 + finalBoost
            const audioBoost = isPlaying ? bass * 1.0 : 0
            bloomRef.current.intensity = baseIntensity + audioBoost

            const baseThreshold = 0.85 - finalBoost * 0.4
            const thresholdDrop = isPlaying ? average * 0.3 : 0
            bloomRef.current.luminanceThreshold = Math.max(baseThreshold - thresholdDrop, 0.25)
        }

        // --- Smooth audio values ---
        const s = smoothed.current
        const audioBass = isPlaying ? bass : 0
        const audioHigh = isPlaying ? high : 0

        s.caBass += (audioBass - s.caBass) * Math.min(delta * 8, 1)
        s.noiseHigh += (audioHigh - s.noiseHigh) * Math.min(delta * 10, 1)
        s.vigBass += (audioBass - s.vigBass) * Math.min(delta * 6, 1)

        // --- Chromatic Aberration: bass → offset, scroll amplifies ---
        if (caRef.current) {
            const scrollMult = 1.0 + scroll * 0.5
            const caAmount = (0.0005 + s.caBass * 0.0035) * scrollMult
            caRef.current.offset.set(caAmount, caAmount)
        }

        // --- Noise (Film Grain): high → opacity, scroll amplifies ---
        if (noiseRef.current) {
            const scrollGrainMult = 1.0 + scroll * 0.3
            const grainOpacity = (0.15 + s.noiseHigh * 0.3) * scrollGrainMult
            noiseRef.current.blendMode.opacity.value = grainOpacity
        }

        // --- Vignette: bass → darkness, scroll tightens, stronger center pull ---
        if (vignetteRef.current) {
            const baseDarkness = 0.85 + scroll * 0.35 + s.vigBass * 0.3
            vignetteRef.current.darkness = Math.min(baseDarkness, 1.4)

            const baseVigOffset = 0.25 - scroll * 0.1
            vignetteRef.current.offset = Math.max(baseVigOffset, 0.12)
        }
    })

    return (
        <EffectComposer multisampling={0}>
            <Bloom
                ref={bloomRef}
                intensity={0.8}
                luminanceThreshold={0.85}
                luminanceSmoothing={0.4}
                mipmapBlur
                radius={0.85}
            />

            {gpuTier >= 2 && (
                <ChromaticAberration
                    ref={caRef}
                    offset={caOffset}
                    radialModulation
                    modulationOffset={0.3}
                />
            )}

            {gpuTier >= 2 && (
                <Noise
                    ref={noiseRef}
                    premultiply
                    blendFunction={BlendFunction.SOFT_LIGHT}
                />
            )}

            <Vignette
                ref={vignetteRef}
                offset={0.3}
                darkness={0.7}
            />
        </EffectComposer>
    )
}
