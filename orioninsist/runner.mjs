import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const root = '/workspace'
const contentDir = join(root, 'content')
const templateDir = join(root, 'template')
const outputDir = join(root, 'output')
const allowedThemes = new Set(['default', 'seriph'])
const formats = [
  { label: 'PDF', value: 'pdf' },
  { label: 'PPTX', value: 'pptx' },
  { label: 'PPTX Editable', value: 'pptx-editable' },
  { label: 'PNG', value: 'png' },
  { label: 'MD', value: 'md' },
  { label: 'HTML/SPA', value: 'html' },
  { label: 'MP4 (5 sn/slayt)', value: 'mp4' },
]
const allowedFormats = new Set(formats.map(item => item.value))

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
  let source, templateName, format, outputName
  try {
    source = process.env.SLIDEV_CONTENT ||
      await choice(rl, 'Markdown dosyasi:', contents)
    templateName = process.env.SLIDEV_TEMPLATE ||
      await choice(rl, 'Sablon:', templates)
    const selected = process.env.SLIDEV_FORMAT ||
      await choice(rl, 'Cikti formati:', formats.map(item => item.label))
    format = formats.find(item => item.label === selected)?.value
    if (!contents.includes(source) || !templates.includes(templateName) || !format)
      throw new Error('Gecersiz icerik, sablon veya format')
    outputName = cleanName(source)
  }
  finally { rl.close() }

  const template = JSON.parse(readFileSync(join(templateDir, templateName), 'utf8'))
  if (!allowedThemes.has(template.theme))
    throw new Error('Desteklenmeyen tema: ' + template.theme)
  if (!allowedFormats.has(format)) throw new Error('Desteklenmeyen format')
  const body = readFileSync(join(contentDir, source), 'utf8')
  const frontmatter = body.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const stripped = frontmatter ? body.slice(frontmatter[0].length) : body
  const originalHeader = frontmatter ? frontmatter[1] : ''
  const preservedHeader = originalHeader
    .split(/\r?\n/)
    .filter(line => !/^(?:theme|title)\s*:/.test(line))
    .join('\n')
  const yamlHeader = [
    '---',
    preservedHeader,
    'theme: ' + template.theme,
    'title: ' + JSON.stringify(template.title || cleanName(source)),
    '---',
    '',
  ].join('\n')
  const workFile = join(root, '.orioninsist-slides.md')
  writeFileSync(workFile, yamlHeader + stripped)
  if (format === 'mp4') {
    const destination = join(outputDir, outputName + '.mp4')
    const tempDir = mkdtempSync(join(outputDir, '.mp4-'))
    try {
      const pngDir = join(tempDir, 'frames')
      const exportResult = spawnSync(process.execPath, [
        '/app/node_modules/@slidev/cli/bin/slidev.mjs',
        'export', workFile,
        '--format', 'png',
        '--output', pngDir,
      ], { cwd: root, stdio: 'inherit', env: process.env })

      if (exportResult.error) throw exportResult.error
      if (exportResult.status !== 0)
        throw new Error('MP4 icin PNG export basarisiz.')

      const frames = readdirSync(pngDir)
        .filter(name => /^\d+\.png$/.test(name))
        .sort((a, b) => Number(a.slice(0, -4)) - Number(b.slice(0, -4)))

      if (!frames.length) throw new Error('PNG kareleri bulunamadi.')

      const concatFile = join(tempDir, 'frames.txt')
      const quote = path => "'" + path.replace(/'/g, "'\\''") + "'"
      const lines = []
      for (const frame of frames) {
        lines.push('file ' + quote(join(pngDir, frame)))
        lines.push('duration 5')
      }
      lines.push('file ' + quote(join(pngDir, frames.at(-1))))
      writeFileSync(concatFile, lines.join('\n') + '\n')

      const tempVideo = join(tempDir, 'video.mp4')
      const ffmpegResult = spawnSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'concat', '-safe', '0', '-i', concatFile,
        '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'medium',
        '-movflags', '+faststart', tempVideo,
      ], { cwd: root, stdio: 'inherit' })

      if (ffmpegResult.error) throw ffmpegResult.error
      if (ffmpegResult.status !== 0 || !existsSync(tempVideo))
        throw new Error('FFmpeg MP4 uretimi basarisiz.')

      const { renameSync } = await import('node:fs')
      renameSync(tempVideo, destination)
      console.log('\\nHazir: ' + destination)
      return
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }

  const isSPA = format === 'html'
  const extension = format === 'pptx-editable' ? 'pptx' : format
  const destination = join(outputDir, outputName + (isSPA ? '' : '.' + extension))

  if (existsSync(destination)) {
    const { rmSync } = await import('node:fs')
    rmSync(destination, { recursive: true, force: true })
  }

  console.log('\\nOlusturuluyor: ' + destination)

  const args = [
    '/app/node_modules/@slidev/cli/bin/slidev.mjs',
    isSPA ? 'build' : 'export',
    workFile,
  ]

  if (isSPA) {
    args.push('--out', destination)
  } else {
    args.push('--format', format, '--output', destination)
  }

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) throw result.error
  if (result.status !== 0 || !existsSync(destination))
    throw new Error('Slidev islemi basarisiz.')

  console.log('\\nHazir: ' + destination)
}
main().catch(error => { console.error('\nHata:', error.message); process.exitCode = 1 })
