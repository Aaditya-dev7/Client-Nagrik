import { MapContainer, TileLayer, Popup, LayersControl, CircleMarker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { Report } from '@/lib/types'
import { loadReports } from '@/lib/storage'
import { isSupabaseEnabled, supabaseListReports, subscribeReports } from '@/lib/api'
import { geocodeAddress, reverseGeocode } from '@/lib/geocoding'
import { useNavigate } from 'react-router-dom'


function ClickToReport() {
  const nav = useNavigate()
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng
      const address = (await reverseGeocode(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), location: address })
      nav(`/report?${params.toString()}`)
    }
  })
  return null
}

export default function MapPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [geoPositions, setGeoPositions] = useState<Record<string, { lat: number; lng: number }>>({})
  useEffect(() => {
    let mounted = true
    async function refresh() {
      if (isSupabaseEnabled()) {
        const supa = await supabaseListReports()
        if (mounted && supa) { setReports(supa); return }
      }
      if (mounted) setReports(loadReports())
    }
    refresh()
    let unsub = () => {}
    if (isSupabaseEnabled()) {
      unsub = subscribeReports(() => { refresh() })
    }
    return () => { mounted = false; unsub() }
  }, [])

  const center: [number, number] = [18.9489, 73.2245]

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        reports.map(async (r) => {
          const pos = await geocodeAddress(r.location_text)
          return [r.report_id, pos] as const
        })
      )
      if (cancelled) return
      const next: Record<string, { lat: number; lng: number }> = {}
      for (const [id, pos] of entries) {
        if (pos) next[id] = pos
      }
      setGeoPositions(next)
    })()
    return () => { cancelled = true }
  }, [reports])

  const mapReports: Report[] = reports.map(r => ({
    ...r,
    lat: geoPositions[r.report_id]?.lat ?? r.lat,
    lng: geoPositions[r.report_id]?.lng ?? r.lng,
  }))

  return (
    <div className="h-[70vh]">
      <MapContainer center={center} zoom={13} className="h-full rounded border">
        <ClickToReport />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Streets">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {mapReports.map(r => (
          <CircleMarker key={r.report_id} center={[r.lat, r.lng]} radius={7} pathOptions={{ color: '#2563eb', fillOpacity: 0.8 }}>
            <Popup>
              <div className="text-sm">
                <div className="font-mono text-primary">{r.report_id}</div>
                <div>{r.summary}</div>
                <div className="text-xs text-muted-foreground">{r.priority} • {r.location_text}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
