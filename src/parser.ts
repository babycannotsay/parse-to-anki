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
    public deckMap: { [key: string]: Deck } = {}
    public mediaMap: { [key: string]: string } = {}
    public mediaProcessor: MediaProcessor = new MediaProcessor()
    public zipName: string
    public model!: Model
    constructor (thirdParser: BaseThirdParser, zipName: string) {
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
        this.zipName = zipName
    }

    private _getId (idMap: IdMaps[keyof IdMaps], name: string) {
        if (idMap[name]) {
            return idMap[name]
        }
        const ids: number[] = Object.values(idMap)
        let id = Date.now()
        while (ids.includes(id)) {
            id = Date.now()
        }
        return id
    }

    private _setId (id: number, name: string, idMap: IdMaps[keyof IdMaps]) {
        idMap[name] = id
    }

    private _setModel (card: Card) {
        const { modelIdMap } = this.idMaps
        this.model = new Model(card)
        const modelName = this.thirdParser.getName()
        this.model.setName(modelName)
        const modelId = this._getId(modelIdMap, modelName)
        this._setId(modelId, modelName, modelIdMap)
        this.model.setId(modelId)
        this.model.setFields(this.fields)
    }

    private _setNote ({ ankiFront, ankiBack, title, tags = [] }: { ankiFront: string, ankiBack: string, title: string, tags?: string[] }) {
        const { noteIdMap } = this.idMaps
        const note = new Note(this.model)
        const noteId = this._getId(noteIdMap, title)
        this._setId(noteId, title, noteIdMap)
        note
            .setFieldsValue([ ankiFront, ankiBack ])
            .setId(noteId)
            .setName(title)
            .setTags(tags)
        return note
    }

    private _setDeck (note: Note, filename: string) {
        const { deckIdMap } = this.idMaps
        const dir = dirname(filename)
        const rootDeck = basename(this.zipName, '.zip')
        const deckName = /^[./\\]$/.test(dir) ? rootDeck : `${rootDeck}/${dir}`
        if (!this.deckMap[deckName]) {
            const deck = new Deck(deckName.replace(/\//g, '::'))
            const deckId = this._getId(deckIdMap, deckName)
            this._setId(deckId, deckName, deckIdMap)
            deck.setId(deckId)
            this.deckMap[deckName] = deck
        }
        this.deckMap[deckName].addNote(note)
    }

    private _setTemplate (templates: string[]) {
        this.templates[0].qfmt = `
            ${templates.join('')}
            ${this.templates[0].qfmt}
        `
    }

    async _parseHTML (filename: string, data: ArrayBuffer) {
        const { isEmpty, front, back, title } = this.thirdParser.parseHTML(data)
        if (isEmpty) return
        const ankiFront = await this.mediaProcessor.parse(filename, front, this.mediaMap)
        const ankiBack = await this.mediaProcessor.parse(filename, back, this.mediaMap)
        const note = this._setNote({ ankiFront, ankiBack, title })
        this._setDeck(note, filename)
    }

    // 解析->转换->下载
    parseZip (data: ArrayBuffer) {
        this.emit('parseZip', 'Parsing zip file...')
        return Zip.loadAsync(data).then(async zip => {
            this.emit('parseZip', 'Zip file parsing is completed and start parsing files in zip file...')
            const { files } = zip
            const { templates, thirdParser } = this
            const card = new Card()
            this._setModel(card)

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
                        this.mediaMap[file.name] = media.filename
                        this.mediaProcessor.addMedia(media)
                    } else {
                        const name = `_${basename(file.name)}`
                        if (extname(file.name) === '.css') {
                            this._setTemplate([
                                `<link rel="stylesheet", href="${name}"></link>`
                            ])
                        }
                        this.mediaProcessor.addMedia(new Media(data, name))
                    }
                })
            }
            for (const { data, filename } of htmlQueue) {
                await this._parseHTML(filename, data)
                this.emit('parseHTML', filename)
            }
            thirdParser.setIdMaps(this.idMaps)
            this.emit('compress')
            card.setTemplates(templates)
            const pkg = new Package(Object.values(this.deckMap), this.mediaProcessor.mediaList)
            return pkg.writeToFile()
        })
    }

    async parseJSON () {
        const { thirdParser } = this
        const { name } = thirdParser
        thirdParser.addSourceMedia()
        const newTemplates = thirdParser.getTemplates()
        const notes = await thirdParser.getNotes()
        const card = new Card()
        this._setModel(card)
        const deck = new Deck(name)
        for (const { tags = [], ankiFront, ankiBack, title } of notes) {
            const note = this._setNote({
                ankiFront,
                ankiBack,
                title,
                tags
            })
            deck.addNote(note)
        }
        this._setTemplate(newTemplates)
        card.setTemplates(this.templates)
        const mediaList = thirdParser.getMediaList()
        const pkg = new Package(deck, mediaList)
        return pkg.writeToFile()
    }
}


