import React, { useState, useEffect } from 'react'
import { isDeviceMotionSupported, requestMotionPermission, deviceMotionState } from '../hooks/useDeviceMotion'

export default function MotionPermissionButton() {
  const [visible, setVisible] = useState(false)
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    setVisible(isDeviceMotionSupported() && !deviceMotionState.permitted)
  }, [])

  if (!visible || granted) return null

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await requestMotionPermission()
        if (ok) setGranted(true)
      }}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        padding: '8px 20px',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '24px',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 300,
        letterSpacing: '0.05em',
        cursor: 'pointer',
        transition: 'opacity 0.3s',
      }}
    >
      Enable Motion
    </button>
  )
}
