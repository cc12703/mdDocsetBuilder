# mdDocsetBuilder
markdown文件树生成docset



## 流程

1. 搜索指定目录下的所有markdown文件
2. 每个makrdown文件，生成了两个html（正常文件和思维导图文件）
3. 输出文件增加目录名为前缀
4. 生成docset


### docset生成步骤

1. 创建docset目录 <docset name>.docset/Contents/Resources/Documents
2. 拷贝输出的html文件到该目录
3. 创建info.plist文件，在目录<docset name>.docset/Contents/下
4. 创建SQLite索引文件 <docset name>.docset/Contents/Resources/docSet.dsidx
5. 创建searchIndex表，并写入索引内容


## 调试

### 命令行调用

npm run debug -- input-path -n name -o output-path

## 依赖

### mume

* markdown渲染引擎
* [github地址](https://github.com/shd101wyy/mume)

### markmap-lib

* markdown转思维导图
* [github地址](https://github.com/gera2ld/markmap/tree/master/packages/markmap-lib)

### commander

* 命令行库
* [github文档](https://github.com/tj/commander.js/blob/HEAD/Readme_zh-CN.md)



## 参考资料

* [docset生成](https://kapeli.com/docsets#dashDocset)