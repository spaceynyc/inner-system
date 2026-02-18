import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useDetectGPU } from '@react-three/drei'
import * as THREE from 'three'
import vert from '../shaders/audioBackground.vert?raw'
import frag from '../shaders/audioBackground.frag?raw'
import { audioState } from '../audioState'
import { scrollState } from '../scrollState'

export default function AudioReactiveBackground() {
    const materialRef = useRef()
    const { size } = useThree()
    const gpu = useDetectGPU()
    const gpuTier = gpu?.tier ?? 3

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uAverage: { value: 0 },
        uScroll: { value: 0 },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uDetail: { value: gpuTier <= 1 ? 3.2 : 6.5 }
    }), [gpuTier, size.width, size.height])

    const smoothed = useRef({ bass: 0, mid: 0, high: 0, average: 0, scroll: 0 })

    useFrame((state, delta) => {
        const mat = materialRef.current
        if (!mat) return

        const targetBass = audioState.isPlaying ? audioState.bass : 0
        const targetMid = audioState.isPlaying ? audioState.mid : 0
        const targetHigh = audioState.isPlaying ? audioState.high : 0
        const targetAverage = audioState.isPlaying ? audioState.average : 0
        const targetScroll = scrollState.offset || 0

        const damp = Math.min(delta * 6, 1)
        const s = smoothed.current
        s.bass += (targetBass - s.bass) * damp
        s.mid += (targetMid - s.mid) * damp
        s.high += (targetHigh - s.high) * damp
        s.average += (targetAverage - s.average) * damp
        s.scroll += (targetScroll - s.scroll) * Math.min(delta * 4, 1)

        mat.uniforms.uTime.value = state.clock.elapsedTime
        mat.uniforms.uBass.value = s.bass
        mat.uniforms.uMid.value = s.mid
        mat.uniforms.uHigh.value = s.high
        mat.uniforms.uAverage.value = s.average
        mat.uniforms.uScroll.value = s.scroll
        mat.uniforms.uResolution.value.set(size.width, size.height)
    })

    return (
        <mesh position={[0, 0, -18]} renderOrder={-10} frustumCulled={false}>
            <planeGeometry args={[42, 28, 1, 1]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={vert}
                fragmentShader={frag}
                uniforms={uniforms}
                depthWrite={false}
                depthTest={false}
                transparent={false}
                toneMapped={false}
            />
        </mesh>
    )
}
