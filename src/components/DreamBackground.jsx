import React from 'react'
import { Color } from 'three'

export default function DreamBackground() {
    return (
        <>
            <color attach="background" args={['#050520']} />
            <fog attach="fog" args={['#050520', 5, 20]} />
        </>
    )
}
