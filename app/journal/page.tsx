'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface JournalEntry {
  id: string
  entry_date: string
  content: string
  chart_urls: string[]
  created_at: string
}

function getTradingViewImageUrl(url: string): string | null {
  try {
    const match = url.match(/tradingview\.com\/x\/([A-Za-z0-9]+)/)
    if (match && match[1]) {
      const id = match[1]
      const firstLetter = id[0].toLowerCase()
      return `https://s3.tradingview.com/snapshots/${firstLetter}/${id}.png`
    }
  } catch (e) {
    console.error('Error parsing TradingView URL:', e)
  }
  return null
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    entry_date: today,
    content: '',
    chart_urls: [''],
  })

  useEffect(() => {
    loadEntries()
  }, [])

  async function loadEntries() {
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })

    if (data) setEntries(data)
  }

  function resetForm() {
    setForm({ entry_date: today, content: '', chart_urls: [''] })
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const chartUrls = form.chart_urls.filter((url) => url.trim() !== '')

    try {
      if (editingId) {
        const { error } = await supabase
          .from('journal_entries')
          .update({
            entry_date: form.entry_date,
            content: form.content,
            chart_urls: chartUrls,
          })
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('journal_entries').insert([
          {
            entry_date: form.entry_date,
            content: form.content,
            chart_urls: chartUrls,
          },
        ])

        if (error) throw error
      }

      await loadEntries()
      resetForm()
    } catch (error) {
      console.error('Error saving journal entry:', error)
      alert('Failed to save entry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(entry: JournalEntry) {
    setForm({
      entry_date: entry.entry_date,
      content: entry.content,
      chart_urls: entry.chart_urls.length > 0 ? [...entry.chart_urls, ''] : [''],
    })
    setEditingId(entry.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this journal entry?')) return

    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id)
      if (error) throw error
      await loadEntries()
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('Failed to delete entry.')
    }
  }

  function addChartUrlField() {
    setForm({ ...form, chart_urls: [...form.chart_urls, ''] })
  }

  function updateChartUrl(index: number, value: string) {
    const updated = [...form.chart_urls]
    updated[index] = value
    setForm({ ...form, chart_urls: updated })
  }

  function removeChartUrl(index: number) {
    const updated = form.chart_urls.filter((_, i) => i !== index)
    setForm({ ...form, chart_urls: updated.length === 0 ? [''] : updated })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Market Journal</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            + New Entry
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editingId ? 'Edit Entry' : 'New Journal Entry'}</h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-200 text-sm"
            >
              Cancel
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Date</label>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              required
              className="w-full md:w-64 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Commentary</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              rows={6}
              placeholder="What's happening in the market today? What are you seeing? What are you thinking?"
              className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">TradingView Charts (optional)</label>
            {form.chart_urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => updateChartUrl(index, e.target.value)}
                  placeholder="https://www.tradingview.com/x/..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {form.chart_urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChartUrl(index)}
                    className="text-red-500 hover:text-red-400 px-2"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addChartUrlField}
              className="text-sm text-blue-500 hover:text-blue-400"
            >
              + Add another chart
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded transition-colors"
          >
            {loading ? 'Saving...' : editingId ? 'Update Entry' : 'Save Entry'}
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-500">
          No journal entries yet. Start documenting your market thoughts.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-lg">{entry.entry_date}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="text-sm text-blue-500 hover:text-blue-400"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-sm text-red-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="text-gray-300 whitespace-pre-wrap">{entry.content}</div>

              {entry.chart_urls && entry.chart_urls.length > 0 && (
                <div className="mt-4 space-y-3">
                  {entry.chart_urls.map((url, index) => {
                    const imageUrl = getTradingViewImageUrl(url)
                    return imageUrl ? (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={imageUrl}
                          alt={`Chart ${index + 1}`}
                          className="w-full rounded-lg border border-gray-700"
                        />
                        <div className="text-xs text-gray-400 mt-1 text-center">
                          Click to open in TradingView
                        </div>
                      </a>
                    ) : (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-500 hover:text-blue-400 underline break-all text-sm"
                      >
                        {url}
                      </a>
                    )
                  })}
                </div>
              )}

              <div className="text-xs text-gray-500 mt-3">
                Added {new Date(entry.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
