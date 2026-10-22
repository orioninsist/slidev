import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const root = '/workspace'
const contentDir = join(root, 'content')
const templateDir = join(root, 'template')
const outputDir = join(root, 'output')
const allowedThemes = new Set(['default', 'seriph'])
const allowedFormats = new Set(['pdf', 'pptx'])

function filesIn(dir, ext) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(ext))
    .map(entry => entry.name).sort()
}
async function choice(rl, title, options) {
  console.log('\n' + title)
  options.forEach((value, index) => console.log('  ' + (index + 1) + ') ' + value))
  const answer = (await rl.question('Secim [1]: ')).trim()
  const index = answer === '' ? 0 : Number(answer) - 1
  if (!Number.isInteger(index) || index < 0 || index >= options.length)
    throw new Error('Gecersiz secim: ' + answer)
  return options[index]
}
function cleanName(filename) {
  return filename.replace(/\.md$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'slides'
}
async function main() {
  mkdirSync(contentDir, { recursive: true })
  mkdirSync(templateDir, { recursive: true })
  mkdirSync(outputDir, { recursive: true })
  const contents = filesIn(contentDir, '.md')
  const templates = filesIn(templateDir, '.json')
  if (!contents.length) throw new Error('content/ icinde en az bir .md dosyasi olmali.')
  if (!templates.length) throw new Error('template/ icinde en az bir .json dosyasi olmali.')

  const rl = createInterface({ input: stdin, output: stdout })
  let source, templateName, format
  try {
    source = await choice(rl, 'Markdown dosyasi:', contents)
    templateName = await choice(rl, 'Sablon:', templates)
    format = await choice(rl, 'Cikti formati:', ['pdf', 'pptx'])
  }
  finally { rl.close() }

  const template = JSON.parse(readFileSync(join(templateDir, templateName), 'utf8'))
  if (!allowedThemes.has(template.theme))
    throw new Error('Desteklenmeyen tema: ' + template.theme)
  if (!allowedFormats.has(format)) throw new Error('Desteklenmeyen format')
  const body = readFileSync(join(contentDir, source), 'utf8')
  const stripped = body.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const yamlHeader = ['---', 'theme: ' + template.theme, 'title: ' + JSON.stringify(template.title || cleanName(source)), '---', ''].join('\n')
  const workFile = join(root, '.orioninsist-slides.md')
  writeFileSync(workFile, yamlHeader + stripped)
  const destination = join(outputDir, cleanName(source) + '-' + cleanName(templateName.replace(/\.json$/, '')) + '.' + format)
  console.log('\nOlusturuluyor: ' + destination)
  const args = ['/app/node_modules/@slidev/cli/bin/slidev.mjs', 'export', workFile, '--format', format, '--output', destination]
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0 || !existsSync(destination)) throw new Error('Slidev export basarisiz.')
  console.log('\nHazir: ' + destination)
}
main().catch(error => { console.error('\nHata:', error.message); process.exitCode = 1 })
