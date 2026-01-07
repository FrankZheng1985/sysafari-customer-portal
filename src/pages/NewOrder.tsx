import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { portalApi } from '../utils/api'
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle, Ship, Plane, Truck, Train, Calendar, Upload, Download, FileSpreadsheet, X } from 'lucide-react'
import PartySelector from '../components/PartySelector'
import AddressAutocomplete from '../components/AddressAutocomplete'
import * as XLSX from 'xlsx'

interface CargoItem {
  no: number              // 序号
  marks: string           // 唛头
  productName: string     // 中文品名
  productNameEn: string   // 英文品名
  spec: string            // 型号/规格
  hsCode: string          // HS编码
  material: string        // 材质
  usage: string           // 用途
  brand: string           // 品牌
  origin: string          // 原产国
  quantity: number        // 数量
  unit: string            // 单位
  unitPrice: number       // 单价USD
  totalPrice: number      // 总价USD
  netWeight: number       // 净重KG
  grossWeight: number     // 毛重KG
  packages: number        // 件数
  packingType: string     // 包装方式
  volume: number          // 体积CBM
}

// 运输方式选项
const transportModes = [
  { value: 'sea', label: '海运', icon: Ship },
  { value: 'air', label: '空运', icon: Plane },
  { value: 'rail', label: '铁路', icon: Train },
  { value: 'truck', label: '卡车', icon: Truck },
]

// 常用船公司
const shippingLines = [
  'COSCO', 'MSC', 'MAERSK', 'CMA CGM', 'ONE', 'Evergreen', 
  'Hapag-Lloyd', 'Yang Ming', 'HMM', 'ZIM', 'PIL', 'OOCL',
  'Wan Hai', 'SITC', 'Other'
]

export default function NewOrder() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    // 基本信息
    transportMode: 'sea',          // 运输方式
    // 订单号由系统自动生成，不需要在表单中提交
    billNumber: '',                // 提单号
    shippingLine: '',              // 船公司
    containerNumber: '',           // 集装箱号
    containerType: '',             // 柜型
    sealNumber: '',                // 封号
    // 航程信息
    vesselVoyage: '',              // 航班号/船名航次
    terminal: '',                  // 地勤（码头）
    // 发货信息
    shipper: '',
    portOfLoading: '',
    etd: '',
    // 收货信息
    consignee: '',
    portOfDischarge: '',
    placeOfDelivery: '',
    eta: '',
    // 货物信息
    pieces: '',
    weight: '',
    volume: '',
    // 附加属性
    cargoType: 'FCL',              // 箱型: CFS(拼箱) / FCL(整箱)
    transportService: 'entrust',   // 运输方式固定为委托我司运输
    billType: 'master',            // 提单类型: master(船东单) / house(货代单)
    // 额外服务
    containerReturn: 'local',      // 异地还柜: remote(异地还柜) / local(本地还柜)
    containerReturnLocation: '',   // 异地还柜地点
    fullContainerDelivery: 'full', // 全程整柜运输: full(必须整柜派送) / devan(可拆柜后托盘送货)
    lastMileTransport: 'truck',    // 末端运输方式
    devanService: 'no',            // 拆柜: yes(需要拆柜分货服务) / no(不需要拆柜)
    t1CustomsService: 'no',        // 海关经停报关服务(T1报关): yes / no
    // 其他
    serviceType: 'door-to-door',
    remark: ''
  })
  
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { 
      no: 1, marks: '', productName: '', productNameEn: '', spec: '', hsCode: '', 
      material: '', usage: '', brand: '', origin: '', quantity: 0, unit: 'PCS', 
      unitPrice: 0, totalPrice: 0, netWeight: 0, grossWeight: 0, packages: 0, 
      packingType: '', volume: 0 
    }
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
      { 
        no: prev.length + 1, marks: '', productName: '', productNameEn: '', spec: '', hsCode: '', 
        material: '', usage: '', brand: '', origin: '', quantity: 0, unit: 'PCS', 
        unitPrice: 0, totalPrice: 0, netWeight: 0, grossWeight: 0, packages: 0, 
        packingType: '', volume: 0 
      }
    ])
  }

  const removeCargoItem = (index: number) => {
    if (cargoItems.length > 1) {
      setCargoItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  // 文件上传相关
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')
  const [importing, setImporting] = useState(false)

  // 下载模板
  const downloadTemplate = () => {
    const templateData = [
      {
        '序号': 1,
        '唛头': 'N/M',
        '中文品名': '电子产品配件',
        '英文品名': 'Electronic Parts',
        '型号规格': 'Model A-100',
        'HS编码': '8471300000',
        '材质': '塑料+金属',
        '用途': '电子设备配件',
        '品牌': 'OEM',
        '原产国': 'China',
        '数量': 1000,
        '单位': 'PCS',
        '单价USD': 2.50,
        '总价USD': 2500.00,
        '净重KG': 150.00,
        '毛重KG': 180.00,
        '件数': 10,
        '包装方式': '纸箱',
        '体积CBM': 2.5
      },
      {
        '序号': 2,
        '唛头': 'N/M',
        '中文品名': '塑料制品',
        '英文品名': 'Plastic Products',
        '型号规格': 'PP-200',
        'HS编码': '3926909090',
        '材质': 'PP塑料',
        '用途': '日用品',
        '品牌': 'Generic',
        '原产国': 'China',
        '数量': 5000,
        '单位': 'PCS',
        '单价USD': 0.50,
        '总价USD': 2500.00,
        '净重KG': 200.00,
        '毛重KG': 250.00,
        '件数': 20,
        '包装方式': '纸箱',
        '体积CBM': 4.0
      }
    ]
    
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '货物明细')
    
    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 10 },  // 唛头
      { wch: 18 },  // 中文品名
      { wch: 22 },  // 英文品名
      { wch: 15 },  // 型号规格
      { wch: 12 },  // HS编码
      { wch: 12 },  // 材质
      { wch: 12 },  // 用途
      { wch: 10 },  // 品牌
      { wch: 10 },  // 原产国
      { wch: 8 },   // 数量
      { wch: 6 },   // 单位
      { wch: 10 },  // 单价USD
      { wch: 12 },  // 总价USD
      { wch: 10 },  // 净重KG
      { wch: 10 },  // 毛重KG
      { wch: 6 },   // 件数
      { wch: 10 },  // 包装方式
      { wch: 10 },  // 体积CBM
    ]
    
    XLSX.writeFile(wb, '货物明细模板.xlsx')
  }

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError('')
    setImporting(true)

    try {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        try {
          const data = event.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(sheet)

          if (jsonData.length === 0) {
            setUploadError('文件中没有数据')
            setImporting(false)
            return
          }

          // 解析数据并转换为 CargoItem 格式
          const importedItems: CargoItem[] = jsonData.map((row: any, index: number) => ({
            no: parseInt(row['序号'] || row['no'] || row['No'] || row['No.']) || (index + 1),
            marks: row['唛头'] || row['marks'] || row['Marks'] || row['Marks & Numbers'] || '',
            productName: row['中文品名'] || row['productName'] || row['品名'] || '',
            productNameEn: row['英文品名'] || row['productNameEn'] || row['English Name'] || '',
            spec: row['型号规格'] || row['规格'] || row['型号'] || row['spec'] || row['Model'] || row['Specification'] || '',
            hsCode: String(row['HS编码'] || row['hsCode'] || row['HS Code'] || row['HSCode'] || ''),
            material: row['材质'] || row['material'] || row['Material'] || '',
            usage: row['用途'] || row['usage'] || row['Usage'] || '',
            brand: row['品牌'] || row['brand'] || row['Brand'] || '',
            origin: row['原产国'] || row['origin'] || row['Origin'] || row['Country of Origin'] || '',
            quantity: parseInt(row['数量'] || row['quantity'] || row['Quantity'] || row['Qty'] || 0) || 0,
            unit: row['单位'] || row['unit'] || row['Unit'] || 'PCS',
            unitPrice: parseFloat(row['单价USD'] || row['单价'] || row['unitPrice'] || row['Unit Price'] || 0) || 0,
            totalPrice: parseFloat(row['总价USD'] || row['总价'] || row['totalPrice'] || row['Total Price'] || row['Amount'] || 0) || 0,
            netWeight: parseFloat(row['净重KG'] || row['净重'] || row['netWeight'] || row['Net Weight'] || row['N.W.'] || 0) || 0,
            grossWeight: parseFloat(row['毛重KG'] || row['毛重'] || row['grossWeight'] || row['Gross Weight'] || row['G.W.'] || 0) || 0,
            packages: parseInt(row['件数'] || row['packages'] || row['Packages'] || row['CTNS'] || row['Cartons'] || 0) || 0,
            packingType: row['包装方式'] || row['包装'] || row['packingType'] || row['Packing'] || '',
            volume: parseFloat(row['体积CBM'] || row['体积'] || row['volume'] || row['Volume'] || row['CBM'] || 0) || 0
          }))

          // 过滤掉完全空的行
          const validItems = importedItems.filter(item => 
            item.productName || item.productNameEn || item.hsCode
          )

          if (validItems.length === 0) {
            setUploadError('未找到有效的货物数据，请检查文件格式')
            setImporting(false)
            return
          }

          // 重新编号
          const renumberedItems = validItems.map((item, idx) => ({ ...item, no: idx + 1 }))
          
          // 替换现有的货物明细（如果只有一个空项）或追加
          if (cargoItems.length === 1 && !cargoItems[0].productName && !cargoItems[0].productNameEn) {
            setCargoItems(renumberedItems)
          } else {
            const startNo = cargoItems.length
            const appendItems = renumberedItems.map((item, idx) => ({ ...item, no: startNo + idx + 1 }))
            setCargoItems(prev => [...prev, ...appendItems])
          }

          setImporting(false)
        } catch (err) {
          console.error('解析文件错误:', err)
          setUploadError('文件解析失败，请确保文件格式正确')
          setImporting(false)
        }
      }

      reader.onerror = () => {
        setUploadError('文件读取失败')
        setImporting(false)
      }

      reader.readAsBinaryString(file)
    } catch (err) {
      setUploadError('文件处理失败')
      setImporting(false)
    }

    // 清空 input 以便可以重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 清空所有货物明细
  const clearAllCargoItems = () => {
    if (confirm('确定要清空所有货物明细吗？')) {
      setCargoItems([{ 
        no: 1, marks: '', productName: '', productNameEn: '', spec: '', hsCode: '', 
        material: '', usage: '', brand: '', origin: '', quantity: 0, unit: 'PCS', 
        unitPrice: 0, totalPrice: 0, netWeight: 0, grossWeight: 0, packages: 0, 
        packingType: '', volume: 0 
      }])
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
    
    // 验证必填字段
    if (!formData.shippingLine) {
      setError('请选择船公司')
      return
    }
    if (!formData.containerNumber) {
      setError('请填写集装箱号')
      return
    }
    if (!formData.containerType) {
      setError('请选择柜型')
      return
    }
    
    // 如果选择异地还柜，必须填写还柜地点
    if (formData.containerReturn === 'remote' && !formData.containerReturnLocation) {
      setError('请填写异地还柜地点')
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
          <h1 className="text-page-title">创建新订单</h1>
          <p className="text-small">提交货物运输请求</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 运输方式 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">运输方式 <span className="text-red-500">*</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {transportModes.map((mode) => {
              const Icon = mode.icon
              return (
                <label
                  key={mode.value}
                  className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.transportMode === mode.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportMode"
                    value={mode.value}
                    checked={formData.transportMode === mode.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <Icon className={`w-6 h-6 mb-2 ${
                    formData.transportMode === mode.value ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    formData.transportMode === mode.value ? 'text-primary-700' : 'text-gray-600'
                  }`}>{mode.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* 基本信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                订单号
              </label>
              <input
                type="text"
                value="系统自动生成"
                disabled
                className="input bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">提交后系统将自动分配订单号</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                船公司 <span className="text-red-500">*</span>
              </label>
              <select
                name="shippingLine"
                value={formData.shippingLine}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="">选择船公司</option>
                {shippingLines.map(line => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                提单号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="billNumber"
                value={formData.billNumber}
                onChange={handleChange}
                className="input"
                placeholder="输入完整提单号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                集装箱号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="containerNumber"
                value={formData.containerNumber}
                onChange={handleChange}
                className="input"
                placeholder="如 COSU1234567"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                柜型 <span className="text-red-500">*</span>
              </label>
              <select
                name="containerType"
                value={formData.containerType}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="">请选择柜型</option>
                <option value="20GP">20GP</option>
                <option value="40GP">40GP</option>
                <option value="40HQ">40HQ</option>
                <option value="45HQ">45HQ</option>
                <option value="20RF">20RF (冷藏)</option>
                <option value="40RF">40RF (冷藏)</option>
                <option value="20OT">20OT (开顶)</option>
                <option value="40OT">40OT (开顶)</option>
                <option value="20FR">20FR (框架)</option>
                <option value="40FR">40FR (框架)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                封号
              </label>
              <input
                type="text"
                name="sealNumber"
                value={formData.sealNumber}
                onChange={handleChange}
                className="input"
                placeholder="铅封号"
              />
            </div>
          </div>
        </div>

        {/* 航程信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">航程信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.transportMode === 'air' ? '航班号' : '船名航次'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="vesselVoyage"
                value={formData.vesselVoyage}
                onChange={handleChange}
                className="input"
                placeholder={formData.transportMode === 'air' ? '如 CA123' : '如 EVER GIVEN / 025W'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                地勤（码头）
              </label>
              <input
                type="text"
                name="terminal"
                value={formData.terminal}
                onChange={handleChange}
                className="input"
                placeholder="集装箱落在哪个码头"
              />
            </div>
          </div>
        </div>

        {/* 港口信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">港口信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                起运港 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="portOfLoading"
                value={formData.portOfLoading}
                onChange={handleChange}
                className="input"
                placeholder="搜索或选择起运港"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目的港 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="portOfDischarge"
                value={formData.portOfDischarge}
                onChange={handleChange}
                className="input"
                placeholder="搜索或选择目的港"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ETD (预计离港)
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="etd"
                  value={formData.etd}
                  onChange={handleChange}
                  className="input pr-10 cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ETA (预计到港)
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="eta"
                  value={formData.eta}
                  onChange={handleChange}
                  className="input pr-10 cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* 附加属性 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">附加属性</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 箱型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                箱型 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cargoType"
                    value="CFS"
                    checked={formData.cargoType === 'CFS'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">拼箱 (CFS)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cargoType"
                    value="FCL"
                    checked={formData.cargoType === 'FCL'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">整箱 (FCL)</span>
                </label>
              </div>
            </div>

            {/* 提单 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提单 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="billType"
                    value="master"
                    checked={formData.billType === 'master'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">船东单 (Master Bill)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="billType"
                    value="house"
                    checked={formData.billType === 'house'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">货代单 (House Bill)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 额外服务 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">额外服务</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 异地还柜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                异地还柜 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="containerReturn"
                      value="remote"
                      checked={formData.containerReturn === 'remote'}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">异地还柜</span>
                  </label>
                  {/* 当选择异地还柜时，显示还柜地点输入框 */}
                  {formData.containerReturn === 'remote' && (
                    <input
                      type="text"
                      name="containerReturnLocation"
                      value={formData.containerReturnLocation}
                      onChange={handleChange}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="请输入还柜地点"
                      required
                    />
                  )}
                </div>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="containerReturn"
                    value="local"
                    checked={formData.containerReturn === 'local'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">本地还柜 (提柜码头还柜)</span>
                </label>
              </div>
            </div>

            {/* 全程整柜运输 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                全程整柜运输 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fullContainerDelivery"
                    value="full"
                    checked={formData.fullContainerDelivery === 'full'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">必须整柜派送</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fullContainerDelivery"
                    value="devan"
                    checked={formData.fullContainerDelivery === 'devan'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">可拆柜后托盘送货</span>
                </label>
              </div>
            </div>

            {/* 末端运输方式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                末端运输方式 <span className="text-red-500">*</span>
              </label>
              <select
                name="lastMileTransport"
                value={formData.lastMileTransport}
                onChange={handleChange}
                className="input"
              >
                <option value="truck">卡车派送</option>
                <option value="van">小型货车派送</option>
                <option value="express">快递派送</option>
                <option value="pickup">客户自提</option>
              </select>
            </div>

            {/* 拆柜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                拆柜 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="devanService"
                    value="yes"
                    checked={formData.devanService === 'yes'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">需要拆柜分货服务</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="devanService"
                    value="no"
                    checked={formData.devanService === 'no'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">不需要拆柜</span>
                </label>
              </div>
            </div>

            {/* 海关经停报关服务(T1报关) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                海关经停报关服务 (T1报关) <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="t1CustomsService"
                    value="yes"
                    checked={formData.t1CustomsService === 'yes'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">是</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="t1CustomsService"
                    value="no"
                    checked={formData.t1CustomsService === 'no'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">否</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 发货信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">发货信息</h2>
          <div className="space-y-4">
            <PartySelector
              type="shipper"
              value={formData.shipper}
              onChange={(value) => setFormData(prev => ({ ...prev, shipper: value }))}
              label="发货人"
              placeholder="发货人名称、地址、联系方式"
              required
            />
          </div>
        </div>

        {/* 收货信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">收货信息</h2>
          <div className="space-y-4">
            <PartySelector
              type="consignee"
              value={formData.consignee}
              onChange={(value) => setFormData(prev => ({ ...prev, consignee: value }))}
              label="收货人"
              placeholder="收货人名称、地址、联系方式"
              required
            />
            <AddressAutocomplete
              value={formData.placeOfDelivery}
              onChange={(value) => setFormData(prev => ({ ...prev, placeOfDelivery: value }))}
              label="送货地址"
              placeholder="输入送货地址（支持HERE地址搜索）"
            />
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

          {/* 货物明细标题和操作按钮 */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">货物明细</h3>
            <div className="flex items-center gap-2">
              {/* 下载模板 */}
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                下载模板
              </button>
              
              {/* 上传文件 */}
                  <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300"
              >
                {importing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    导入Excel
                  </>
                )}
              </button>

              {/* 清空按钮 - 只在有多条数据时显示 */}
              {cargoItems.length > 1 && (
                <button
                  type="button"
                  onClick={clearAllCargoItems}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  清空
                </button>
              )}
                </div>
          </div>

          {/* 上传错误提示 */}
          {uploadError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {uploadError}
                <button
                  type="button"
                onClick={() => setUploadError('')}
                className="ml-auto text-red-500 hover:text-red-700"
                >
                <X className="w-4 h-4" />
                </button>
              </div>
          )}

          {/* 导入统计 */}
          {cargoItems.length > 1 && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center gap-3 text-sm text-blue-700">
              <span className="flex items-center">
                <FileSpreadsheet className="w-4 h-4 mr-1.5 flex-shrink-0" />
                共 <strong className="mx-1">{cargoItems.filter(item => item.productName || item.productNameEn).length}</strong> 条记录
              </span>
              <span className="text-blue-300">|</span>
              <span>总金额: <strong>${cargoItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
              <span className="text-blue-300">|</span>
              <span>毛重: <strong>{cargoItems.reduce((sum, item) => sum + (item.grossWeight || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} KG</strong></span>
              <span className="text-blue-300">|</span>
              <span>件数: <strong>{cargoItems.reduce((sum, item) => sum + (item.packages || 0), 0).toLocaleString()}</strong></span>
              <span className="text-blue-300">|</span>
              <span>体积: <strong>{cargoItems.reduce((sum, item) => sum + (item.volume || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} CBM</strong></span>
            </div>
          )}

          {/* 货物明细列表 - 表格形式 */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-center w-10">序号</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">唛头</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">中文品名</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">英文品名</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">型号规格</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">HS编码</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">材质</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">用途</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">品牌</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">原产国</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">数量</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-center">单位</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">单价USD</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">总价USD</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">净重KG</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">毛重KG</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">件数</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">包装</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">体积CBM</th>
                  <th className="px-2 py-2 text-xs font-medium text-gray-500 text-center w-10">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cargoItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-1 py-1 text-center">
                      <span className="text-xs text-gray-500">{index + 1}</span>
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.marks} onChange={(e) => handleCargoChange(index, 'marks', e.target.value)}
                        className="w-16 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="唛头" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.productName} onChange={(e) => handleCargoChange(index, 'productName', e.target.value)}
                        className="w-24 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="中文品名" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.productNameEn} onChange={(e) => handleCargoChange(index, 'productNameEn', e.target.value)}
                        className="w-28 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="英文品名" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.spec} onChange={(e) => handleCargoChange(index, 'spec', e.target.value)}
                        className="w-20 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="型号规格" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.hsCode} onChange={(e) => handleCargoChange(index, 'hsCode', e.target.value)}
                        className="w-20 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="HS编码" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.material} onChange={(e) => handleCargoChange(index, 'material', e.target.value)}
                        className="w-16 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="材质" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.usage} onChange={(e) => handleCargoChange(index, 'usage', e.target.value)}
                        className="w-16 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="用途" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.brand} onChange={(e) => handleCargoChange(index, 'brand', e.target.value)}
                        className="w-14 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="品牌" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.origin} onChange={(e) => handleCargoChange(index, 'origin', e.target.value)}
                        className="w-14 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="原产国" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={item.quantity || ''} onChange={(e) => handleCargoChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-14 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="数量" />
                    </td>
                    <td className="px-1 py-1">
                      <select value={item.unit} onChange={(e) => handleCargoChange(index, 'unit', e.target.value)}
                        className="w-14 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500">
                        <option value="PCS">PCS</option>
                        <option value="SET">SET</option>
                        <option value="KG">KG</option>
                        <option value="MT">MT</option>
                        <option value="CTN">CTN</option>
                        <option value="PKG">PKG</option>
                        <option value="ROLL">ROLL</option>
                        <option value="M">M</option>
                        <option value="M2">M²</option>
                        <option value="M3">M³</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" value={item.unitPrice || ''} onChange={(e) => handleCargoChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="单价" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" value={item.totalPrice || ''} onChange={(e) => handleCargoChange(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                        className="w-18 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="总价" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" value={item.netWeight || ''} onChange={(e) => handleCargoChange(index, 'netWeight', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="净重" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" value={item.grossWeight || ''} onChange={(e) => handleCargoChange(index, 'grossWeight', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="毛重" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={item.packages || ''} onChange={(e) => handleCargoChange(index, 'packages', parseInt(e.target.value) || 0)}
                        className="w-12 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="件数" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.packingType} onChange={(e) => handleCargoChange(index, 'packingType', e.target.value)}
                        className="w-14 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500" placeholder="包装" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.01" value={item.volume || ''} onChange={(e) => handleCargoChange(index, 'volume', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-right" placeholder="体积" />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button type="button" onClick={() => removeCargoItem(index)} disabled={cargoItems.length === 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* 合计行 */}
              {cargoItems.length > 0 && (
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={10} className="px-2 py-2 text-xs font-medium text-gray-700 text-right">合计:</td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900 text-right">
                      {cargoItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900 text-right">
                      ${cargoItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900 text-right">
                      {cargoItems.reduce((sum, item) => sum + (item.netWeight || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900 text-right">
                      {cargoItems.reduce((sum, item) => sum + (item.grossWeight || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900 text-right">
                      {cargoItems.reduce((sum, item) => sum + (item.packages || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900 text-right">
                      {cargoItems.reduce((sum, item) => sum + (item.volume || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
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

