/**
 * 中间件统一导出
 */

export * from './auth.js'
export * from './errorHandler.js'

import auth from './auth.js'
import errorHandler from './errorHandler.js'

export default {
  ...auth,
  ...errorHandler
}

