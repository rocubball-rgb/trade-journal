'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Account, SetupType } from '@/lib/types'

export default function Settings() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [loading, setLoading] = useState(false)

  const [newYear, setNewYear] = useState(new Date().getFullYear())
  const [newCapital, setNewCapital] = useState(100000)
  const [newSetupName, setNewSetupName] = useState('')
  const [newSetupColor, setNewSetupColor] = useState('#3b82f6')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .order('year', { ascending: false })

    const { data: setupTypesData } = await supabase
      .from('setup_types')
      .select('*')
      .order('name')

    if (accountsData) setAccounts(accountsData)
    if (setupTypesData) setSetupTypes(setupTypesData)
  }

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('accounts').insert([
        {
          year: newYear,
          starting_capital: newCapital,
        },
      ])

      if (error) throw error

      await loadData()
      setNewYear(new Date().getFullYear() + 1)
      setNewCapital(100000)
    } catch (error: any) {
      console.error('Error adding account:', error)
      if (error.code === '23505') {
        alert('Account for this year already exists.')
      } else {
        alert('Failed to add account.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCapital = async (accountId: string, capital: number) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ starting_capital: capital })
        .eq('id', accountId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error updating capital:', error)
      alert('Failed to update capital.')
    }
  }

  const handleAddSetupType = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('setup_types').insert([
        {
          name: newSetupName,
          color: newSetupColor,
        },
      ])

      if (error) throw error

      await loadData()
      setNewSetupName('')
      setNewSetupColor('#3b82f6')
    } catch (error: any) {
      console.error('Error adding setup type:', error)
      if (error.code === '23505') {
        alert('Setup type with this name already exists.')
      } else {
        alert('Failed to add setup type.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSetupType = async (setupId: string) => {
    if (!confirm('Are you sure you want to delete this setup type?')) return

    try {
      const { error } = await supabase.from('setup_types').delete().eq('id', setupId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting setup type:', error)
      alert('Failed to delete setup type. It may be in use by existing trades.')
    }
  }

  const handleUpdateSetupType = async (
    setupId: string,
    field: 'name' | 'color',
    value: string
  ) => {
    try {
      const { error } = await supabase
        .from('setup_types')
        .update({ [field]: value })
        .eq('id', setupId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error updating setup type:', error)
      alert('Failed to update setup type.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
      </div>

      {/* Starting Capital Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Starting Capital by Year</h3>

        <div className="space-y-3 mb-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between bg-gray-900 rounded p-3"
            >
              <span className="font-medium">{account.year}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  value={account.starting_capital}
                  onChange={(e) =>
                    handleUpdateCapital(account.id, parseFloat(e.target.value) || 0)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddAccount} className="flex gap-3">
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(parseInt(e.target.value))}
            required
            placeholder="Year"
            className="bg-gray-900 border border-gray-700 rounded px-4 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            value={newCapital}
            onChange={(e) => setNewCapital(parseFloat(e.target.value) || 0)}
            required
            placeholder="Starting Capital"
            className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded transition-colors"
          >
            Add Year
          </button>
        </form>
      </div>

      {/* Setup Types Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Setup Types</h3>

        <div className="space-y-3 mb-6">
          {setupTypes.map((setup) => (
            <div
              key={setup.id}
              className="flex items-center gap-3 bg-gray-900 rounded p-3"
            >
              <input
                type="color"
                value={setup.color}
                onChange={(e) =>
                  handleUpdateSetupType(setup.id, 'color', e.target.value)
                }
                className="w-10 h-10 rounded cursor-pointer bg-transparent border border-gray-700"
              />
              <input
                type="text"
                value={setup.name}
                onChange={(e) =>
                  handleUpdateSetupType(setup.id, 'name', e.target.value)
                }
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleDeleteSetupType(setup.id)}
                className="text-red-500 hover:text-red-400 px-3 py-2 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddSetupType} className="flex gap-3">
          <input
            type="color"
            value={newSetupColor}
            onChange={(e) => setNewSetupColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer bg-transparent border border-gray-700"
          />
          <input
            type="text"
            value={newSetupName}
            onChange={(e) => setNewSetupName(e.target.value)}
            required
            placeholder="Setup Type Name"
            className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded transition-colors"
          >
            Add Setup
          </button>
        </form>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-2">About</h3>
        <p className="text-sm text-gray-400">
          Trade Journal App - Track and analyze your trading performance with detailed
          metrics and insights.
        </p>
      </div>
    </div>
  )
}
