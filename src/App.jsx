import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import Experience from './components/Experience'
import Overlay from './components/Overlay'
import { LoadingProvider, useLoading } from './components/LoadingManager'
import Preloader from './components/Preloader'
import AssetTracker from './components/AssetTracker'
import Effects from './components/Effects'

function AppContent() {
    const [playState, setPlayState] = React.useState(false)
    const { isLoading } = useLoading()

    return (
        <>
            <AnimatePresence>
                {isLoading && <Preloader key="preloader" />}
            </AnimatePresence>

            <Canvas
                camera={{ position: [0, 0, 8], fov: 45 }}
                dpr={[1, 1.5]}
                performance={{ min: 0.5 }}
            >
                <Suspense fallback={null}>
                    <AssetTracker />
                    <ScrollControls pages={4} damping={0.25}>
                        <Experience playState={playState} />
                    </ScrollControls>
                    <Effects />
                </Suspense>
            </Canvas>
            <Overlay playState={playState} setPlayState={setPlayState} />
        </>
    )
}

function App() {
    return (
        <LoadingProvider>
            <AppContent />
        </LoadingProvider>
    )
}

export default App
