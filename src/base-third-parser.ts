import { Media } from 'anki-apkg-generator'
export default class BaseThirdParser {
    name = ''

    /** parseZip */
    parseHTML (_: ArrayBuffer) {
        return {
            title: '',
            front: '',
            back: '',
            name: '',
            isEmpty: true,
        }
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
    addSourceMedia () { return '' }
    getMediaList (): Media[] {
        return []
    }
}
