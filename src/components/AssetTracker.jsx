import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { useLoading } from './LoadingManager'

export default function AssetTracker() {
    const { progress, loaded, total } = useProgress()
    const { setAssetProgress, setAssetLoaded } = useLoading()

    useEffect(() => {
        setAssetProgress('r3f', progress)

        // Mark as loaded when all R3F assets are ready
        // Also handle case where there are no assets to load (total === 0)
        if ((loaded === total && total > 0) || (total === 0 && progress === 100)) {
            setAssetLoaded('r3f')
        }
    }, [progress, loaded, total, setAssetProgress, setAssetLoaded])

    // Handle case where no assets need loading
    useEffect(() => {
        const timeout = setTimeout(() => {
            setAssetLoaded('r3f')
        }, 500)
        return () => clearTimeout(timeout)
    }, [setAssetLoaded])

    return null
}
