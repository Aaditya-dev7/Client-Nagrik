export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `geo:${query.toLowerCase()}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) return JSON.parse(raw)
  } catch {}

  // Default bias to India center (Maharashtra region)
  const biasLat = 20.5937
  const biasLng = 78.9629

  // Clean and enhance the query
  const cleanQuery = query.trim()
  const enhancedQuery = `${cleanQuery}, India`

  // Try Photon API first with location bias
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(enhancedQuery)}&limit=5&lang=en&lat=${biasLat}&lon=${biasLng}&distance=10000`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const data = await res.json()
      const features = data?.features || []
      
      // Find best match in India
      for (const feat of features) {
        const coords = feat?.geometry?.coordinates
        const props = feat?.properties || {}
        
        if (Array.isArray(coords) && coords.length >= 2) {
          const lat = coords[1]
          const lng = coords[0]
          
          // Check if in India bounding box
          if (lat >= 6 && lat <= 37.1 && lng >= 68 && lng <= 97.5) {
            const value = { lat, lng }
            try { localStorage.setItem(cacheKey, JSON.stringify(value)) } catch {}
            return value
          }
        }
      }
      
      // Fallback to first result if within reasonable bounds
      const feat = features[0]
      const coords = feat?.geometry?.coordinates
      if (Array.isArray(coords) && coords.length >= 2) {
        const value = { lat: coords[1], lng: coords[0] }
        try { localStorage.setItem(cacheKey, JSON.stringify(value)) } catch {}
        return value
      }
    }
  } catch {}

  // Try Nominatim with structured search
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&addressdetails=1&q=${encodeURIComponent(enhancedQuery)}`
    const res = await fetch(url, { 
      headers: { 
        Accept: 'application/json',
        'User-Agent': 'NagrikGPT-CitizenApp/1.0'
      } 
    })
    if (res.ok) {
      const arr = await res.json()
      
      // Find best match
      for (const result of arr) {
        if (result?.lat && result?.lon) {
          const lat = parseFloat(result.lat)
          const lng = parseFloat(result.lon)
          
          // Verify it's in India
          if (lat >= 6 && lat <= 37.1 && lng >= 68 && lng <= 97.5) {
            const value = { lat, lng }
            try { localStorage.setItem(cacheKey, JSON.stringify(value)) } catch {}
            return value
          }
        }
      }
      
      // Fallback to first result
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

function isWithinIndiaBBox(lat: number, lng: number): boolean {
  return lat >= 6 && lat <= 37.1 && lng >= 68 && lng <= 97.5
}

async function verifyIndiaByReverseGeocode(lat: number, lng: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 5000)
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    clearTimeout(tid)
    if (res.ok) {
      const data = await res.json()
      const code = data?.address?.country_code as string | undefined
      if (code && code.toLowerCase() === 'in') return true
      return false
    }
  } catch {}
  return isWithinIndiaBBox(lat, lng)
}

export async function isCoordinateInIndia(lat: number, lng: number): Promise<boolean> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (!isWithinIndiaBBox(lat, lng)) return false
  return verifyIndiaByReverseGeocode(lat, lng)
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) return raw
  } catch {}

  // Try Photon reverse first
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en&distance=100`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const data = await res.json()
      const prop = data?.features?.[0]?.properties || {}
      
      // Build detailed address
      const parts: string[] = []
      if (prop.name) parts.push(prop.name)
      if (prop.street) parts.push(prop.street)
      if (prop.housenumber) parts.push(prop.housenumber)
      if (prop.district) parts.push(prop.district)
      if (prop.city) parts.push(prop.city)
      if (prop.state) parts.push(prop.state)
      if (prop.postcode) parts.push(prop.postcode)
      
      const txt = parts.filter(Boolean).join(', ')
      if (txt) {
        try { localStorage.setItem(key, txt) } catch {}
        return txt
      }
    }
  } catch {}

  // Try Nominatim reverse with detailed output
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    const res = await fetch(url, { 
      headers: { 
        Accept: 'application/json',
        'User-Agent': 'NagrikGPT-CitizenApp/1.0'
      } 
    })
    if (res.ok) {
      const data = await res.json()
      const addr = data?.address || {}
      
      // Build detailed address from components
      const parts: string[] = []
      if (addr.house_number || addr.house_number) parts.push(addr.house_number)
      if (addr.road) parts.push(addr.road)
      if (addr.neighbourhood) parts.push(addr.neighbourhood)
      if (addr.suburb) parts.push(addr.suburb)
      if (addr.city_district) parts.push(addr.city_district)
      if (addr.city) parts.push(addr.city)
      if (addr.state_district) parts.push(addr.state_district)
      if (addr.state) parts.push(addr.state)
      if (addr.postcode) parts.push(addr.postcode)
      
      let txt = parts.filter(Boolean).join(', ')
      
      // Fallback to display_name if parsing failed
      if (!txt && data?.display_name) {
        txt = data.display_name
      }
      
      if (txt) {
        try { localStorage.setItem(key, txt) } catch {}
        return txt
      }
    }
  } catch {}

  return null
}
