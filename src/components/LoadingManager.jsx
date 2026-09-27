import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LoadingContext = createContext(null)

// Never leave the visitor behind the preloader: if any asset flag fails to
// arrive (a blocked request, a crashed subtree) the scene is revealed anyway.
const PRELOADER_SAFETY_MS = 8000

export function LoadingProvider({ children }) {
    const [assets, setAssets] = useState({
        r3f: { loaded: false, progress: 0 },
        audio: { loaded: false, progress: 0 },
        fonts: { loaded: false, progress: 0 }
    })

    const [isLoading, setIsLoading] = useState(true)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [minTimeElapsed, setMinTimeElapsed] = useState(false)
    const [safetyElapsed, setSafetyElapsed] = useState(false)

    // Minimum display time for smooth UX
    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), 1500)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => setSafetyElapsed(true), PRELOADER_SAFETY_MS)
        return () => clearTimeout(timer)
    }, [])

    // Warm the self-hosted UI font so the reveal doesn't reflow
    useEffect(() => {
        let cancelled = false
        const markLoaded = () => {
            if (cancelled) return
            setAssets(prev => ({ ...prev, fonts: { loaded: true, progress: 100 } }))
        }

        if (typeof document === 'undefined' || !document.fonts?.load) {
            markLoaded()
            return undefined
        }

        Promise.all([
            document.fonts.load('100 1em Inter'),
            document.fonts.load('300 1em Inter'),
            document.fonts.load('400 1em Inter'),
            document.fonts.load('600 1em Inter')
        ]).then(markLoaded, markLoaded)

        const fallback = setTimeout(markLoaded, 2000)
        return () => {
            cancelled = true
            clearTimeout(fallback)
        }
    }, [])

    // Calculate overall progress
    const progress = (
        assets.r3f.progress * 0.5 +
        assets.audio.progress * 0.3 +
        assets.fonts.progress * 0.2
    )

    // Check if all loaded
    const allLoaded = (assets.r3f.loaded && assets.audio.loaded && assets.fonts.loaded) || safetyElapsed

    // Trigger transition when ready
    useEffect(() => {
        if (allLoaded && minTimeElapsed && !isTransitioning) {
            setIsTransitioning(true)
            // Allow exit animation to complete
            setTimeout(() => setIsLoading(false), 800)
        }
    }, [allLoaded, minTimeElapsed, isTransitioning])

    const setAssetLoaded = useCallback((assetType) => {
        setAssets(prev => ({
            ...prev,
            [assetType]: { loaded: true, progress: 100 }
        }))
    }, [])

    const setAssetProgress = useCallback((assetType, progress) => {
        setAssets(prev => ({
            ...prev,
            [assetType]: { ...prev[assetType], progress }
        }))
    }, [])

    return (
        <LoadingContext.Provider value={{
            isLoading,
            isTransitioning,
            progress,
            assets,
            setAssetLoaded,
            setAssetProgress
        }}>
            {children}
        </LoadingContext.Provider>
    )
}

export function useLoading() {
    const context = useContext(LoadingContext)
    if (!context) {
        throw new Error('useLoading must be used within LoadingProvider')
    }
    return context
}
