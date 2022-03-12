import { Media } from 'anki-apkg-generator'


export interface IdMap {
    [key: string]: number
}

export interface IdMaps {
    modelIdMap: IdMap, deckIdMap: IdMap, noteIdMap: IdMap
}
export default class BaseThirdParser {
    name = ''

    /** parseZip */
    parseHTML (_: ArrayBuffer) {
        return {
            title: '',
            front: '',
            back: '',
            isEmpty: true,
        }
    }

    getIdMaps () {
        return {
            modelIdMap: {},
            noteIdMap: {},
            deckIdMap: {},
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setIdMaps (_: IdMaps) {}
    getName () {
        return this.name
    }

    /** parseJSON */
    async getNotes (): Promise<{
        tags: string[]
        ankiFront: string
        ankiBack: string
        title: string
    }[]> {
        return []
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addSourceMedia () {}
    getMediaList (): Media[] {
        return []
    }
    getTemplates (): string[] { return [] }
}
