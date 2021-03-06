import fs from 'fs'
import { Parser } from '../../src'
import WolaiParser from './wolai-parser'
async function execute () {
    const parser = new Parser(new WolaiParser, 'zipName')
    console.log('input is from ./example/input/test.zip')
    const file: any = await parser.parseZip(fs.readFileSync('./example/input/test.zip'))
    fs.writeFileSync('./example/output/test.apkg', file, 'binary')
    console.log('success to output ./example/output/test.apkg')
}
execute()
