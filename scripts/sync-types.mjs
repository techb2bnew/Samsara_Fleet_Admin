/**
 * Generates TypeScript types from the live database schema and writes the
 * same file into BOTH apps. Run after every migration:
 *
 *   npm run sync-types
 *
 * Plain Node, no shell. Works identically on macOS, Windows and Linux —
 * a .sh script would need Git Bash or WSL on Windows.
 *
 * Reads SUPABASE_PROJECT_ID from supabase/.env
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const ENV_FILE = path.join(ROOT, 'supabase', '.env')

const ADMIN_OUT = path.join(ROOT, 'src', 'supabase', 'database.ts')
const MOBILE_OUT = path.join(ROOT, '..', 'SamsaraDriver', 'src', 'supabase', 'database.ts')

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

/** Minimal KEY=value parser. Avoids adding a dotenv dependency for one file. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) {
    fail(`${path.relative(ROOT, file)} not found.\n  Copy supabase/.env.example to supabase/.env and fill it in.`)
  }

  const vars = {}
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

const env = readEnvFile(ENV_FILE)
const projectId = env.SUPABASE_PROJECT_ID

if (!projectId) {
  fail('SUPABASE_PROJECT_ID is empty in supabase/.env.\n  Find it in your Supabase dashboard under Project Settings -> General -> Reference ID.')
}

console.log(`\n  Generating types from project ${projectId} ...`)

// Windows needs the .cmd shim. Naming it explicitly lets us run without
// shell: true, which would otherwise concatenate these arguments into a
// command string rather than passing them separately.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

let types
try {
  types = execFileSync(
    npx,
    ['--yes', 'supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
} catch {
  fail('Type generation failed.\n  Check that you have run: npx supabase login')
}

if (!types || !types.includes('export type Database')) {
  fail('Supabase returned no usable types. Has a migration been pushed yet?')
}

const written = []

fs.writeFileSync(ADMIN_OUT, types)
written.push(path.relative(ROOT, ADMIN_OUT))

if (fs.existsSync(path.dirname(MOBILE_OUT))) {
  fs.writeFileSync(MOBILE_OUT, types)
  written.push(path.relative(ROOT, MOBILE_OUT))
} else {
  console.log('  Mobile app folder not found, skipped.')
}

console.log(`\n  Written to:\n${written.map((f) => `    ${f}`).join('\n')}\n`)
