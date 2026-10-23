import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-chromium'
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
    const port = 3030
    const url = `http://localhost:${port}`
    const cli = '/app/node_modules/@slidev/cli/bin/slidev.mjs'

    let server
    let browser

    try {
      server = spawn(process.execPath, [
        cli, workFile,
        '--port', String(port),
        '--log', 'info',
      ], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      })

      server.stdout.on('data', data => process.stdout.write(data))
      server.stderr.on('data', data => process.stderr.write(data))

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      })

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: {
          dir: tempDir,
          size: { width: 1280, height: 720 },
        },
      })

      const page = await context.newPage()
      let connected = false

      for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null)
          throw new Error('Slidev sunucusu kapandi.')

        try {
          const response = await page.goto(`${url}/1`, {
            timeout: 2000,
            waitUntil: 'domcontentloaded',
          })
          if (response?.ok()) {
            connected = true
            break
          }
        } catch {}

        await page.waitForTimeout(1000)
      }

      if (!connected)
        throw new Error('Slidev sunucusuna baglanilamadi.')

      await page.locator('.slidev-page').first().waitFor({
        state: 'visible',
        timeout: 30000,
      })

      const slideCount = await page.evaluate(() => {
        const numbers = [...document.querySelectorAll('[class*="slidev-page-"]')]
          .flatMap(element =>
            [...element.classList]
              .map(name => /^slidev-page-(\d+)$/.exec(name))
              .filter(Boolean)
              .map(match => Number(match[1]))
          )
        return Math.max(0, ...numbers)
      })

      if (!slideCount)
        throw new Error('Slayt sayisi belirlenemedi.')

      console.log(`\nAnimasyonlu MP4: ${slideCount} slayt`)

      for (let slide = 1; slide <= slideCount; slide++) {
        console.log(`Kaydediliyor: ${slide}/${slideCount}`)
        await page.waitForTimeout(5000)

        if (slide < slideCount) {
          await page.keyboard.press('ArrowRight')
          await page.waitForTimeout(1000)
        }
      }

      const video = page.video()
      await context.close()

      const webm = await video.path()
      const tempMp4 = join(tempDir, 'video.mp4')

      const result = spawnSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', webm,
        '-vf', 'fps=30,format=yuv420p',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-movflags', '+faststart',
        tempMp4,
      ], { stdio: 'inherit' })

      if (result.error) throw result.error
      if (result.status !== 0 || !existsSync(tempMp4))
        throw new Error('MP4 donusumu basarisiz.')

      const { renameSync } = await import('node:fs')
      renameSync(tempMp4, destination)

      console.log('\nHazir: ' + destination)
      return
    } finally {
      if (browser) await browser.close()
      if (server) server.kill('SIGTERM')
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
