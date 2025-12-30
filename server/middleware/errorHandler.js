/**
 * 错误处理中间件
 */

/**
 * 404 处理
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    errCode: 404,
    msg: '请求的资源不存在',
    data: null
  })
}

/**
 * 全局错误处理
 */
export function globalErrorHandler(err, req, res, next) {
  console.error('服务器错误:', err)

  // 已经发送响应，不再处理
  if (res.headersSent) {
    return next(err)
  }

  // 返回统一格式的错误响应
  res.status(err.status || 500).json({
    errCode: err.status || 500,
    msg: err.message || '服务器内部错误',
    data: null
  })
}

export default {
  notFoundHandler,
  globalErrorHandler
}

