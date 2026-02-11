<!--
 * @Author: Devin Shi
 * @Email: yutian.shi@definesys.com
 * @Date: 2018-11-24 01:49:46
 * @LastEditTime: 2019-11-05 22:07:27
 * @LastEditors: Devin Shi
 * @Description: 
 -->
## 关于x-apaas-cli
一个快速构建apaas插件的脚手架工具

## 切换得帆私有源
```
npm config set registry http://dcloud.npm.shiyutian.com:7002/
```
> 建议使用 [nrm](https://www.npmjs.com/package/nrm) 切换源 

## 快速使用

### 安装
```shell
npm install -g @x-apaas/x-apaas-cli
```

### 初始化自开发模块
```shell
x-apaas-cli init <模块名称>
```

## 基础服务提供

### 基础组件库 
> 组件库中的组件无需再次引入
* [@x-ui/x-dcloud-ui](http://dcloud.npm.shiyutian.com:7002/package/@x-ui/x-dcloud-ui)
* `xx-element-ui`

### 基础插件&使用方式
* 网络请求
```javascript
this.$request({url, method, params, headers})
Vue.request
```

* 日期 - 参考dayjs
```javascript
this.$dayjs
Vue.dayjs
```

* 工具包 - 参考lodash
```javascript
this.$lodash
Vue.lodash
```

### store状态
* authModule 权限信息
* tenantModule 租户信息
* appModule 应用信息

## 模块文件
> 1. 自开发模块需要全部写在`custom`目录
> 2. 模块必须以`apaas-custom-`开头
> 3. 模块文件夹必须暴露`apaas.json`和一个vue插件的`js`, 参考`index.js`

### apaas.json介绍
```json
{
  "entry": "index.js", //此处为打包的入口文件
  "copyAssets": ["public/custom/apaas-custom-<xxx>"], // 引用的静态资源目录
  "router": {
    "apaas-custom-<xxx>": {        // 配置的路由, 可以配置多个，必须以apaas-custom-开头
      "name": "apaas-custom-<xxx>", // 路由的名字，和上面一致即可
      "path": "apaas-custom-<xxx>", // 路由的路径，和上面一致即可
      "meta": {                     
        "title": "自开发-<xxx>"  // 本地调试的时候显示在左侧的菜单名字，无其他特殊含义，可以更改
      }
    },
    "apaas-custom-<yyy>": {        // 配置的路由, 可以配置多个，必须以apaas-custom-开头
      "name": "apaas-custom-<yyy>", // 路由的名字，和上面一致即可
      "path": "apaas-custom-<yyy>", // 路由的路径，和上面一致即可
      "meta": {                     
        "title": "自开发-<yyy>"  // 本地调试的时候显示在左侧的菜单名字，无其他特殊含义，可以更改
      }
    }
  },
  "outputName": "apaas-custom-<xxx>" // 打包出来的模块名称, 必须以apaas-custom-开头
}
```

### entry介绍 <index.js>
> 标准Vue插件, 可以编写服务Vue插件的任意代码

```javascript
import ApaasCustomXXX from './page.vue'
import ApaasCustomXXX from './page1.vue'

const install = function(Vue, opts) {
  // 安装组件, 此处的和apaas.json定义的路由，必须一致
  Vue.component('apaas-custom-xxx', ApaasCustomXXX)
  Vue.component('apaas-custom-yyy', ApaasCustomYYY)
}

const XXXCustomPlugin = {
  install: install
}

export default XXXCustomPlugin

```

## 运行&打包

### 运行
```shell
npm run serve
```

### 打包
```shell
x-apaas-cli build <apaas-custom-模块名称>
```
