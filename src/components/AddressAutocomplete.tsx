/**
 * 地址自动补全组件
 * 支持：1. 从客户历史地址选择 2. 从基础数据（港口/城市）选择 3. HERE API 自动补全 4. 输入新地址
 */
import { useState, useEffect, useRef } from 'react'
import { MapPin, Clock, Search, Plus, Loader2, Anchor, Building2 } from 'lucide-react'
import { portalApi } from '../utils/api'

interface Address {
  id?: string
  label: string
  address: string
  city?: string
  country?: string
  countryCode?: string
  postalCode?: string
  latitude?: number
  longitude?: number
  isNew?: boolean
  source?: 'history' | 'here' | 'manual' | 'port' | 'city'
  type?: 'port' | 'city' | 'address'
  code?: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string, addressData?: Address) => void
  placeholder?: string
  label?: string
  required?: boolean
  className?: string
  locationType?: 'origin' | 'destination' | 'all' // 起运地/目的地/全部
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = '输入地址...',
  label,
  required = false,
  className = '',
  locationType = 'all'
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Address[]>([])
  const [historyAddresses, setHistoryAddresses] = useState<Address[]>([])
  const [baseLocations, setBaseLocations] = useState<Address[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewAddressHint, setShowNewAddressHint] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // 加载客户历史地址
  useEffect(() => {
    loadHistoryAddresses()
  }, [])

  // 加载基础位置数据（港口/城市）
  useEffect(() => {
    loadBaseLocations()
  }, [locationType])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 同步外部 value
  useEffect(() => {
    setSearchQuery(value)
  }, [value])

  const loadHistoryAddresses = async () => {
    try {
      const res = await portalApi.getCustomerAddresses()
      if (res.data.errCode === 200) {
        setHistoryAddresses((res.data.data || []).map((addr: any) => ({
          id: addr.id,
          label: addr.label || addr.address,
          address: addr.address,
          city: addr.city,
          country: addr.country,
          postalCode: addr.postalCode,
          latitude: addr.latitude,
          longitude: addr.longitude,
          source: 'history' as const
        })))
      }
    } catch (error) {
      console.error('加载历史地址失败:', error)
    }
  }

  const loadBaseLocations = async () => {
    try {
      const res = await portalApi.getLocations({ type: locationType })
      if (res.data.errCode === 200) {
        setBaseLocations((res.data.data || []).map((loc: any) => ({
          id: loc.id,
          label: loc.label,
          address: loc.nameEn || loc.nameCn,
          city: loc.city || loc.nameCn,
          country: loc.country,
          countryCode: loc.countryCode,
          postalCode: loc.postalCode,
          code: loc.code,
          source: loc.type === 'port' ? 'port' as const : 'city' as const,
          type: loc.type
        })))
      }
    } catch (error) {
      console.error('加载基础位置数据失败:', error)
    }
  }

  const searchAddresses = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      setShowNewAddressHint(false)
      return
    }

    setLoading(true)
    try {
      // 1. 先搜索历史地址
      const historyMatches = historyAddresses.filter(addr =>
        addr.address.toLowerCase().includes(query.toLowerCase()) ||
        addr.label.toLowerCase().includes(query.toLowerCase())
      )

      // 2. 搜索基础位置数据（港口/城市）
      const baseMatches = baseLocations.filter(loc =>
        loc.label.toLowerCase().includes(query.toLowerCase()) ||
        (loc.address && loc.address.toLowerCase().includes(query.toLowerCase())) ||
        (loc.code && loc.code.toLowerCase().includes(query.toLowerCase()))
      )

      // 3. 调用 HERE API 搜索
      let hereResults: Address[] = []
      try {
        const res = await portalApi.searchAddresses({ query, limit: 5 })
        if (res.data.errCode === 200 && res.data.data) {
          hereResults = (res.data.data || []).map((item: any) => ({
            label: item.title || item.address,
            address: item.address,
            city: item.city,
            country: item.country,
            postalCode: item.postalCode,
            latitude: item.latitude,
            longitude: item.longitude,
            source: 'here' as const,
            type: 'address' as const
          }))
        }
      } catch (hereError) {
        console.warn('HERE API 搜索失败，使用基础数据:', hereError)
      }

      // 合并结果，历史地址 > 基础数据 > HERE API
      const combined = [
        ...historyMatches.slice(0, 3),
        ...baseMatches.slice(0, 5),
        ...hereResults.filter(h => 
          !historyMatches.some(hist => hist.address === h.address) &&
          !baseMatches.some(base => base.address === h.address)
        )
      ].slice(0, 10)

      setSuggestions(combined)
      
      // 如果没有完全匹配的结果，显示添加新地址提示
      const hasExactMatch = combined.some(addr => 
        addr.address.toLowerCase() === query.toLowerCase() ||
        addr.label.toLowerCase() === query.toLowerCase()
      )
      setShowNewAddressHint(!hasExactMatch && query.length > 5)
    } catch (error) {
      console.error('搜索地址失败:', error)
      // 即使 API 失败，也显示历史地址和基础数据匹配
      const historyMatches = historyAddresses.filter(addr =>
        addr.address.toLowerCase().includes(query.toLowerCase())
      )
      const baseMatches = baseLocations.filter(loc =>
        loc.label.toLowerCase().includes(query.toLowerCase())
      )
      setSuggestions([...historyMatches.slice(0, 3), ...baseMatches.slice(0, 5)])
      setShowNewAddressHint(historyMatches.length === 0 && baseMatches.length === 0 && query.length > 5)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onChange(query)
    setIsOpen(true)

    // 防抖搜索
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      searchAddresses(query)
    }, 300)
  }

  const handleSelectAddress = (address: Address) => {
    setSearchQuery(address.label || address.address)
    onChange(address.label || address.address, address)
    setIsOpen(false)
    setSuggestions([])
  }

  const handleAddNewAddress = () => {
    // 标记为新地址，提交询价时会触发审核流程
    const newAddress: Address = {
      label: searchQuery,
      address: searchQuery,
      isNew: true,
      source: 'manual'
    }
    onChange(searchQuery, newAddress)
    setIsOpen(false)
    setSuggestions([])
  }

  const handleFocus = () => {
    setIsOpen(true)
    if (!searchQuery) {
      // 显示默认选项：历史地址 + 常用港口/城市
      const defaultOptions = [
        ...historyAddresses.slice(0, 3),
        ...baseLocations.slice(0, 5)
      ]
      setSuggestions(defaultOptions)
    }
  }

  // 根据类型获取图标
  const getIcon = (address: Address) => {
    if (address.source === 'history') {
      return <Clock className="w-4 h-4 text-gray-400" />
    }
    if (address.source === 'port' || address.type === 'port') {
      return <Anchor className="w-4 h-4 text-blue-500" />
    }
    if (address.source === 'city' || address.type === 'city') {
      return <Building2 className="w-4 h-4 text-green-500" />
    }
    if (address.source === 'here') {
      return <MapPin className="w-4 h-4 text-primary-500" />
    }
    return <MapPin className="w-4 h-4 text-gray-400" />
  }

  // 根据来源分组
  const groupedSuggestions = {
    history: suggestions.filter(s => s.source === 'history'),
    ports: suggestions.filter(s => s.source === 'port'),
    cities: suggestions.filter(s => s.source === 'city'),
    here: suggestions.filter(s => s.source === 'here')
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* 下拉建议列表 */}
      {isOpen && (suggestions.length > 0 || showNewAddressHint) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {/* 历史地址部分 */}
          {groupedSuggestions.history.length > 0 && (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b">
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  历史地址
                </div>
              </div>
              {groupedSuggestions.history.map((addr, index) => (
                <button
                  key={`history-${index}`}
                  onClick={() => handleSelectAddress(addr)}
                  className="w-full px-3 py-2 text-left hover:bg-primary-50 flex items-start gap-2 border-b border-gray-100"
                >
                  {getIcon(addr)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{addr.label}</div>
                    {addr.label !== addr.address && (
                      <div className="text-xs text-gray-500 truncate">{addr.address}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* 港口部分 */}
          {groupedSuggestions.ports.length > 0 && (
            <>
              <div className="px-3 py-2 bg-blue-50 border-b">
                <div className="flex items-center text-xs text-blue-600">
                  <Anchor className="w-3 h-3 mr-1" />
                  港口
                </div>
              </div>
              {groupedSuggestions.ports.map((addr, index) => (
                <button
                  key={`port-${index}`}
                  onClick={() => handleSelectAddress(addr)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-start gap-2 border-b border-gray-100"
                >
                  {getIcon(addr)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {addr.label}
                      {addr.code && <span className="ml-1 text-xs text-blue-500">({addr.code})</span>}
                    </div>
                    {addr.country && (
                      <div className="text-xs text-gray-400">{addr.country}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* 城市部分 */}
          {groupedSuggestions.cities.length > 0 && (
            <>
              <div className="px-3 py-2 bg-green-50 border-b">
                <div className="flex items-center text-xs text-green-600">
                  <Building2 className="w-3 h-3 mr-1" />
                  城市
                </div>
              </div>
              {groupedSuggestions.cities.map((addr, index) => (
                <button
                  key={`city-${index}`}
                  onClick={() => handleSelectAddress(addr)}
                  className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-start gap-2 border-b border-gray-100"
                >
                  {getIcon(addr)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{addr.label}</div>
                    {addr.countryCode && (
                      <div className="text-xs text-gray-400">{addr.countryCode}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* HERE API 搜索结果 */}
          {groupedSuggestions.here.length > 0 && (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b">
                <div className="flex items-center text-xs text-gray-500">
                  <Search className="w-3 h-3 mr-1" />
                  搜索结果
                </div>
              </div>
              {groupedSuggestions.here.map((addr, index) => (
                <button
                  key={`here-${index}`}
                  onClick={() => handleSelectAddress(addr)}
                  className="w-full px-3 py-2 text-left hover:bg-primary-50 flex items-start gap-2 border-b border-gray-100"
                >
                  {getIcon(addr)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{addr.label}</div>
                    {addr.city && (
                      <div className="text-xs text-gray-400">{addr.city}, {addr.country}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* 添加新地址 */}
          {showNewAddressHint && searchQuery.length > 5 && (
            <button
              onClick={handleAddNewAddress}
              className="w-full px-3 py-3 text-left hover:bg-amber-50 flex items-center gap-2 border-t bg-amber-25"
            >
              <Plus className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-sm font-medium text-amber-700">
                  添加新地址: "{searchQuery}"
                </div>
                <div className="text-xs text-amber-600">
                  新地址将提交审核后保存到您的地址簿
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
