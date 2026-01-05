/**
 * 日期选择器组件
 * 基于 react-datepicker，支持中文和自定义样式
 */
import DatePicker, { registerLocale } from 'react-datepicker'
import { zhCN } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import 'react-datepicker/dist/react-datepicker.css'

// 注册中文语言
registerLocale('zh-CN', zhCN)

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export default function DateInput({ value, onChange, placeholder = '选择日期', label, className = '' }: DateInputProps) {
  // 将字符串转换为 Date 对象
  const dateValue = value ? new Date(value) : null
  
  // 处理日期变化
  const handleChange = (date: Date | null) => {
    if (date) {
      // 转换为 YYYY-MM-DD 格式
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      onChange(`${year}-${month}-${day}`)
    } else {
      onChange('')
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      )}
      <div className="relative">
        <DatePicker
          selected={dateValue}
          onChange={handleChange}
          dateFormat="yyyy-MM-dd"
          locale="zh-CN"
          placeholderText={placeholder}
          isClearable
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          className="input text-sm w-full pr-10"
          calendarClassName="custom-datepicker"
          wrapperClassName="w-full"
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

