"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useTheme } from "next-themes"
import * as React from "react"
import Map, { MapProps } from "react-map-gl/maplibre"

import { cn } from "@/lib/utils"

const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const

interface MapcnProps extends MapProps {
    className?: string
    children?: React.ReactNode
}

const Mapcn = React.forwardRef<any, MapcnProps>(
    ({ className, children, mapStyle: mapStyleProp, ...props }, ref) => {
        const { resolvedTheme } = useTheme()
        const isDark = resolvedTheme === "dark"
        const mapStyle = mapStyleProp ?? (isDark ? MAP_STYLES.dark : MAP_STYLES.light)

        return (
            <div className={cn("relative w-full h-full overflow-hidden rounded-xl border border-border shadow-sm", className)}>
                <Map
                    ref={ref}
                    mapStyle={mapStyle}
                    initialViewState={props.initialViewState ?? {
                        latitude: 28.6139,
                        longitude: 77.2090,
                        zoom: 4,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    {...props}
                >
                    {children}
                </Map>
            </div>
        )
    }
)
Mapcn.displayName = "Mapcn"

export { Mapcn }
