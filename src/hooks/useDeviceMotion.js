import { useRef, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'

const LERP_FACTOR = 0.08
const TILT_SCALE_X = 0.3
const TILT_SCALE_Y = 0.2

function isMobileDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

export function isDeviceMotionSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && isMobileDevice()
}

// Shared singleton state so both React DOM and R3F can access it
export const deviceMotionState = {
  permitted: false,
  x: 0, // smoothed rotation offset (radians)
  y: 0,
  _rawBeta: 0,
  _rawGamma: 0,
  _listening: false,

  startListening() {
    if (this._listening) return
    this._listening = true

    window.addEventListener('deviceorientation', (e) => {
      this._rawBeta = THREE.MathUtils.clamp((e.beta || 0) - 45, -45, 45) / 45
      this._rawGamma = THREE.MathUtils.clamp(e.gamma || 0, -45, 45) / 45
    }, { passive: true })
  },

  update() {
    if (!this.permitted) return
    this.x = THREE.MathUtils.lerp(this.x, this._rawGamma * TILT_SCALE_X, LERP_FACTOR)
    this.y = THREE.MathUtils.lerp(this.y, this._rawBeta * TILT_SCALE_Y, LERP_FACTOR)
  },
}

export async function requestMotionPermission() {
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const response = await DeviceOrientationEvent.requestPermission()
      if (response !== 'granted') return false
    }
    deviceMotionState.permitted = true
    deviceMotionState.startListening()
    return true
  } catch {
    return false
  }
}
