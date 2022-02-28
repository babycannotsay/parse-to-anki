import path from 'path'
import { Buffer } from 'buffer'
import { Media } from 'anki-apkg-generator'
import fetch from 'cross-fetch'

const getExtensionFromUrl = (url: string) => {
    const extension = url
        .split(/[#?]/)[0]
        .split('.')
        .pop()!
        .trim()

    return `.${extension}`
}

const checkIfFile = (url: string) => {
    return new URL(url).pathname.split('/').pop()!.indexOf('.') > 0
}

async function replaceAsync (filename: string, str: string, regex: RegExp, asyncFn: (...args: string[]) => Promise<string>) {
    const tasks: Promise<string>[] = []

    // fill replacers with fake call
    str.replace(regex, (match: string, ...args: string[]) => {
        const promise = asyncFn(filename, match, ...args)
        tasks.push(promise)
        return match
    })

    const data = await Promise.all(tasks)

    return str.replace(regex, () => data.shift()!)
}

export default class MediaProcessor {
    public mediaList: Media[] = []
    public sourceRegexp: RegExp
    public mediaMap: { [key: string]: string } = {}
    constructor () {
        //                                  p1            p2          p3
        this.sourceRegexp = /(?:url\(&quot;(.*?)&quot;\)|(src|href)="([^"]*?)")/g
    }
    parse (filename: string, side: string, mediaMap: { [key: string]: string }) {
        this.mediaMap = mediaMap
        return replaceAsync(filename, side, this.sourceRegexp, this.replacer.bind(this))
    }

    private _getMatchPath (fromUrl: boolean, name: string, p: string) {
        if (fromUrl) {
            return `url(&quot;${name}&quot;)`
        }

        return `${p}="${name}"`
    }

    async replacer (filename: string, match: string, p1: string, p2: string, p3: string) {
        const fromUrl = match.startsWith('url')
        const p = fromUrl ? p1 : p3
        if (p.startsWith('http')) {
            if (!checkIfFile(p)) {
                return match
            }
            const fileExt = getExtensionFromUrl(p)
            const data = await fetch(p).then(resp => resp.arrayBuffer())
            const media = new Media(data)
            // 资源不显示，优先考虑是否是因为没有加_
            media.setFilename(`_${media.checksum}${fileExt}`)
            this.addMedia(media)
            return this._getMatchPath(fromUrl, media.filename, p2)
        } else if (p.startsWith('data:')) {
            return match
        }
        // 相对路径
        const decodeName = decodeURI(decodeURI(p))
        const name = this.mediaMap[path.join(path.dirname(filename), decodeName)]
        return this._getMatchPath(fromUrl, name, p2)
    }
    addMedia (media: Media) {
        const hasMedia = this.mediaList.some((item) =>
            Buffer.from(item.data, 0).equals(Buffer.from(media.data, 0))
        )
        if (hasMedia) { return }

        this.mediaList.push(media)
    }
}

