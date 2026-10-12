import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// On Windows npm is a .cmd shim: execFile cannot run it directly (ENOENT), and
// Node only runs .cmd files through a shell. The arguments are fixed literals,
// so the shell adds no injection surface.
const IS_WINDOWS = process.platform === 'win32'
const NPM = IS_WINDOWS ? 'npm.cmd' : 'npm'

// O CI instala com `npm ci` estrito, mas o Dockerfile usava
// `npm install --legacy-peer-deps`, mascarando o conflito de peers entre
// `@storybook/addon-vitest@10` (pede `@vitest/browser@^3 || ^4`) e o
// `vitest@1.6.1` do projeto. Resultado: CI vermelho desde a introdução do
// addon. Este teste reproduz a validação do `npm ci` de forma offline e
// determinística (cache frio), falhando se o lockfile voltar a ser
// irresolvível sem `--legacy-peer-deps`.
describe('resolução de dependências', () => {
  it('o lockfile instala com npm ci estrito, sem --legacy-peer-deps', () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), 'cafe-npm-cache-'))
    try {
      expect(() =>
        execFileSync(
          NPM,
          ['ci', '--dry-run', '--offline', '--no-audit', '--no-fund'],
          {
            cwd: FRONTEND_ROOT,
            stdio: 'pipe',
            timeout: 60_000,
            env: { ...process.env, npm_config_cache: cacheDir },
            shell: IS_WINDOWS,
          }
        )
      ).not.toThrow()
    } finally {
      rmSync(cacheDir, { recursive: true, force: true })
    }
  })
})
