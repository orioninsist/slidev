# Slidev Full Headmatter Configuration Reference

This reference template contains every official YAML frontmatter configuration option available in Slidev for configuring your presentation slides (`slides.md`).
- https://sli.dev/resources/addon-gallery

```yaml
---
# --- 1. THEME, ADDONS & CUSTOM STYLES ---
theme: default                   # Theme ID, package name, or local path
addons: []                       # List of addon packages (e.g. slidev-addon-python-runner)
themeConfig:                     # Custom CSS variables for theme styling
  primary: '#5d8392'

# --- 2. PRESENTATION METADATA ---
title: Slidev                    # Slide deck title (shown in browser tab)
titleTemplate: '%s - Slidev'     # Webpage title template (`%s` = title)
info: false                      # Slide deck description (supports Markdown)
author: Your Name Here           # Author field for exported PDF/PPTX
keywords: keyword1,keyword2      # Keywords field for exported PDF
favicon: 'https://cdn.jsdelivr.net/gh/slidevjs/slidev/assets/favicon.png'

# --- 3. DISPLAY & CANVAS SETTINGS ---
aspectRatio: 16/9               # Aspect ratio (16/9, 4/3)
canvasWidth: 980                # Canvas real width in pixels
colorSchema: auto               # Color schema ('auto' | 'light' | 'dark')
selectable: true                # Enable text selection on slides
routerMode: history             # Vue-router mode ('history' | 'hash' | 'memory')

# --- 4. ANIMATIONS & TRANSITIONS ---
transition: undefined           # Default transition between slides (e.g. slide-left, fade)
clickAnimation: undefined        # Default click animation presets

# --- 5. CODE HIGHLIGHTING & EDITORS ---
highlighter: shiki              # Syntax highlighter ('shiki' | 'prism')
lineNumbers: false              # Show line numbers in code blocks
monaco: true                    # Enable Monaco Editor ('dev' | 'build' | boolean)
monacoTypesSource: local        # Where to load monaco types ('cdn' | 'local' | 'none')
monacoTypesAdditionalPackages: [] # Extra local packages for types
twoslash: true                  # Enable TypeScript Twoslash support

# --- 6. DRAWING & INTERACTION TOOLS ---
drawings:
  enabled: true                 # Enable drawing tool on canvas
  persist: false                # Save drawings persistently
  presenterOnly: false          # Only visible to presenter
  syncAll: true                 # Sync drawings across sessions
contextMenu: true               # Enable Slidev context menu
wakeLock: true                  # Prevent screen sleep during presentation

# --- 7. EXPORT, DOWNLOAD & RECORDING ---
download: false                 # Show download button in SPA build
exportFilename: slidev-exported # Filename for exported slides
export:                         # `slidev export` CLI options
  format: pdf
  timeout: 30000
  dark: false
  withClicks: false
  withToc: false
record: dev                     # Enable slide recording ('dev' | 'build' | boolean)
presenter: true                 # Enable presenter mode ('dev' | 'build' | boolean)
browserExporter: dev            # Enable browser exporter ('dev' | 'build' | boolean)

# --- 8. FONTS & DIAGRAM SERVERS ---
fonts:                          # Google Fonts auto-import
  sans: Roboto
  serif: Roboto Slab
  mono: Fira Code
plantUmlServer: https://www.plantuml.com/plantuml

# --- 9. DEFAULT SLIDE CONFIGURATION ---
defaults:
  layout: default               # Default layout applied to all slides

# --- 10. SEO & HTML ATTRIBUTES ---
htmlAttrs:
  dir: ltr
  lang: en
seoMeta:
  ogTitle: Slidev Presentation
  ogDescription: Developer Friendly Presentation
---
```

---

## Per-Slide Frontmatter Reference

At the top of individual slides (after `---`), you can use these slide-specific options:

```yaml
---
layout: default                 # Slide layout (e.g., cover, two-cols, image-right, center)
title: Slide Title              # Slide title (overrides header-based title)
level: 1                        # Heading level for Toc component
clicks: 0                       # Custom click count
background: '/image.png'        # Background image URL or color
disabled: false                 # Disable / hide slide
hideInToc: false                # Hide slide from Table of Contents
transition: slide-left          # Override transition for this specific slide
zoom: 1                         # Zoom scale factor for dense content
src: './pages/slide2.md'        # Include another markdown file
---
```
