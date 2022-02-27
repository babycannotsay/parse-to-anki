import Zip from 'jszip'
import { extname, basename, dirname, join } from 'path'
import { Deck, Note, Model, Field, Card, Package, Media, Template } from 'anki-apkg-generator'
import MediaProcessor from './media-processor'
import BaseThirdParser from './base-third-parser'

export { BaseThirdParser }

export default class Parser {
    public thirdParser: BaseThirdParser
    public templates: Template[]
    public fields: Field[]
    constructor (thirdParser: BaseThirdParser) {
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
    }

    parseZip (zipName: string, data: ArrayBuffer) {
        return Zip.loadAsync(data).then(async zip => {
            const { files } = zip
            const mediaProcessor = new MediaProcessor()
            const { templates, fields, thirdParser } = this
            const parseHTML = thirdParser.parseHTML.bind(thirdParser)
            const card = new Card()
            const model = new Model(card)
            model.setName(thirdParser.getName())
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
                        media.setFilename(`_${media.checksum}${fileExt}`)
                        mediaMap[file.name] = media.filename
                        mediaProcessor.addMedia(media)
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
                    .setId(Date.now())
                    .setName(title)

                const dir = dirname(filename)
                const rootDeck = basename(zipName, '.zip')
                const deckName = /^[./\\]$/.test(dir) ? rootDeck : `${rootDeck}/${dir}`
                if (!deckMap[deckName]) {
                    deckMap[deckName] = new Deck(deckName.replace(/\//g, '::'))
                }
                deckMap[deckName].addNote(note)
            }
            for (const { data, filename } of htmlQueue) {
                await _parseHTML(filename, data)
            }
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


