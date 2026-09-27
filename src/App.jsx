import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import Experience from './components/Experience'
import Overlay from './components/Overlay'
import { LoadingProvider, useLoading } from './components/LoadingManager'
import Preloader from './components/Preloader'
import AssetTracker from './components/AssetTracker'
import Effects from './components/Effects'
import { controls } from './controls'

class WebGLErrorBoundary extends React.Component {
    state = { hasError: false }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    width: '100%', height: '100%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#050510', color: 'rgba(255,255,255,0.8)',
                    fontFamily: 'inherit', textAlign: 'center',
                    padding: '2rem', boxSizing: 'border-box'
                }}>
                    <div>
                        <h2 style={{ fontWeight: 100, letterSpacing: '0.1em', marginBottom: '1rem' }}>
                            WebGL Unavailable
                        </h2>
                        <p style={{ fontWeight: 300, opacity: 0.8, fontSize: '14px' }}>
                            This experience requires a browser with WebGL support.
                        </p>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

function AppContent() {
    const [playState, setPlayState] = React.useState(false)
    const { isLoading } = useLoading()
    const [contextLost, setContextLost] = useState(false)

    // Let DOM controls outside the canvas (the section cards) start playback
    useEffect(() => {
        controls.play = () => setPlayState(true)
        return () => { controls.play = null }
    }, [])

    const onPlaybackBlocked = useCallback(() => setPlayState(false), [])

    // Handle WebGL context loss/restore on the canvas element
    const onCreated = useCallback(({ gl }) => {
        const canvas = gl.domElement
        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault() // allows the context to be restored
            setContextLost(true)
        })
        canvas.addEventListener('webglcontextrestored', () => {
            setContextLost(false)
        })
    }, [])

    return (
        <main className="app-shell">
            <AnimatePresence>
                {isLoading && <Preloader key="preloader" />}
            </AnimatePresence>

            {contextLost && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#050510', color: 'rgba(255,255,255,0.8)', zIndex: 50,
                    fontFamily: 'inherit', textAlign: 'center'
                }}>
                    <div>
                        <p style={{ fontWeight: 300, fontSize: '14px', opacity: 0.8 }}>
                            Graphics context lost. Attempting to restore...
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: '1rem', padding: '12px 24px', minHeight: '44px', cursor: 'pointer',
                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '13px',
                                fontFamily: 'inherit'
                            }}
                        >
                            Reload page
                        </button>
                    </div>
                </div>
            )}

            <WebGLErrorBoundary>
                <Canvas
                    aria-label="Audio-reactive glass polyhedron. Press play to make it respond to sound; press M to change its form."
                    camera={{ position: [0, 0, 8], fov: 45 }}
                    dpr={[1, 1.5]}
                    performance={{ min: 0.5 }}
                    onCreated={onCreated}
                    gl={{ powerPreference: 'high-performance' }}
                >
                    <Suspense fallback={null}>
                        <AssetTracker />
                        <ScrollControls pages={4} damping={0.25}>
                            <Experience playState={playState} onPlaybackBlocked={onPlaybackBlocked} />
                        </ScrollControls>
                        <Effects />
                    </Suspense>
                </Canvas>
            </WebGLErrorBoundary>
            <Overlay playState={playState} setPlayState={setPlayState} />
        </main>
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
