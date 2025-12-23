import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function FabReport() {
  const nav = useNavigate()
  return (
    <button
      aria-label="Report an Issue"
      className="sm:hidden fixed right-4 bottom-20 z-40 h-12 w-12 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center hover:bg-orange-600 active:scale-95 transition"
      onClick={() => nav('/report')}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
