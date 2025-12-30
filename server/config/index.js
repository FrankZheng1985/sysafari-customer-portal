/**
 * 客户门户配置统一导出
 */

import * as database from './database.js'

// 系统常量
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
}

// 分页默认值
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
}

// 客户状态
export const CUSTOMER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended'
}

// API 密钥状态
export const API_KEY_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked'
}

// 重新导出数据库配置
export * from './database.js'

export default {
  ...database,
  HTTP_STATUS,
  PAGINATION,
  CUSTOMER_STATUS,
  API_KEY_STATUS
}

