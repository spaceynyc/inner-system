import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { audioState } from '../audioState'

export default function Effects() {
    const bloomRef = useRef()

    useFrame(() => {
        if (!bloomRef.current) return

        const { bass, average, isPlaying } = audioState

        // Audio-reactive bloom intensity: base 0.8, up to ~1.8 on bass hits
        const baseIntensity = 0.8
        const audioBoost = isPlaying ? bass * 1.0 : 0
        bloomRef.current.intensity = baseIntensity + audioBoost

        // Audio-reactive luminance threshold: base 0.85, drops to ~0.55 on loud moments
        const baseThreshold = 0.85
        const thresholdDrop = isPlaying ? average * 0.3 : 0
        bloomRef.current.luminanceThreshold = baseThreshold - thresholdDrop
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
        </EffectComposer>
    )
}
