# parse-to-anki
parse file and generate anki file

## Install
`yarn add parse-to-anki`
## Suppoort
- 解析打包html目录结构后的zip文件
- 可运行在node和浏览器上

## Usage
详见example

1. 运行`yarn example:node`执行node环境下的脚本

2. 运行`yarn example:browser`自动打开html文件上传example/input下的测试zip文件

注：解析加打包需要一定时间，请稍加等待

## TODO
- [] 解析单个html文件
- [] 解析单个markdown文件
- [] 解析打包markdown目录结构后的zip文件
- [] 解析csv及zip文件
- [] 结合chrome扩展，支持更新anki卡片
- [] 测试用例补充
- [] husky
- [] 完善中文文档
- [] 英文文档

## Example
- [node example](./example/node/example.ts)
- [browser example](./example/browser/example.ts)

## Changelog
## Thanks
部分代码参考[mdanki](https://github.com/ashlinchak/mdanki.git)

## Related

- [anki-apkg-generator](https://github.com/babycannotsay/anki-apkg-generator)

## LIcense

MIT

