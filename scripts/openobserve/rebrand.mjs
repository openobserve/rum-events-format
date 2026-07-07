#!/usr/bin/env node
/**
 * OpenObserve rebrand codemod for the rum-events-format fork.
 *
 * Transforms a pristine DataDog/rum-events-format tree into the OpenObserve
 * equivalent by applying the ordered rules in rename-map.json to every tracked
 * text file. It touches the JSON schemas and samples only; the generated
 * TypeScript/JS under lib/generated is rebuilt from the rebranded schemas by
 * `yarn generate` (run by sync-upstream.sh right after this codemod), so it is
 * deliberately skipped here.
 *
 * Run from the repository root:
 *   node scripts/openobserve/rebrand.mjs [--check]
 *
 * --check: exit 1 if any file WOULD change (used to detect an already-branded tree).
 *
 * Deterministic and idempotent: running it twice produces the same tree.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = process.cwd()
const HERE = path.dirname(fileURLToPath(import.meta.url))
const CHECK = process.argv.includes('--check')

const { rules } = JSON.parse(fs.readFileSync(path.join(HERE, 'rename-map.json'), 'utf8'))

// Fork-owned files (keep-ours overlay) are never rebranded: they are authored for
// the fork already, and may intentionally reference upstream.
const keepOursPaths = fs
  .readFileSync(path.join(HERE, 'keep-ours.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

// Files never touched by the codemod.
const SKIP = [
  /^\.yarn\//,
  /^yarn\.lock$/,
  /^CHANGELOG\.md$/,
  /^lib\/generated\//, // regenerated from the rebranded schemas by `yarn generate`
  /^lib\/(cjs|esm)\//, // compiled output, rebuilt by `yarn build`
  /^scripts\/openobserve\//, // this tooling
  /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|mp4|webm|zip|jar|pdf)$/i,
]

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .filter((f) => !keepOursPaths.some((p) => f === p || f.startsWith(`${p}/`)))

const compiled = rules.map((rule) => ({
  ...rule,
  matcher: rule.regex ? new RegExp(rule.regex, 'g') : null,
}))

function applyRules(content) {
  let out = content
  for (const rule of compiled) {
    if (rule.matcher) {
      out = out.replace(rule.matcher, rule.to)
    } else {
      out = out.split(rule.literal).join(rule.to)
    }
  }
  return out
}

let changed = 0
for (const file of trackedFiles) {
  const abs = path.join(ROOT, file)
  let stat
  try {
    stat = fs.lstatSync(abs)
  } catch {
    continue // deleted in working tree
  }
  if (!stat.isFile()) continue
  const buf = fs.readFileSync(abs)
  if (buf.includes(0)) continue // binary safety net
  const content = buf.toString('utf8')
  const next = applyRules(content)
  if (next !== content) {
    changed++
    if (!CHECK) fs.writeFileSync(abs, next)
  }
}

console.log(`rebrand: ${changed} files rebranded`)
if (CHECK && changed > 0) {
  console.error('rebrand --check: tree is not fully branded')
  process.exit(1)
}
