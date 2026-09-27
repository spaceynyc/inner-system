import React, { useState, useEffect } from 'react'
import { isDeviceMotionSupported, requestMotionPermission, deviceMotionState } from '../hooks/useDeviceMotion'

function needsExplicitPermission() {
    return typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function'
}

export default function MotionPermissionButton() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!isDeviceMotionSupported() || deviceMotionState.permitted) return
        if (needsExplicitPermission()) {
            // iOS: a user gesture is required, so offer the control.
            setVisible(true)
        } else {
            // Android and desktop touch: no permission prompt exists, just listen.
            requestMotionPermission()
        }
    }, [])

    if (!visible) return null

    return (
        <button
            type="button"
            className="motion-button"
            onClick={async () => {
                const ok = await requestMotionPermission()
                if (ok) setVisible(false)
            }}
        >
            Enable Motion
        </button>
    )
}
