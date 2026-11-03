#!/usr/bin/env node
// Release check: proves the COMMITTED tree compiles, not your working copy.
//
// Why: on 31 Oct 2026 commit 22e341d0 used a name (`promptBrief`) that was not in
// the committed files. It compiled on the laptop because the other half sat in an
// uncommitted file, and Render's build failed with six errors. Owner WIP in the
// working tree hides exactly this class of error, so we check HEAD in a clean copy.
//
//   node scripts/release-check.cjs            # compile check of HEAD (backend + frontend)
//   node scripts/release-check.cjs --full     # also backend unit tests and the route replay
//   node scripts/release-check.cjs --replay   # also the route replay only (about 15 minutes, needs ~2.5 GB free)
//   node scripts/release-check.cjs --ref=<sha> # check another commit
//
// Wired as the pre-push hook by .githooks/pre-push (compile check only, so a push stays fast).

const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const args = process.argv.slice(2)
const full = args.includes('--full')
const replay = full || args.includes('--replay')
const ref = (args.find((a) => a.startsWith('--ref=')) || '--ref=HEAD').slice(6)

const major = Number(process.versions.node.split('.')[0])
if (major !== 22) {
  console.warn(`[release-check] Node ${process.versions.node}: Render builds on Node 22 (backend/package.json engines). Results may differ from the live build.`)
}

const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: root, encoding: 'utf8' }).trim()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'))
const copy = path.join(tmp, 'tree')
let failed = false

function sh(cmd, cmdArgs, cwd, label) {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) {
    console.error(`\n[release-check] FAILED: ${label}`)
    failed = true
  }
  return r.status === 0
}

function link(target, linkPath) {
  // A junction needs no admin rights on Windows and a symlink does the same job elsewhere.
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}

try {
  execFileSync('git', ['worktree', 'add', '--detach', copy, ref], { cwd: root, stdio: 'ignore' })
  for (const dir of ['', 'backend', 'frontend']) {
    const nm = path.join(root, dir, 'node_modules')
    if (fs.existsSync(nm)) link(nm, path.join(copy, dir, 'node_modules'))
  }
  // Same env file the app reads, so replay can reach the dev database. Never the live one.
  for (const dir of ['backend']) {
    const env = path.join(root, dir, '.env')
    if (fs.existsSync(env)) fs.copyFileSync(env, path.join(copy, dir, '.env'))
  }

  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  console.log(`[release-check] checking commit ${sha} in a clean copy (your uncommitted files are not in it)`)
  sh('node', [tsc, '--noEmit', '-p', 'backend'], copy, `backend does not compile at ${sha}`)
  sh('node', [tsc, '--noEmit', '-p', 'frontend'], copy, `frontend does not compile at ${sha}`)

  if (replay && !failed) {
    if (full) sh('npm', ['test'], path.join(copy, 'backend'), 'backend unit tests')
    sh('npm', ['run', 'replay'], path.join(copy, 'backend'), 'route replay')
  }
} finally {
  try {
    // Remove links first so cleanup can never reach into the real node_modules.
    for (const dir of ['', 'backend', 'frontend']) {
      const l = path.join(copy, dir, 'node_modules')
      if (fs.existsSync(l) && fs.lstatSync(l).isSymbolicLink()) fs.unlinkSync(l)
    }
    execFileSync('git', ['worktree', 'remove', '--force', copy], { cwd: root, stdio: 'ignore' })
  } catch (e) {
    console.warn(`[release-check] could not remove ${copy}: ${e.message}`)
  }
}

if (failed) {
  console.error(`\n[release-check] commit ${sha} is NOT safe to push.`)
  process.exit(1)
}
console.log(`\n[release-check] commit ${sha} compiles${replay ? ', replay passes' : ''}${full ? ' and unit tests pass' : ''}.`)
