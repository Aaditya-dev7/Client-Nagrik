export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `geo:${query.toLowerCase()}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) return JSON.parse(raw)
  } catch {}

  const biasLat = 18.9489
  const biasLng = 73.2245

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en&lat=${biasLat}&lon=${biasLng}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const data = await res.json()
      const feat = data?.features?.[0]
      const coords = feat?.geometry?.coordinates
      if (Array.isArray(coords) && coords.length >= 2) {
        const value = { lat: coords[1], lng: coords[0] }
        try { localStorage.setItem(cacheKey, JSON.stringify(value)) } catch {}
        return value
      }
    }
  } catch {}

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const arr = await res.json()
      const first = arr?.[0]
      if (first?.lat && first?.lon) {
        const value = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) }
        try { localStorage.setItem(cacheKey, JSON.stringify(value)) } catch {}
        return value
      }
    }
  } catch {}

  return null
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) return raw
  } catch {}

  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const data = await res.json()
      const prop = data?.features?.[0]?.properties
      const name = prop?.name || prop?.street || null
      const city = prop?.city || prop?.district || prop?.state || null
      const txt = [name, city].filter(Boolean).join(', ')
      if (txt) {
        try { localStorage.setItem(key, txt) } catch {}
        return txt
      }
    }
  } catch {}

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const data = await res.json()
      const disp = data?.display_name as string | undefined
      if (disp) {
        try { localStorage.setItem(key, disp) } catch {}
        return disp
      }
    }
  } catch {}

  return null
}
