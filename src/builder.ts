
import * as path from 'path'
import { promises as fsP } from 'fs'

import walk from 'walk'
import * as mume from '@shd101wyy/mume'
import * as fse from 'fs-extra'
import * as markmap from 'markmap-lib'
import * as urlencode from 'urlencode'


import * as util from '@/util'


class DocItemInfo {
    classify: string = ''
    name: string = ''

    originFile: string = ''

    htmlFile: string = ''
    mmHtmlFile: string = ''
}



class DocInfo {
    
    inputDir: string

    items: DocItemInfo[] = []

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

    fse.copySync(tempOutFile, outFile)
}


function buildHtmlFiles(info: DocInfo, output: string) {
    info.items.forEach(item => {
        const baseName = path.basename(item.originFile, '.md')
        item.htmlFile = path.join(output, `${item.classify}_${baseName}.html`)
        mdFileToHtml(item.originFile, item.htmlFile)
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
    info.items.forEach(item => {
        const baseName = path.basename(item.originFile, '.md')
        item.mmHtmlFile = path.join(output, `${item.classify}_${baseName}_mm.html`)
        mdFileToMMHtml(item.originFile, item.mmHtmlFile)
    })
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
            
            let item = new DocItemInfo()
            item.classify = pathToClassify(dir, input)
            item.name = path.basename(stats.name, '.md')
            item.originFile = path.join(dir, stats.name)
            info.items.push(item)

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






async function buildIndexFile(output: string, info: DocInfo, docOutput: string) {
    const dbFile = path.join(output, 'docSet.dsidx')

    const db = await util.openDatabase(dbFile)

    await util.runSqlInDatabase(db, 'CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);')

    let sql = ''
    info.items.forEach(item => {
        const guideName = `${item.classify}_${item.name}` 
        const htmlPath = urlencode.encode(item.htmlFile.replace(docOutput, ''))
        sql += `INSERT INTO searchIndex(name, type, path) VALUES ('${guideName}', 'Guide', '${htmlPath}');`

        const mmGuideName = `${item.classify}_${item.name}_思维导图` 
        const mmHtmlPath = urlencode.encode(item.mmHtmlFile.replace(docOutput, ''))
        sql += `INSERT INTO searchIndex(name, type, path) VALUES ('${mmGuideName}', 'Guide', '${mmHtmlPath}');`
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

    buildInfoFile(contOutput, name)
    buildIndexFile(resOutput, docInfo, docOutput)

}