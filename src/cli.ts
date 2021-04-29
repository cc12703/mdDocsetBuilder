
import pkg from 'root/package.json'
import program from 'commander'
import { buildDocset } from '@/builder'




program
.version(pkg.version, '-v, --version', 'output the current version')
.description('Create a Docset from a Markdown input dir')
.arguments('<input>')
.option('-o --output <dir>', 'specify output dir of output Docset')
.option('-n --docname <name>', 'specify filename of the output Docset')
.option('-p --pkg <format>', 'generate a compressed package, format value is tgz ')
.action((input, cmd) => {
    buildDocset(input, cmd.output, cmd.docname, cmd.pkg).catch((error)=> console.log(error))
})

program.parse(process.argv)
