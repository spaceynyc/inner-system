import React from 'react'

export default function DreamBackground() {
    return (
        <>
            <color attach="background" args={['#050520']} />
            <fog attach="fog" args={['#050520', 5, 20]} />
        </>
    )
}
