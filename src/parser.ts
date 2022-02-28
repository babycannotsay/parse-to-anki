import Zip from 'jszip'
import EventEmitter from 'events'
import { extname, basename, dirname } from 'path'
import { Deck, Note, Model, Field, Card, Package, Media, Template } from 'anki-apkg-generator'
import MediaProcessor from './media-processor'
import BaseThirdParser, { IdMaps } from './base-third-parser'

export { BaseThirdParser }


export default class Parser extends EventEmitter {
    public thirdParser: BaseThirdParser
    public templates: Template[]
    public fields: Field[]
    public idMaps: IdMaps
    constructor (thirdParser: BaseThirdParser) {
        super()
        this.thirdParser = thirdParser
        this.templates = [
            {
                name: 'Card 1',
                qfmt: '{{Question}}',
                afmt: '{{FrontSide}}{{Answer}}',
            },
        ]
        this.fields = [
            { name: 'Question' },
            { name: 'Answer' },
        ].map((f, index) => new Field(f.name).setOrd(index))
        this.idMaps = thirdParser.getIdMaps()
    }

    private getId (idMap: IdMaps[keyof IdMaps], name: string) {
        if (idMap[name]) {
            return idMap[name]
        }
        const ids: number[] = Object.values(idMap)
        let id = Date.now()
        while (ids.includes(id)) {
            id = Date.now()
        }
        idMap[name] = id
        return id
    }

    // 解析->转换->下载
    parseZip (zipName: string, data: ArrayBuffer) {
        this.emit('parseZip', 'Parsing zip file...')
        return Zip.loadAsync(data).then(async zip => {
            this.emit('parseZip', 'Zip file parsing is completed and start parsing files in zip file...')
            const { files } = zip
            const mediaProcessor = new MediaProcessor()
            const { templates, fields, thirdParser, idMaps, getId } = this
            const { modelIdMap, deckIdMap, noteIdMap } = idMaps
            const parseHTML = thirdParser.parseHTML.bind(thirdParser)
            const card = new Card()
            const model = new Model(card)
            const modelName = thirdParser.getName()
            model.setName(modelName)

            model.setId(getId(modelIdMap, modelName))
            model.setFields(fields)

            const mediaMap: { [key: string]: string } = {}

            const deckMap: { [key: string]: Deck } = {}
            const htmlQueue: { filename: string, data: ArrayBuffer }[] = []
            for (const file of Object.values(files)) {
                if (file.dir) {
                    continue
                }
                await file.async('arraybuffer').then(async data => {
                    if (extname(file.name) === '.html') {
                        htmlQueue.push({
                            filename: file.name,
                            data,
                        })
                    } else if (/(png|gif|webp|jpeg|jpg)/.test(extname(file.name))) {
                        const media = new Media(data)
                        const fileExt = extname(file.name)
                        console.time(file.name)
                        media.setFilename(`_${media.checksum}${fileExt}`)
                        mediaMap[file.name] = media.filename
                        mediaProcessor.addMedia(media)
                        console.timeEnd(file.name)
                    } else {
                        const name = `_${basename(file.name)}`
                        if (extname(file.name) === '.css') {
                            templates[0].qfmt = `
                                    <link rel="stylesheet", href="${name}"></link>
                                    ${templates[0].qfmt}
                                `
                        }
                        mediaProcessor.addMedia(new Media(data, name))
                    }
                })
            }
            async function _parseHTML (filename: string, data: ArrayBuffer) {
                const { isEmpty, front, back, title } = parseHTML(data)
                if (isEmpty) return
                const ankiFront = await mediaProcessor.parse(filename, front, mediaMap)
                const ankiBack = await mediaProcessor.parse(filename, back, mediaMap)
                const note = new Note(model)
                note
                    .setFieldsValue([ ankiFront, ankiBack ])
                    .setId(getId(noteIdMap, title))
                    .setName(title)

                const dir = dirname(filename)
                const rootDeck = basename(zipName, '.zip')
                const deckName = /^[./\\]$/.test(dir) ? rootDeck : `${rootDeck}/${dir}`
                if (!deckMap[deckName]) {
                    const deck = new Deck(deckName.replace(/\//g, '::'))
                    deck.setId(getId(deckIdMap, deckName))
                    deckMap[deckName] = deck
                }
                deckMap[deckName].addNote(note)
            }
            for (const { data, filename } of htmlQueue) {
                await _parseHTML(filename, data)
                this.emit('parseHTML', filename)
            }
            thirdParser.setIdMaps(this.idMaps)
            this.emit('compress')
            card.setTemplates(templates)
            const pkg = new Package(Object.values(deckMap), mediaProcessor.mediaList)
            return pkg.writeToFile()
        })
    }

    async parseJSON () {
        const { templates, fields, thirdParser } = this
        const { name } = thirdParser
        const template = thirdParser.addSourceMedia()
        const notes = await thirdParser.getNotes()
        const card = new Card()
        const model = new Model(card)
        model.setFields(fields)
        model.setName(name)
        const deck = new Deck(name)
        for (const { tags = [], ankiFront, ankiBack, title } of notes) {
            const note = new Note(model)
            note
                .setFieldsValue([ ankiFront, ankiBack ])
                .setId(Number(title))
                .setName(title)
                .setTags(tags)

            deck.addNote(note)
        }
        templates[0].qfmt = `
            ${template}
            ${templates[0].qfmt}
        `
        card.setTemplates(templates)
        const mediaList = thirdParser.getMediaList()
        const pkg = new Package(deck, mediaList)
        return pkg.writeToFile()
    }
}


