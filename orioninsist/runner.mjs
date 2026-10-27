import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-chromium'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const root = '/workspace'
const contentDir = join(root, 'content')
const outputDir = join(root, 'output')
const formats = [
  { label: 'PDF', value: 'pdf' },
  { label: 'PPTX', value: 'pptx' },
  { label: 'PPTX Editable', value: 'pptx-editable' },
  { label: 'PNG', value: 'png' },
  { label: 'MD', value: 'md' },
  { label: 'HTML/SPA', value: 'html' },
  { label: 'MP4', value: 'mp4' },
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
  mkdirSync(outputDir, { recursive: true })
  const contents = filesIn(contentDir, '.md')
  if (!contents.length) throw new Error('content/ icinde en az bir .md dosyasi olmali.')

  const rl = createInterface({ input: stdin, output: stdout })
  let source, format, outputName
  try {
    source = process.env.SLIDEV_CONTENT ||
      await choice(rl, 'Markdown dosyasi:', contents)

    const selected = process.env.SLIDEV_FORMAT ||
      await choice(rl, 'Cikti formati:', formats.map(item => item.label))

    format = formats.find(item =>
      item.label === selected || item.value === selected
    )?.value

    if (!contents.includes(source) || !format)
      throw new Error('Gecersiz Markdown veya format')

    outputName = cleanName(source)
    await rl.question('Uretmek icin Enter: ')
  }
  finally { rl.close() }

  if (!allowedFormats.has(format))
    throw new Error('Desteklenmeyen format')

  const original = readFileSync(join(contentDir, source), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/^(?:[ \t]*\r?\n)+/, '')

  const themes = new Set([
    'default', 'seriph', 'apple-basic', 'bricks', 'shibainu',
    'academic', 'dracula', 'geist', 'nord',
  ])
  const transitions = new Set(['fade', 'slide-left', 'slide-right'])

  const theme = process.env.SLIDEV_THEME
  const transition = process.env.SLIDEV_TRANSITION

  if (theme && !themes.has(theme))
    throw new Error('Gecersiz Slidev temasi: ' + theme)
  if (transition && !transitions.has(transition))
    throw new Error('Gecersiz Slidev gecisi: ' + transition)

  let body = original

  if (theme || transition) {
    const yaml = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/
    const match = body.match(yaml)
    let head = match ? match[1] : ''

    for (const [key, value] of [['theme', theme], ['transition', transition]]) {
      if (!value) continue
      const line = new RegExp('^' + key + ':[^\\r\\n]*$', 'm')
      head = line.test(head)
        ? head.replace(line, key + ': ' + value)
        : head + (head ? '\n' : '') + key + ': ' + value
    }

    const prefix = '---\n' + head + '\n---'
    body = match
      ? prefix + body.slice(match[0].length)
      : prefix + '\n\n' + body
  }

  const workFile = join(root, '.orioninsist-slides.md')
  writeFileSync(workFile, body)

  if (format === 'mp4') {
    const lines = body.replace(/^\uFEFF/, '').trimStart().split(/\r?\n/)
    const yamlEnd = lines[0].trim() === '---'
      ? lines.findIndex((line, index) => index > 0 && line.trim() === '---')
      : -1
    const ratioLine = yamlEnd > 0
      ? lines.slice(1, yamlEnd).find(line => line.trim().startsWith('aspectRatio:'))
      : undefined
    const ratio = ratioLine
      ? ratioLine.split(':').slice(1).join(':').trim().replaceAll('"', '').replaceAll("'", '')
      : '16/9'
    const match = ratio.match(/^(\d+)\s*\/\s*(\d+)$/)

    if (!match || Number(match[2]) === 0)
      throw new Error('Gecersiz aspectRatio: ' + ratio)

    const aspect = Number(match[1]) / Number(match[2])
    const videoSize = aspect < 1
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 }

    console.log(`MP4 boyutu: ${videoSize.width}x${videoSize.height}`)
    const destination = join(outputDir, outputName + '.mp4')
    const tempDir = mkdtempSync(join(outputDir, '.mp4-'))
    const buildDir = join(tempDir, 'spa')
    const cli = '/app/node_modules/@slidev/cli/bin/slidev.mjs'
    const port = 3030
    const url = `http://127.0.0.1:${port}`
    let server
    let browser

    try {
      console.log('\nSlidev HTML/SPA olusturuluyor...')

      const build = spawnSync(process.execPath, [
        cli, 'build', workFile,
        '--out', buildDir,
      ], {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
      })

      if (build.error) throw build.error
      if (build.status !== 0 || !existsSync(join(buildDir, 'index.html')))
        throw new Error('HTML/SPA olusturulamadi.')

      console.log('HTML/SPA hazir.')

      const staticServer = `
        const http = require('node:http')
        const fs = require('node:fs')
        const path = require('node:path')
        const root = process.argv[1]
        const port = Number(process.argv[2])
        const types = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.wasm': 'application/wasm',
        }
        http.createServer((req, res) => {
          const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
          const target = path.resolve(root, '.' + pathname)
          if (target !== root && !target.startsWith(root + path.sep)) {
            res.writeHead(403).end()
            return
          }
          const file = fs.existsSync(target) && fs.statSync(target).isFile()
            ? target
            : path.join(root, 'index.html')
          res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
          fs.createReadStream(file).on('error', () => {
            if (!res.headersSent) res.writeHead(404)
            res.end()
          }).pipe(res)
        }).listen(port, '127.0.0.1')
      `

      server = spawn(process.execPath, [
        '-e', staticServer, buildDir, String(port),
      ], {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      server.stdout.on('data', data => process.stdout.write(data))
      server.stderr.on('data', data => process.stderr.write(data))

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      })

      const warmup = await browser.newContext({
        viewport: videoSize,
      })
      const warmupPage = await warmup.newPage()

      let ready = false
      for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null)
          throw new Error('Slidev sunucusu kapandi.')

        try {
          const response = await warmupPage.goto(`${url}/1`, {
            waitUntil: 'networkidle',
            timeout: 5000,
          })
          if (response?.ok()) {
            await warmupPage.locator(
              '.slidev-page[data-slidev-no="1"]:visible'
            ).waitFor({ timeout: 5000 })
            await warmupPage.evaluate(() => document.fonts.ready)
            ready = true
            break
          }
        } catch {}
        await warmupPage.waitForTimeout(1000)
      }

      if (!ready)
        throw new Error('Slidev sunumu hazir degil.')

      const { parseSync } = await import('@slidev/parser')
      const slideCount = parseSync(body).slides.length

      if (!slideCount)
        throw new Error('Slayt bulunamadi.')

      console.log(`Sunum hazir: ${slideCount} slayt`)

      const context = await browser.newContext({
        viewport: videoSize,
        recordVideo: {
          dir: tempDir,
          size: videoSize,
        },
      })

      const page = await context.newPage()
      await page.goto(`${url}/1`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
      await page.locator(
        '.slidev-page[data-slidev-no="1"]:visible'
      ).waitFor({ timeout: 30000 })
      await page.evaluate(() => document.fonts.ready)

      console.log('MP4 kaydi basladi.')

      for (let slide = 1; slide <= slideCount; slide++) {
        console.log(`Kaydediliyor: ${slide}/${slideCount}`)

        if (slide > 1) {
          await page.keyboard.press('ArrowDown')
          await page.waitForURL(
            new RegExp(`/${slide}(?:\\?|$)`),
            { timeout: 10000 },
          )
        }

        await page.waitForTimeout(2000)

        const clickSteps = await page.locator(
          `.slidev-page[data-slidev-no="${slide}"] [data-slidev-clicks-start]`
        ).evaluateAll(elements =>
          Math.max(0, ...elements.map(element =>
            Number(element.dataset.slidevClicksStart) || 0
          ))
        )

        console.log(`Animasyon adimi: ${clickSteps}`)

        for (let click = 0; click < clickSteps; click++) {
          await page.keyboard.press('ArrowRight')
          await page.waitForTimeout(1000)
        }
      }

      const video = page.video()
      await context.close()

      const webm = await video.path()
      const mp4 = join(tempDir, 'video.mp4')

      const conversion = spawnSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', webm,
        '-vf', 'fps=30,format=yuv420p',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-movflags', '+faststart',
        mp4,
      ], { stdio: 'inherit' })

      if (conversion.error) throw conversion.error
      if (conversion.status !== 0 || !existsSync(mp4))
        throw new Error('MP4 donusumu basarisiz.')

      const { renameSync } = await import('node:fs')
      renameSync(mp4, destination)

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
