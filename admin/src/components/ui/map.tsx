"use client"

import { cn } from "@/lib/utils"
import { APIProvider, Map } from "@vis.gl/react-google-maps"
import type { ReactNode } from "react"

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

const DEFAULT_CENTER = { lat: 22.5, lng: 82.0 }
const DEFAULT_ZOOM = 5
const INDIA_BOUNDS = { north: 37.5, south: 6.5, east: 97.5, west: 68.0 }

export const LIVE_MAP_ID = "live-team-map"

interface GoogleMapProps {
    className?: string
    children?: ReactNode
    defaultCenter?: google.maps.LatLngLiteral
    defaultZoom?: number
}

function GoogleMapWrapper({ className, children, defaultCenter, defaultZoom }: GoogleMapProps) {
    return (
        <div className={cn("relative w-full h-full overflow-hidden rounded-xl border border-border shadow-sm", className)}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                    id={LIVE_MAP_ID}
                    defaultCenter={defaultCenter ?? DEFAULT_CENTER}
                    defaultZoom={defaultZoom ?? DEFAULT_ZOOM}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    zoomControl={true}
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={true}
                    restriction={{
                        latLngBounds: INDIA_BOUNDS,
                        strictBounds: false,
                    }}
                    minZoom={4}
                    style={{ width: "100%", height: "100%" }}
                >
                    {children}
                </Map>
            </APIProvider>
        </div>
    )
}

export { GoogleMapWrapper as Mapcn }
