#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const rimraf = require('rimraf')
const ora = require('ora')
const base_path = '/'

function safeReadDirSync(path) {
  let dirData = {}
  try {
    dirData = fs.readdirSync(path)
  } catch (ex) {
    if (ex.code == 'EACCES' || ex.code == 'EPERM') {
      //User does not have permissions, ignore directory
      return null
    } else throw ex
  }
  return dirData
}

const output = []

const walker = (p) => {
  let _path = base_path
  if (p) {
    _path = p
  }
  try {
    const data = safeReadDirSync(_path)
    data.forEach((fileName) => {
      const currentPath = path.join(_path, fileName)
      const stat = fs.lstatSync(currentPath)
      if (stat.isDirectory()) {
        if (currentPath.includes('node_modules')) {
          output.push({ path: currentPath, size: stat.size })
        } else {
          walker(currentPath)
        }
      }
    })
  } catch (err) {
    console.log(err)
  }
}

const removeNodeModule = (path, spinner) => {
  try {
    spinner.start(`正在删除${path}`)
    rimraf.sync(path)
    spinner.succeed(`删除${path} 成功！`)
  } catch (err) {
    spinner.fail(`删除${path} 失败`)
    spinner.fail(err)
  }
}

const removeNodeModules = (paths, spinner) => {
  paths.forEach((path) => removeNodeModule(path, spinner))
}

const selet = (data) => {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt([
        {
          type: 'checkbox',
          message: '请选择想要删除的node_modules',
          name: 'node_modules',
          choices: data.map((d) => ({ name: d.path, size: d.size })),
          validate(answer) {
            return true
          },
        },
      ])
      .then((answers) => {
        // console.log(JSON.stringify(answers.node_modules, null, '  '))
        resolve(answers.node_modules)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

//格式化文件大小
function renderSize(value) {
  if (null == value || value == '') {
    return '0 Bytes'
  }
  var unitArr = new Array('Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB')
  var index = 0
  var srcsize = parseFloat(value)
  index = Math.floor(Math.log(srcsize) / Math.log(1024))
  var size = srcsize / Math.pow(1024, index)
  size = size.toFixed(2) //保留的小数位数
  return size + unitArr[index]
}

const calcTotalSize = (seleted) => {
  const sizeArr = output
    .filter((o) => {
      return seleted.find((select) => select === o.path)
    })
    .map((o) => o.size)
  const totalSize = sizeArr.reduce((a, b) => a + b, 0)
  return renderSize(totalSize)
}

const getWorkingPath = () => {
  try {
    const userInputPath = process.argv[2]
    const stat = fs.lstatSync(userInputPath)
    if (stat.isDirectory()) {
      return userInputPath
    }
  } catch (err) {
    return process.cwd()
  }
}

const run = async () => {
  const workingPath = getWorkingPath()
  const spinner = ora('开始检查文件夹').start()
  try {
    walker(workingPath)
    spinner.info('文件夹检查完成')
    const result = await selet(output)
    if (result.length > 0) {
      spinner.start('开始删除选择的node_modules...')
      removeNodeModules(result, spinner)
      spinner.succeed('执行成功～')
      spinner.info(`共释放${calcTotalSize(result)} 的硬盘空间`)
    } else {
      spinner.info('没有选择要删除的node_modules')
      spinner.info('执行结束～')
    }
  } catch (err) {
    spinner.fail('执行失败')
    console.log(err)
  }
}

run()
