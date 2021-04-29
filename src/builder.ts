
import * as path from 'path'
import { promises as fsP } from 'fs'

import walk from 'walk'
import * as mume from '@shd101wyy/mume'
import * as fse from 'fs-extra'
import * as markmap from '@cc12703m/markmap-lib'
import * as urlencode from 'urlencode'
import jade from 'jade'
import * as tar from 'tar'

import * as util from '@/util'
import { getCurRunPath } from '@/util'


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

    console.log(`md to html ${inFile}`)
    fse.copySync(inFile, tempFile)    

    const engine = new mume.MarkdownEngine({
        filePath: tempFile,
        projectDirectoryPath: '',
        config: {
            mathRenderingOption: 'MathJax'
        }
    })
    await engine.htmlExport({ offline: false, runAllCodeChunks: true})
    await fsP.copyFile(tempOutFile, outFile)
}


async function buildHtmlFiles(info: DocInfo, output: string) {
    console.log('do buildHtmlFile')

    for (var index in info.books) {
        var book = info.books[index]
        const baseName = path.basename(book.originFile, '.md')
        const fileName = `${book.classify}_${baseName}.html`
        book.htmlFile = path.join(output, fileName)
        book.htmlUrlPath = urlencode.encode(fileName)

        await mdFileToHtml(book.originFile, book.htmlFile)
    }
}


const MM_TBAR_VERSION = '0.1.4'
const MM_TBAR_URL_CSS = `https://cdn.jsdelivr.net/npm/@cc12703m/markmap-toolbar@${MM_TBAR_VERSION}/dist/style.min.css`
const MM_TBAR_URL_JS = `https://cdn.jsdelivr.net/npm/@cc12703m/markmap-toolbar@${MM_TBAR_VERSION}`

const renderToolbar = new Function(`\
    const toolbar = new markmap.Toolbar();
    toolbar.attach(mm);
    const el = toolbar.render();
    el.setAttribute('style', 'position:absolute;bottom:20px;right:20px');
    document.body.append(el); \
`)


function addToolBarToAssets(assets: any) : any {
    return {
        styles: [
            ...assets.styles || [],
            {
                type: 'stylesheet',
                data: {
                  href: MM_TBAR_URL_CSS,
                },
            },
        ],
        scripts: [
            ...assets.scripts || [],
            {
              type: 'script',
              data: {
                src: MM_TBAR_URL_JS,
              },
            },
            {
              type: 'iife',
              data: {
                fn: (r:any) => {
                  setTimeout(r);
                },
                getParams: () => [renderToolbar],
              },
            },
        ],
    }
}


async function mdFileToMMHtml(inFile: string, outFile: string) {
    console.log(`md to mmhtml ${inFile}`)

    const content = await fsP.readFile(inFile, 'utf8')
    const { root, features } = markmap.transform(content)
    const assets = addToolBarToAssets(
                        markmap.getUsedAssets(features))
    const html = markmap.fillTemplate(root, assets)
    await fsP.writeFile(outFile, html, 'utf8')
}

async function buildMMHtmlFiles(info: DocInfo, output: string) {
    console.log('do buildMMHtmlFiles')

    for(var index in info.books) {
        var book = info.books[index]

        const baseName = path.basename(book.originFile, '.md')
        const fileName = `${book.classify}_${baseName}_mm.html`
        book.mmHtmlFile = path.join(output, fileName)
        book.mmHtmlUrlPath = urlencode.encode(fileName)

        await mdFileToMMHtml(book.originFile, book.mmHtmlFile)
    }
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

    return (path.sep=='/')? relaPath.replace(/\//g, '_') : relaPath.replace(/\\/g, '_')
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
    console.log('do buildInfoFile')

    const templFile = path.join(getCurRunPath(), 'templates/Info.plist')
    const templ = await fsP.readFile(templFile, 'utf8')

    const outContent = templ.replace(/__NAME__/g, name)
    const outFile = path.join(output, 'Info.plist')

    await fsP.writeFile(outFile, outContent, 'utf8')
}






async function jadeToHtml(inFile: string, outFile: string, templData: Object) {
    const renderFn = jade.compileFile(inFile, {pretty: true, doctype: 'xml'})
    await fsP.writeFile(outFile, renderFn(templData), 'utf8')
}


async function buildIndexHtml(info: DocInfo, output: string) {
    console.log('do buildIndexHtml')

    info.indexHtmlFile = path.join(output, 'index.html')

    const classifyInfo = collectClassifyFromDoc(info)
    const templData = {'classifys': classifyInfo}
    const templFile = path.join(getCurRunPath(), 'templates/index.jade')
    await jadeToHtml(templFile, info.indexHtmlFile, templData)
}


async function buildIndexDB(output: string, info: DocInfo, docOutput: string) {
    console.log('do buildIndexDB')

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


function buildPkgOfTGZ(output: string, docsetDirName: string) : Promise<void> {
    console.log('do buildPkgOfTGZ')
    return tar.c(
        {
            gzip: true,
            file: path.join(output, `${docsetDirName}.tgz`),
            cwd: output,
        },
        [docsetDirName]
    )    
}


export async function buildDocset(input: string, output: string, name: string, pkg: string) {

    try {
        console.log(`cmd input ${input}`)
        console.log(`cmd output ${output}`)
        console.log(`cmd name ${name}`)
        console.log(`cmd pkg ${pkg}`)
        console.log(`info cwd ${process.cwd()}`)

        await mume.init(path.join(process.cwd(), '.mume'))

        const docsetDirName = `${name}.docset`
        const rootOutput = path.join(output, docsetDirName)
        fse.emptyDirSync(rootOutput)
        fse.emptyDirSync('./temp')


        const docInfo = await collectAllDocs(input)
        console.log(`collect info: doc number ${docInfo.books.length}`)

        const contOutput = path.join(rootOutput, 'Contents')
        const resOutput = path.join(rootOutput, 'Contents/Resources')
        const docOutput = path.join(rootOutput, 'Contents/Resources/Documents')
        fse.ensureDirSync(docOutput)     
        
        await buildHtmlFiles(docInfo, docOutput)
        await buildMMHtmlFiles(docInfo, docOutput)
        await buildIndexHtml(docInfo, docOutput)

        await buildInfoFile(contOutput, name)
        await buildIndexDB(resOutput, docInfo, docOutput)

        if(pkg === 'tgz') {
            await buildPkgOfTGZ(output, docsetDirName)
        }

        process.exit(0)

    } catch(err) {
        console.error(err)
        process.exit(5)
    }

}