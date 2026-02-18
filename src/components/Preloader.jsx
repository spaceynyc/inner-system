import React from 'react'
import { LazyMotion, domAnimation, m } from 'framer-motion'
import { useLoading } from './LoadingManager'

export default function Preloader() {
    const { isTransitioning, progress } = useLoading()

    return (
      <LazyMotion features={domAnimation}>
        <m.div
            className="preloader"
            initial={{ opacity: 1 }}
            animate={{
                opacity: isTransitioning ? 0 : 1,
                scale: isTransitioning ? 1.1 : 1,
                filter: isTransitioning ? 'blur(10px)' : 'blur(0px)'
            }}
            exit={{
                opacity: 0,
                scale: 1.1,
                filter: 'blur(10px)'
            }}
            transition={{
                duration: 0.8,
                ease: [0.4, 0, 0.2, 1]
            }}
        >
            <div className="preloader-content">
                <div className="preloader-core">
                    {/* Animated geometric shape */}
                    <div className="preloader-shape">
                        <div className="preloader-inner">
                            <svg viewBox="0 0 100 100" className="preloader-icon">
                                {/* Background pentagon */}
                                <polygon
                                    points="50,5 95,35 80,90 20,90 5,35"
                                    fill="none"
                                    stroke="rgba(170, 204, 255, 0.15)"
                                    strokeWidth="1"
                                />
                                {/* Animated progress pentagon */}
                                <polygon
                                    points="50,5 95,35 80,90 20,90 5,35"
                                    fill="none"
                                    stroke="rgba(170, 204, 255, 0.8)"
                                    strokeWidth="1.5"
                                    strokeDasharray="280"
                                    strokeDashoffset={280 - (progress * 2.8)}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Orbit ring */}
                    <div className="progress-ring">
                        <div className="progress-ring-orbit" />
                    </div>
                </div>

                {/* Brand text */}
                <m.span
                    className="preloader-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.6, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    THE INNER SYSTEM
                </m.span>
            </div>
        </m.div>
      </LazyMotion>
    )
}
