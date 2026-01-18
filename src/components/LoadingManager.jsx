import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LoadingContext = createContext(null)

export function LoadingProvider({ children }) {
    const [assets, setAssets] = useState({
        r3f: { loaded: false, progress: 0 },
        audio: { loaded: false, progress: 0 },
        fonts: { loaded: false, progress: 0 }
    })

    const [isLoading, setIsLoading] = useState(true)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [minTimeElapsed, setMinTimeElapsed] = useState(false)

    // Minimum display time for smooth UX
    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), 1500)
        return () => clearTimeout(timer)
    }, [])

    // Preload fonts
    useEffect(() => {
        const fontUrl = 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff'

        const font = new FontFace('Inter-Preload', `url(${fontUrl})`)
        font.load()
            .then(() => {
                document.fonts.add(font)
                setAssets(prev => ({
                    ...prev,
                    fonts: { loaded: true, progress: 100 }
                }))
            })
            .catch(() => {
                // Fallback: mark as loaded after timeout
                setTimeout(() => {
                    setAssets(prev => ({
                        ...prev,
                        fonts: { loaded: true, progress: 100 }
                    }))
                }, 2000)
            })
    }, [])

    // Calculate overall progress
    const progress = (
        assets.r3f.progress * 0.5 +
        assets.audio.progress * 0.3 +
        assets.fonts.progress * 0.2
    )

    // Check if all loaded
    const allLoaded = assets.r3f.loaded && assets.audio.loaded && assets.fonts.loaded

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
