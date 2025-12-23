import { useTheme } from 'next-themes'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>
      <div className="space-y-3">
        <div>
          <label className="text-sm">Theme</label>
          <select className="w-full mt-1 border rounded px-3 py-2 bg-background" value={theme || 'system'} onChange={e=>setTheme(e.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>
    </div>
  )
}
