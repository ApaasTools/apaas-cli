/**
 * 批量删除 node_modules 和 .turbo 目录
 *
 * 使用方法：
 * pnpm clean:deps
 * 或
 * node scripts/uclean-deps 
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 递归查找所有 node_modules 目录
function findAllNodeModules(dir, nodeModulesPaths = []) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
      const fullPath = path.join(dir, item.name)

      if (item.isDirectory()) {
        if (item.name === 'node_modules') {
          nodeModulesPaths.push(fullPath)
        } else if (item.name !== '.git' && !item.name.startsWith('.')) {
          // 递归搜索子目录，但跳过 .git 和其他隐藏目录
          findAllNodeModules(fullPath, nodeModulesPaths)
        }
      }
    }
  } catch (error) {
    // 忽略无法访问的目录
    console.warn(`无法访问目录: ${dir}`)
  }

  return nodeModulesPaths
}

// 递归查找所有 .turbo 目录
function findAllTurboDirectories(dir, turboPaths = []) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
      const fullPath = path.join(dir, item.name)

      if (item.isDirectory()) {
        if (item.name === '.turbo') {
          turboPaths.push(fullPath)
        } else if (item.name !== '.git' && item.name !== 'node_modules') {
          // 递归搜索子目录，但跳过 .git 和 node_modules
          findAllTurboDirectories(fullPath, turboPaths)
        }
      }
    }
  } catch (error) {
    // 忽略无法访问的目录
    console.warn(`无法访问目录: ${dir}`)
  }

  return turboPaths
}

// 强制删除目录的函数
function forceRemoveDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return false

  const isRootNodeModules =
    path.basename(dirPath) === 'node_modules' && path.dirname(dirPath) === process.cwd()

  try {
    console.log(`正在删除: ${dirPath}${isRootNodeModules ? ' (根目录)' : ''}`)

    // Windows 系统使用多种方法尝试删除
    if (process.platform === 'win32') {
      // 对于根目录的 node_modules，使用更强力的删除方法
      if (isRootNodeModules) {
        try {
          // 先尝试解除只读属性
          execSync(`attrib -R "${dirPath}\\*.*" /S /D`, { stdio: 'pipe' })
        } catch (e) {
          // 忽略错误
        }

        try {
          // 使用 robocopy 清空目录然后删除
          const tempDir = path.join(process.cwd(), `temp_empty_${Date.now()}`)
          try {
            fs.mkdirSync(tempDir)
            execSync(`robocopy "${tempDir}" "${dirPath}" /mir /nfl /ndl /njh /njs /nc /ns /np`, {
              stdio: 'pipe',
            })
            // 确保清理临时目录
            if (fs.existsSync(tempDir)) {
              fs.rmdirSync(tempDir)
            }
            // 删除目标目录
            if (fs.existsSync(dirPath)) {
              fs.rmdirSync(dirPath)
            }
            console.log(`✅ 已删除: ${dirPath}`)
            return true
          } catch (innerError) {
            // 确保即使出错也要清理临时目录
            if (fs.existsSync(tempDir)) {
              try {
                fs.rmdirSync(tempDir)
              } catch (cleanupError) {
                console.warn(`警告: 无法清理临时目录 ${tempDir}`)
              }
            }
            throw innerError
          }
        } catch (robocopyError) {
          // robocopy 失败，继续尝试其他方法
        }
      }

      try {
        // 方法1: 使用 rmdir 命令
        execSync(`rmdir /s /q "${dirPath}"`, {
          stdio: 'pipe',
          timeout: 60000,
          encoding: 'utf8',
        })
      } catch (error1) {
        try {
          // 方法2: 使用 PowerShell 但忽略错误
          execSync(`Remove-Item -Recurse -Force "${dirPath}" -ErrorAction SilentlyContinue`, {
            stdio: 'pipe',
            shell: 'powershell',
            timeout: 60000,
          })
        } catch (error2) {
          // 方法3: 使用 Node.js 递归删除
          deleteRecursively(dirPath)
        }
      }
    } else {
      // Unix 系统使用 rm 命令
      execSync(`rm -rf "${dirPath}"`, { stdio: 'pipe', timeout: 60000 })
    }

    // 检查是否删除成功
    if (!fs.existsSync(dirPath)) {
      console.log(`✅ 已删除: ${dirPath}`)
      return true
    } else {
      // 对于根目录，尝试最后一次强制清理
      if (isRootNodeModules) {
        console.log(`🔄 尝试最后一次强制清理: ${dirPath}`)
        forceCleanRootNodeModules(dirPath)

        if (!fs.existsSync(dirPath)) {
          console.log(`✅ 强制清理成功: ${dirPath}`)
          return true
        }
      }

      console.log(`⚠️ 部分删除: ${dirPath} (可能有文件被占用)`)
      return true // 即使部分删除也算成功
    }
  } catch (error) {
    console.error(`❌ 删除失败: ${dirPath} - ${error.message}`)
    return false
  }
}

// 专门针对根目录 node_modules 的强制清理函数
function forceCleanRootNodeModules(dirPath) {
  try {
    // 递归删除所有内容，忽略所有错误
    const items = fs.readdirSync(dirPath)

    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      try {
        const stat = fs.lstatSync(itemPath)
        if (stat.isDirectory()) {
          // 递归删除子目录
          forceCleanRootNodeModules(itemPath)
          try {
            fs.rmdirSync(itemPath)
          } catch (e) {
            // 忽略错误
          }
        } else {
          // 删除文件
          try {
            // 先尝试解除只读属性
            fs.chmodSync(itemPath, 0o666)
          } catch (e) {
            // 忽略错误
          }
          try {
            fs.unlinkSync(itemPath)
          } catch (e) {
            // 忽略错误
          }
        }
      } catch (e) {
        // 忽略所有错误，继续处理下一个项目
      }
    }

    // 最后尝试删除目录本身
    try {
      fs.rmdirSync(dirPath)
    } catch (e) {
      // 忽略错误
    }
  } catch (error) {
    // 忽略所有错误
  }
}

// Node.js 递归删除函数（备用方案）
function deleteRecursively(dirPath) {
  if (!fs.existsSync(dirPath)) return

  const files = fs.readdirSync(dirPath)

  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stat = fs.lstatSync(filePath)

    if (stat.isDirectory()) {
      deleteRecursively(filePath)
    } else {
      try {
        fs.unlinkSync(filePath)
      } catch (error) {
        // 忽略无法删除的文件
      }
    }
  }

  try {
    fs.rmdirSync(dirPath)
  } catch (error) {
    // 忽略无法删除的目录
  }
}

// 删除锁文件
function removeLockFiles() {
  const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
  let removedCount = 0

  for (const lockFile of lockFiles) {
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile)
        console.log(`✅ 已删除锁文件: ${lockFile}`)
        removedCount++
      } catch (error) {
        console.error(`❌ 删除锁文件失败: ${lockFile} - ${error.message}`)
      }
    }
  }

  return removedCount
}

console.log('🧹 开始清理所有 node_modules 和 .turbo 目录...\n')

// 查找所有 node_modules 目录
const currentDir = process.cwd()
console.log(`搜索目录: ${currentDir}`)

const nodeModulesPaths = findAllNodeModules(currentDir)
const turboPaths = findAllTurboDirectories(currentDir)
let nodeModulesSuccessCount = 0
let turboSuccessCount = 0

// 处理 node_modules 目录
if (nodeModulesPaths.length === 0) {
  console.log('未找到任何 node_modules 目录')
} else {
  console.log(`\n找到 ${nodeModulesPaths.length} 个 node_modules 目录:`)
  nodeModulesPaths.forEach((p, index) => {
    console.log(`${index + 1}. ${p}`)
  })

  console.log('\n开始删除 node_modules...')

  for (const nodeModulesPath of nodeModulesPaths) {
    if (forceRemoveDirectory(nodeModulesPath)) {
      nodeModulesSuccessCount++
    }
  }

  console.log(
    `\n📊 node_modules 删除统计: ${nodeModulesSuccessCount}/${nodeModulesPaths.length} 个目录删除成功`
  )
}

// 处理 .turbo 目录
if (turboPaths.length === 0) {
  console.log('\n未找到任何 .turbo 目录')
} else {
  console.log(`\n找到 ${turboPaths.length} 个 .turbo 目录:`)
  turboPaths.forEach((p, index) => {
    console.log(`${index + 1}. ${p}`)
  })

  console.log('\n开始删除 .turbo...')

  for (const turboPath of turboPaths) {
    if (forceRemoveDirectory(turboPath)) {
      turboSuccessCount++
    }
  }

  console.log(
    `\n📊 .turbo 删除统计: ${turboSuccessCount}/${turboPaths.length} 个目录删除成功`
  )
}

// 删除锁文件
console.log('\n🔒 清理锁文件...')
const lockFilesRemoved = removeLockFiles()

console.log(`\n🎉 清理完成！`)
console.log(`   - 删除了 ${nodeModulesSuccessCount} 个 node_modules 目录`)
console.log(`   - 删除了 ${turboSuccessCount} 个 .turbo 目录`)
console.log(`   - 删除了 ${lockFilesRemoved} 个锁文件`)
console.log('\n💡 提示: 运行以下命令重新安装依赖:')
console.log('   pnpm install')