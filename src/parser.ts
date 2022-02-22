import Zip from 'jszip'
import { extname, basename, dirname } from 'path'
import { Deck, Note, Model, Field, Card, Package, Media, Template } from 'anki-apkg-generator'
import MediaProcessor from './media-processor'
import BaseThirdParser from './base-third-parser'

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
            const { templates, fields } = this
            const card = new Card()
            const model = new Model(card)
            model.setFields(fields)

            const deckMap: { [key: string]: Deck } = {}
            for (const file of Object.values(files)) {
                if (file.dir) {
                    continue
                }
                await file.async('arraybuffer').then(async data => {
                    if (extname(file.name) === '.html') {
                        const { isEmpty, front, back, title, name } = this.thirdParser.parseHTML(data)
                        if (isEmpty) return
                        const ankiFront = await mediaProcessor.parse(front)
                        const ankiBack = await mediaProcessor.parse(back)
                        model.setName(name)
                        const note = new Note(model)
                        note
                            .setFieldsValue([ ankiFront, ankiBack ])
                            .setId(Date.now())
                            .setName(title)

                        const dir = dirname(file.name)
                        const rootDeck = basename(zipName, '.zip')
                        const deckName = dir ? `${rootDeck}/${dirname(file.name)}` : rootDeck
                        if (!deckMap[deckName]) {
                            deckMap[deckName] = new Deck(deckName.replace(/\//g, '::'))
                        }
                        deckMap[deckName].addNote(note)
                    } else if (/(png|gif|webp|jpeg|jpg)/.test(extname(file.name))) {
                        mediaProcessor.addMedia(new Media(data, `_${basename(file.name)}`))
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


