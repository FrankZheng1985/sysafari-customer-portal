import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { portalApi } from '../utils/api'
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react'

interface CargoItem {
  productName: string
  productNameEn: string
  hsCode: string
  quantity: number
  unit: string
  unitPrice: number
}

export default function NewOrder() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    externalOrderNo: '',
    billNumber: '',
    containerNumber: '',
    shipper: '',
    consignee: '',
    portOfLoading: '',
    portOfDischarge: '',
    placeOfDelivery: '',
    etd: '',
    eta: '',
    pieces: '',
    weight: '',
    volume: '',
    containerType: '',
    serviceType: 'door-to-door',
    remark: ''
  })
  
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { productName: '', productNameEn: '', hsCode: '', quantity: 0, unit: 'PCS', unitPrice: 0 }
  ])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCargoChange = (index: number, field: keyof CargoItem, value: string | number) => {
    setCargoItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const addCargoItem = () => {
    setCargoItems(prev => [
      ...prev,
      { productName: '', productNameEn: '', hsCode: '', quantity: 0, unit: 'PCS', unitPrice: 0 }
    ])
  }

  const removeCargoItem = (index: number) => {
    if (cargoItems.length > 1) {
      setCargoItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    
    if (!formData.shipper && !formData.consignee) {
      setError('发货人或收货人至少填写一个')
      return
    }
    
    // 过滤掉空的货物明细
    const validCargoItems = cargoItems.filter(item => item.productName || item.productNameEn)
    
    setLoading(true)
    
    try {
      const res = await portalApi.createOrder({
        ...formData,
        pieces: formData.pieces ? parseInt(formData.pieces) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        volume: formData.volume ? parseFloat(formData.volume) : undefined,
        cargoItems: validCargoItems.length > 0 ? validCargoItems : undefined
      })
      
      if (res.data.errCode === 200) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/orders')
        }, 2000)
      } else {
        setError(res.data.msg || '创建订单失败')
      }
    } catch (err: any) {
      setError(err.response?.data?.msg || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">订单创建成功</h2>
        <p className="text-gray-500">正在跳转到订单列表...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center space-x-4 mb-6">
        <Link
          to="/orders"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">创建新订单</h1>
          <p className="text-sm text-gray-500">提交货物运输请求</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                外部订单号
              </label>
              <input
                type="text"
                name="externalOrderNo"
                value={formData.externalOrderNo}
                onChange={handleChange}
                className="input"
                placeholder="您系统中的订单号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                提单号
              </label>
              <input
                type="text"
                name="billNumber"
                value={formData.billNumber}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                集装箱号
              </label>
              <input
                type="text"
                name="containerNumber"
                value={formData.containerNumber}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                柜型
              </label>
              <select
                name="containerType"
                value={formData.containerType}
                onChange={handleChange}
                className="input"
              >
                <option value="">请选择</option>
                <option value="20GP">20GP</option>
                <option value="40GP">40GP</option>
                <option value="40HQ">40HQ</option>
                <option value="45HQ">45HQ</option>
              </select>
            </div>
          </div>
        </div>

        {/* 发货信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">发货信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发货人 *
              </label>
              <input
                type="text"
                name="shipper"
                value={formData.shipper}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                起运港
              </label>
              <input
                type="text"
                name="portOfLoading"
                value={formData.portOfLoading}
                onChange={handleChange}
                className="input"
                placeholder="如：CNSHA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ETD
              </label>
              <input
                type="date"
                name="etd"
                value={formData.etd}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* 收货信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">收货信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                收货人 *
              </label>
              <input
                type="text"
                name="consignee"
                value={formData.consignee}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目的港
              </label>
              <input
                type="text"
                name="portOfDischarge"
                value={formData.portOfDischarge}
                onChange={handleChange}
                className="input"
                placeholder="如：DEHAM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ETA
              </label>
              <input
                type="date"
                name="eta"
                value={formData.eta}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                送货地址
              </label>
              <input
                type="text"
                name="placeOfDelivery"
                value={formData.placeOfDelivery}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* 货物信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">货物信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总件数
              </label>
              <input
                type="number"
                name="pieces"
                value={formData.pieces}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总重量 (KG)
              </label>
              <input
                type="number"
                step="0.01"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总体积 (CBM)
              </label>
              <input
                type="number"
                step="0.01"
                name="volume"
                value={formData.volume}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-700 mb-3">货物明细</h3>
          <div className="space-y-3">
            {cargoItems.map((item, index) => (
              <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 flex-1">
                  <input
                    type="text"
                    placeholder="中文品名"
                    value={item.productName}
                    onChange={(e) => handleCargoChange(index, 'productName', e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="英文品名"
                    value={item.productNameEn}
                    onChange={(e) => handleCargoChange(index, 'productNameEn', e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="HS编码"
                    value={item.hsCode}
                    onChange={(e) => handleCargoChange(index, 'hsCode', e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="number"
                    placeholder="数量"
                    value={item.quantity || ''}
                    onChange={(e) => handleCargoChange(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="input text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="单价(USD)"
                    value={item.unitPrice || ''}
                    onChange={(e) => handleCargoChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="input text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCargoItem(index)}
                  className="p-2 text-gray-400 hover:text-red-500"
                  disabled={cargoItems.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCargoItem}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            添加货物
          </button>
        </div>

        {/* 备注 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">备注</h2>
          <textarea
            name="remark"
            value={formData.remark}
            onChange={handleChange}
            rows={3}
            className="input"
            placeholder="其他需要说明的信息..."
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex items-center justify-end space-x-4">
          <Link to="/orders" className="btn btn-secondary">
            取消
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              '提交订单'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

