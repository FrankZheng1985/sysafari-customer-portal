/**
 * 角色管理模块路由
 * 管理客户公司的角色和权限配置
 */

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.js'
import { getDatabase } from '../../config/database.js'

const router = Router()

/**
 * 获取所有权限定义
 * GET /api/permissions
 */
router.get('/permissions', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    
    const permissions = await db.prepare(`
      SELECT id, code, name, module, description, sort_order
      FROM portal_permissions
      ORDER BY sort_order ASC, module ASC
    `).all()
    
    // 按模块分组
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = {
          module: perm.module,
          moduleName: getModuleName(perm.module),
          permissions: []
        }
      }
      acc[perm.module].permissions.push(perm)
      return acc
    }, {})
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: permissions,
        grouped: Object.values(grouped)
      }
    })
    
  } catch (error) {
    console.error('获取权限列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取权限列表失败',
      data: null
    })
  }
})

// 获取模块中文名称
function getModuleName(module) {
  const moduleNames = {
    'dashboard': '仪表盘',
    'orders': '订单管理',
    'quote': '在线询价',
    'tariff': '关税计算',
    'finance': '财务管理',
    'api': 'API管理',
    'users': '用户管理',
    'roles': '角色管理',
    'settings': '系统设置'
  }
  return moduleNames[module] || module
}

/**
 * 获取角色列表
 * GET /api/roles
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const roles = await db.prepare(`
      SELECT 
        r.id,
        r.name,
        r.description,
        r.is_system,
        r.is_default,
        r.status,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT pu.id) as user_count
      FROM portal_roles r
      LEFT JOIN portal_users pu ON r.id = pu.role_id AND pu.status != 'deleted'
      WHERE r.customer_id = $1 AND r.status != $2
      GROUP BY r.id
      ORDER BY r.is_system DESC, r.created_at ASC
    `).all(customerId, 'deleted')
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: roles,
        total: roles.length
      }
    })
    
  } catch (error) {
    console.error('获取角色列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取角色列表失败',
      data: null
    })
  }
})

/**
 * 获取角色详情（含权限列表）
 * GET /api/roles/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    
    // 获取角色基本信息
    const role = await db.prepare(`
      SELECT id, name, description, is_system, is_default, status, created_at, updated_at
      FROM portal_roles
      WHERE id = $1 AND customer_id = $2 AND status != $3
    `).get(id, customerId, 'deleted')
    
    if (!role) {
      return res.status(404).json({
        errCode: 404,
        msg: '角色不存在',
        data: null
      })
    }
    
    // 获取角色的权限列表
    const permissions = await db.prepare(`
      SELECT p.id, p.code, p.name, p.module, p.description
      FROM portal_permissions p
      INNER JOIN portal_role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.sort_order ASC
    `).all(id)
    
    role.permissions = permissions
    role.permissionCodes = permissions.map(p => p.code)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: role
    })
    
  } catch (error) {
    console.error('获取角色详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取角色详情失败',
      data: null
    })
  }
})

/**
 * 创建角色
 * POST /api/roles
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const { name, description, permissionIds, isDefault } = req.body
    
    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        errCode: 400,
        msg: '请输入角色名称',
        data: null
      })
    }
    
    // 检查角色名是否已存在
    const existingRole = await db.prepare(`
      SELECT id FROM portal_roles 
      WHERE customer_id = $1 AND name = $2 AND status != $3
    `).get(customerId, name.trim(), 'deleted')
    
    if (existingRole) {
      return res.status(400).json({
        errCode: 400,
        msg: '该角色名称已存在',
        data: null
      })
    }
    
    // 如果设置为默认角色，先取消其他默认角色
    if (isDefault) {
      await db.prepare(`
        UPDATE portal_roles 
        SET is_default = false
        WHERE customer_id = $1 AND is_default = true
      `).run(customerId)
    }
    
    // 创建角色
    const result = await db.prepare(`
      INSERT INTO portal_roles (customer_id, name, description, is_default)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `).get(customerId, name.trim(), description || null, isDefault || false)
    
    const roleId = result.id
    
    // 添加权限关联
    if (permissionIds && permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await db.prepare(`
          INSERT INTO portal_role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `).run(roleId, permId)
      }
    }
    
    res.json({
      errCode: 200,
      msg: '角色创建成功',
      data: { id: roleId, name: name.trim() }
    })
    
  } catch (error) {
    console.error('创建角色失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建角色失败: ' + error.message,
      data: null
    })
  }
})

/**
 * 更新角色
 * PUT /api/roles/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    const { name, description, permissionIds, isDefault, status } = req.body
    
    // 检查角色是否存在
    const existingRole = await db.prepare(`
      SELECT id, is_system FROM portal_roles 
      WHERE id = $1 AND customer_id = $2 AND status != $3
    `).get(id, customerId, 'deleted')
    
    if (!existingRole) {
      return res.status(404).json({
        errCode: 404,
        msg: '角色不存在',
        data: null
      })
    }
    
    // 系统角色只能修改权限，不能修改名称
    if (existingRole.is_system && name) {
      return res.status(400).json({
        errCode: 400,
        msg: '系统角色不能修改名称',
        data: null
      })
    }
    
    // 检查角色名是否重复
    if (name) {
      const duplicateName = await db.prepare(`
        SELECT id FROM portal_roles 
        WHERE customer_id = $1 AND name = $2 AND id != $3 AND status != $4
      `).get(customerId, name.trim(), id, 'deleted')
      
      if (duplicateName) {
        return res.status(400).json({
          errCode: 400,
          msg: '该角色名称已存在',
          data: null
        })
      }
    }
    
    // 如果设置为默认角色，先取消其他默认角色
    if (isDefault) {
      await db.prepare(`
        UPDATE portal_roles 
        SET is_default = false
        WHERE customer_id = $1 AND is_default = true AND id != $2
      `).run(customerId, id)
    }
    
    // 更新角色基本信息
    await db.prepare(`
      UPDATE portal_roles 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_default = COALESCE($3, is_default),
        status = COALESCE($4, status)
      WHERE id = $5 AND customer_id = $6
    `).run(
      name ? name.trim() : null,
      description !== undefined ? description : null,
      isDefault !== undefined ? isDefault : null,
      status || null,
      id,
      customerId
    )
    
    // 更新权限关联（如果提供了）
    if (permissionIds !== undefined) {
      // 删除现有权限关联
      await db.prepare(`
        DELETE FROM portal_role_permissions WHERE role_id = $1
      `).run(id)
      
      // 添加新的权限关联
      if (permissionIds && permissionIds.length > 0) {
        for (const permId of permissionIds) {
          await db.prepare(`
            INSERT INTO portal_role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `).run(id, permId)
        }
      }
    }
    
    res.json({
      errCode: 200,
      msg: '角色更新成功',
      data: null
    })
    
  } catch (error) {
    console.error('更新角色失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新角色失败',
      data: null
    })
  }
})

/**
 * 删除角色
 * DELETE /api/roles/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    
    // 检查角色是否存在
    const role = await db.prepare(`
      SELECT id, is_system, name FROM portal_roles 
      WHERE id = $1 AND customer_id = $2 AND status != $3
    `).get(id, customerId, 'deleted')
    
    if (!role) {
      return res.status(404).json({
        errCode: 404,
        msg: '角色不存在',
        data: null
      })
    }
    
    // 系统角色不能删除
    if (role.is_system) {
      return res.status(400).json({
        errCode: 400,
        msg: '系统角色不能删除',
        data: null
      })
    }
    
    // 检查是否有用户在使用该角色
    const userCount = await db.prepare(`
      SELECT COUNT(*) as count FROM portal_users 
      WHERE role_id = $1 AND status != $2
    `).get(id, 'deleted')
    
    if (userCount && userCount.count > 0) {
      return res.status(400).json({
        errCode: 400,
        msg: `该角色正被 ${userCount.count} 个用户使用，无法删除`,
        data: null
      })
    }
    
    // 软删除角色
    await db.prepare(`
      UPDATE portal_roles 
      SET status = $1
      WHERE id = $2 AND customer_id = $3
    `).run('deleted', id, customerId)
    
    // 删除权限关联
    await db.prepare(`
      DELETE FROM portal_role_permissions WHERE role_id = $1
    `).run(id)
    
    res.json({
      errCode: 200,
      msg: '角色已删除',
      data: null
    })
    
  } catch (error) {
    console.error('删除角色失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除角色失败',
      data: null
    })
  }
})

/**
 * 初始化客户的默认角色
 * 当客户第一次访问用户管理时自动创建
 * POST /api/roles/init-default
 */
router.post('/init-default', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 检查是否已有角色
    const existingRoles = await db.prepare(`
      SELECT COUNT(*) as count FROM portal_roles 
      WHERE customer_id = $1 AND status != $2
    `).get(customerId, 'deleted')
    
    if (existingRoles && existingRoles.count > 0) {
      return res.json({
        errCode: 200,
        msg: '已存在角色',
        data: { initialized: false }
      })
    }
    
    // 获取所有权限
    const allPermissions = await db.prepare(`
      SELECT id, code FROM portal_permissions ORDER BY sort_order ASC
    `).all()
    
    // 创建管理员角色（拥有所有权限）
    const adminResult = await db.prepare(`
      INSERT INTO portal_roles (customer_id, name, description, is_system, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `).get(customerId, '管理员', '拥有所有权限，可管理用户和角色', true, false)
    
    // 给管理员角色添加所有权限
    for (const perm of allPermissions) {
      await db.prepare(`
        INSERT INTO portal_role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `).run(adminResult.id, perm.id)
    }
    
    // 创建普通员工角色（基本查看权限）
    const basicPermissions = allPermissions.filter(p => 
      p.code.includes(':view') && 
      !p.code.includes('users:') && 
      !p.code.includes('roles:')
    )
    
    const staffResult = await db.prepare(`
      INSERT INTO portal_roles (customer_id, name, description, is_system, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `).get(customerId, '普通员工', '基本查看权限，可查看订单和账单', true, true)
    
    // 给员工角色添加基本权限
    for (const perm of basicPermissions) {
      await db.prepare(`
        INSERT INTO portal_role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `).run(staffResult.id, perm.id)
    }
    
    res.json({
      errCode: 200,
      msg: '默认角色已创建',
      data: {
        initialized: true,
        roles: [
          { id: adminResult.id, name: '管理员' },
          { id: staffResult.id, name: '普通员工' }
        ]
      }
    })
    
  } catch (error) {
    console.error('初始化默认角色失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '初始化失败: ' + error.message,
      data: null
    })
  }
})

export default router

