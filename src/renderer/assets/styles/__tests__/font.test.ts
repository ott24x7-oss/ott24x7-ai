import { readFileSync } from 'node:fs'

import postcss, { type Declaration } from 'postcss'
import { describe, expect, it } from 'vitest'

const fontStyles = readFileSync('src/renderer/assets/styles/font.css', 'utf8')
const interFontStyles = readFileSync('src/renderer/assets/fonts/inter/inter.css', 'utf8')
const jetBrainsMonoFontStyles = readFileSync('src/renderer/assets/fonts/jetbrains-mono/jetbrains-mono.css', 'utf8')

describe('default UI font', () => {
  it('uses the user-selected font first and bundled Inter as the default', () => {
    const declarations: Declaration[] = []

    postcss.parse(fontStyles).walkDecls('--font-family', (declaration) => {
      declarations.push(declaration)
    })

    expect(declarations).toHaveLength(2)
    for (const declaration of declarations) {
      expect(postcss.list.comma(declaration.value)[0]).toBe("var(--app-user-font-family, 'Inter')")
    }
    expect(interFontStyles).toContain("url('./InterVariable.woff2')")
  })
})

describe('serif font styles', () => {
  it('requests the configured global font before the generic serif fallback', () => {
    const declarations: Declaration[] = []

    postcss.parse(fontStyles).walkDecls('--font-family-serif', (declaration) => {
      declarations.push(declaration)
    })

    expect(declarations.some(({ parent }) => parent?.type === 'rule' && parent.selectors.includes(':root'))).toBe(true)

    // Configured global font wins over the serif switch; generic serif stays as the fallback.
    for (const declaration of declarations) {
      const families = postcss.list.comma(declaration.value)
      expect(families[0]).toMatch(/^var\(\s*--app-user-font-family\s*,\s*serif\s*\)$/)
      expect(families[1]).toBe('serif')
    }
  })
})

describe('default code font', () => {
  it('uses the user-selected font first and bundled JetBrains Mono as the default', () => {
    const declarations: Declaration[] = []

    postcss.parse(fontStyles).walkDecls('--code-font-family', (declaration) => {
      declarations.push(declaration)
    })

    expect(declarations).toHaveLength(2)
    for (const declaration of declarations) {
      expect(postcss.list.comma(declaration.value)[0]).toBe("var(--app-user-code-font-family, 'JetBrains Mono')")
    }
    expect(jetBrainsMonoFontStyles).toContain("url('./JetBrainsMono-Regular.woff2')")
  })
})
