import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
    EffectComposer,
    Bloom,
    ChromaticAberration,
    DepthOfField,
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
    const dofRef = useRef()
    const noiseRef = useRef()
    const vignetteRef = useRef()

    const gpu = useDetectGPU()
    const gpuTier = gpu?.tier ?? 3

    // Stable Vector2 for ChromaticAberration offset prop (animated via ref in useFrame)
    const caOffset = useMemo(() => new Vector2(0.0005, 0.0005), [])

    // Smoothed audio values to prevent jitter on effect parameters
    const smoothed = useRef({
        caBass: 0,
        dofMid: 0,
        dofBass: 0,
        noiseHigh: 0,
        vigBass: 0
    })

    useFrame((_, delta) => {
        const { bass, mid, high, average, isPlaying } = audioState
        const scroll = scrollState.offset

        // --- Bloom (existing logic) ---
        if (bloomRef.current) {
            const baseIntensity = 0.8
            const audioBoost = isPlaying ? bass * 1.0 : 0
            bloomRef.current.intensity = baseIntensity + audioBoost

            const baseThreshold = 0.85
            const thresholdDrop = isPlaying ? average * 0.3 : 0
            bloomRef.current.luminanceThreshold = baseThreshold - thresholdDrop
        }

        // --- Smooth audio values ---
        const s = smoothed.current
        const audioBass = isPlaying ? bass : 0
        const audioMid = isPlaying ? mid : 0
        const audioHigh = isPlaying ? high : 0

        s.caBass += (audioBass - s.caBass) * Math.min(delta * 8, 1)
        s.dofMid += (audioMid - s.dofMid) * Math.min(delta * 6, 1)
        s.dofBass += (audioBass - s.dofBass) * Math.min(delta * 8, 1)
        s.noiseHigh += (audioHigh - s.noiseHigh) * Math.min(delta * 10, 1)
        s.vigBass += (audioBass - s.vigBass) * Math.min(delta * 6, 1)

        // --- Chromatic Aberration: bass → offset, scroll amplifies ---
        if (caRef.current) {
            const scrollMult = 1.0 + scroll * 0.5
            const caAmount = (0.0005 + s.caBass * 0.0035) * scrollMult
            caRef.current.offset.set(caAmount, caAmount)
        }

        // --- Depth of Field: mid → focusRange, bass → bokehScale, scroll → focusDistance ---
        if (dofRef.current) {
            const baseFocusDist = 0.01 - scroll * 0.005
            dofRef.current.focusDistance = Math.max(0.003, baseFocusDist)

            dofRef.current.focusRange = 0.02 + s.dofMid * 0.04

            const baseBokeh = 2.0 + scroll * 1.5
            dofRef.current.bokehScale = baseBokeh + s.dofBass * 2.0
        }

        // --- Noise (Film Grain): high → opacity, scroll amplifies ---
        if (noiseRef.current) {
            const scrollGrainMult = 1.0 + scroll * 0.3
            const grainOpacity = (0.15 + s.noiseHigh * 0.3) * scrollGrainMult
            noiseRef.current.blendMode.opacity.value = grainOpacity
        }

        // --- Vignette: bass → darkness, scroll tightens ---
        if (vignetteRef.current) {
            const baseDarkness = 0.7 + scroll * 0.3 + s.vigBass * 0.3
            vignetteRef.current.darkness = Math.min(baseDarkness, 1.3)

            const baseVigOffset = 0.3 - scroll * 0.1
            vignetteRef.current.offset = Math.max(baseVigOffset, 0.15)
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

            {gpuTier >= 3 && (
                <DepthOfField
                    ref={dofRef}
                    focusDistance={0.01}
                    focusRange={0.02}
                    bokehScale={2.0}
                    resolutionScale={0.5}
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
