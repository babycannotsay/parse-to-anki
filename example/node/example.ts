import fs from 'fs'
import Parser from '../../src/parser'
import WolaiParser from './wolai-parser'
async function execute () {
    const parser = new Parser(new WolaiParser)
    console.log('input is from ./example/input/test.zip')
    const file: any = await parser.parseZip('hh', fs.readFileSync('./example/input/test.zip'))
    fs.writeFileSync('./example/output/test.apkg', file, 'binary')
    console.log('success to output ./example/output/test.apkg')
}
execute()
