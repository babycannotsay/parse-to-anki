import cheerio from 'cheerio'
export default class WolaiParser {
    name = 'wolai'

    parseHTML (data: ArrayBuffer) {
        const dec = new TextDecoder('utf-8')
        const $ = cheerio.load(dec.decode(data))
        const hasImage = $('header > .image').hasClass('has')
        const hasIcon = $('header .title .banner .icon').data('symbol')
        // 无题头图和icon时删除image元素，去除头部空白
        if (!hasImage && !hasIcon) {
            $('header > .image').remove()
        }
        // 覆盖wolai左右padding，否则ankiandroid上可展示区域很小
        $('header > .title').css('padding', '0px')
        $('article').css('padding', '0px')
        // 删除子页面
        $('.wolai-sub-page.wolai-block').remove()
        // 折叠面板在anki客户端和安卓版会有2个箭头，因为无法去除自带的箭头，所以去掉图片的箭头
        $('summary .marker').remove()
        $('details > summary').css('padding-left', '0px')

        const isEmpty = $('article').text() === ''
        const back = $.html($('article'))
        const front = $.html($('header'))
        const title = $('.main-title').data('title') as string
        return {
            name: this.name,
            title,
            front,
            back,
            isEmpty,
        }
    }
}
