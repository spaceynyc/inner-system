import React, { Suspense } from 'react'
import { Environment } from '@react-three/drei'

// Image-based lighting is a nicety, not a requirement: if the HDR fails to load
// (offline, blocked host, corrupt cache) the scene keeps rendering with the
// analytic lights instead of unmounting the whole canvas.
class EnvironmentBoundary extends React.Component {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error) {
        console.warn('Environment map unavailable, continuing without image-based lighting:', error)
    }

    render() {
        return this.state.failed ? null : this.props.children
    }
}

export default function SafeEnvironment({ files = '/assets/env/potsdamer_platz_256.hdr' }) {
    return (
        <EnvironmentBoundary>
            <Suspense fallback={null}>
                <Environment files={files} />
            </Suspense>
        </EnvironmentBoundary>
    )
}
