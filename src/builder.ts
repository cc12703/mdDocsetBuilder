
import * as path from 'path'
import { promises as fsP } from 'fs'

import walk from 'walk'
import * as mume from '@shd101wyy/mume'
import * as fse from 'fs-extra'
import * as markmap from 'markmap-lib'
import * as urlencode from 'urlencode'
import cheerio from 'cheerio'
import jade from 'jade'

import * as util from '@/util'


class BookInfo {
    classify: string = ''
    name: string = ''

    originFile: string = ''

    htmlFile: string = ''
    htmlUrlPath: string = ''

    mmHtmlFile: string = ''
    mmHtmlUrlPath: string = ''
}

class ClassifyInfo {
    name: string = ''

    books: BookInfo[] = []
}



class DocInfo {
    
    inputDir: string

    indexHtmlFile: string = ''

    books: BookInfo[] = []

    constructor(inputDir: string) {
        this.inputDir = inputDir
    }

}




async function mdFileToHtml(inFile: string, outFile: string) {
    const baseName = path.basename(outFile, '.html')
    const tempFile = path.join('./temp/mume', `${baseName}.md`)
    const tempOutFile = tempFile.replace('.md', '.html')

    fse.copySync(inFile, tempFile)    

    const engine = new mume.MarkdownEngine({
        filePath: tempFile,
        projectDirectoryPath: ''
    })
    await engine.htmlExport({ offline: true, runAllCodeChunks: true})


    const htmlData = await fsP.readFile(tempOutFile)
    const htmlRoot = cheerio.load(htmlData)

    htmlRoot('span[class=katex-html]').remove()

    await fsP.writeFile(outFile, htmlRoot.html())
}


function buildHtmlFiles(info: DocInfo, output: string) {
    info.books.forEach(book => {
        const baseName = path.basename(book.originFile, '.md')
        const fileName = `${book.classify}_${baseName}.html`
        book.htmlFile = path.join(output, fileName)
        book.htmlUrlPath = urlencode.encode(fileName)

        mdFileToHtml(book.originFile, book.htmlFile)
    })
}


async function mdFileToMMHtml(inFile: string, outFile: string) {
    const content = await fsP.readFile(inFile, 'utf8')
    const { root, features } = markmap.transform(content)
    const assets = markmap.getUsedAssets(features)
    const html = markmap.fillTemplate(root, assets)
    await fsP.writeFile(outFile, html, 'utf8')
}

function buildMMHtmlFiles(info: DocInfo, output: string) {
    info.books.forEach(book => {
        const baseName = path.basename(book.originFile, '.md')
        const fileName = `${book.classify}_${baseName}_mm.html`
        book.mmHtmlFile = path.join(output, fileName)
        book.mmHtmlUrlPath = urlencode.encode(fileName)

        mdFileToMMHtml(book.originFile, book.mmHtmlFile)
    })
}


function collectClassifyFromDoc(info: DocInfo): ClassifyInfo[] {
    const cMapInfo = info.books.reduce((mapInfo, book) => {
        let cInfo = mapInfo.get(book.classify)
        if(cInfo == null) {
            cInfo = new ClassifyInfo()
            cInfo.name = book.classify
            mapInfo.set(book.classify, cInfo)
        }
        cInfo.books.push(book)
        return mapInfo
    }, new Map<string, ClassifyInfo>())

    return Array.from(cMapInfo.keys())
                .map(name => cMapInfo.get(name)!)
}

function pathToClassify(filePath: string, root: string): string {
    let relaPath = filePath.replace(root, '')
    if(relaPath.startsWith(path.sep)) {
        relaPath = relaPath.substr(1)
    }

    return relaPath.replace(path.sep, '_')
}

function collectAllDocs(input: string): Promise<DocInfo> {
    return new Promise((resolve, reject) => {
        const info = new DocInfo(input)
        const walker = walk.walk(input, {filters:['.DS_Store', '.git']})
        walker.on('file', (dir, stats, next)=> {
            if(!stats.name.endsWith('.md')) {
                next()
                return
            }
            
            let book = new BookInfo()
            book.classify = pathToClassify(dir, input)
            book.name = path.basename(stats.name, '.md')
            book.originFile = path.join(dir, stats.name)
            info.books.push(book)

            next()
        })
        walker.on('end', () => {
            resolve(info)
        })
    })
}


async function buildInfoFile(output: string, name: string) {
    const templ = await fsP.readFile('./templates/Info.plist', 'utf8')

    const outContent = templ.replace(/__NAME__/g, name)
    const outFile = path.join(output, 'Info.plist')

    await fsP.writeFile(outFile, outContent, 'utf8')
}






async function jadeToHtml(inFile: string, outFile: string, templData: Object) {
    const renderFn = jade.compileFile(inFile, {pretty: true, doctype: 'xml'})
    await fsP.writeFile(outFile, renderFn(templData), 'utf8')
}


function buildIndexHtml(info: DocInfo, output: string) {
    info.indexHtmlFile = path.join(output, 'index.html')

    const classifyInfo = collectClassifyFromDoc(info)
    const templData = {'classifys': classifyInfo}
    jadeToHtml('./templates/index.jade', info.indexHtmlFile, templData)
}


async function buildIndexDB(output: string, info: DocInfo, docOutput: string) {
    const dbFile = path.join(output, 'docSet.dsidx')

    const db = await util.openDatabase(dbFile)

    await util.runSqlInDatabase(db, 'CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);')

    let sql = ''

    const indexHtmlUrlPath = urlencode.encode(info.indexHtmlFile.replace(docOutput, ''))
    sql += `INSERT INTO searchIndex(name, type, path) VALUES ('索引页', 'Guide', '${indexHtmlUrlPath}');`

    info.books.forEach(book => {
        const guideName = `${book.classify}_${book.name}` 
        sql += `INSERT INTO searchIndex(name, type, path) VALUES ('${guideName}', 'Entry', '${book.htmlUrlPath}');`

        const mmGuideName = `${book.classify}_${book.name}_思维导图` 
        sql += `INSERT INTO searchIndex(name, type, path) VALUES ('${mmGuideName}', 'Entry', '${book.mmHtmlUrlPath}');`
    })
    
    await util.exceSqlInDatabase(db, sql)

    await util.closeDatabase(db)
}





export async function buildDocset(input: string, output: string, name: string) {

    const rootOutput = path.join(output, `${name}.docset`)
    fse.emptyDirSync(rootOutput)
    fse.emptyDirSync('./temp')


    const docInfo = await collectAllDocs(input)

    const contOutput = path.join(rootOutput, 'Contents')
    const resOutput = path.join(rootOutput, 'Contents/Resources')
    const docOutput = path.join(rootOutput, 'Contents/Resources/Documents')
    fse.ensureDirSync(docOutput)     
    
    buildHtmlFiles(docInfo, docOutput)
    buildMMHtmlFiles(docInfo, docOutput)
    buildIndexHtml(docInfo, docOutput)

    buildInfoFile(contOutput, name)
    buildIndexDB(resOutput, docInfo, docOutput)

}