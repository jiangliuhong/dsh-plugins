import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import test from 'node:test'
import { linkedWorktreeRoots } from '../existing-worktrees.js'

test('sidebar batch finds registered linked roots with no Agent or Git process, sharing ancestor probes', async t => {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'chat-groups-linked-')))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const main = join(dir, 'repository'), linked = join(dir, 'linked checkout')
  const git = (...args) => execFileSync('git', args, { stdio: 'pipe' })
  git('init', '-q', main)
  git('-C', main, '-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-qm', 'initial', '--allow-empty')
  git('-C', main, 'worktree', 'add', '--detach', linked)
  const child = join(linked, 'one', 'two'), sibling = join(linked, 'one', 'three')
  await fs.mkdir(child, { recursive: true })
  await fs.mkdir(sibling)
  const nested = join(linked, 'nested')
  git('init', '-q', '--separate-git-dir', join(dir, 'separate-git-dir'), nested)
  const alias = join(dir, 'alias')
  await fs.symlink(child, alias, process.platform === 'win32' ? 'junction' : 'dir')
  const stale = join(dir, 'stale')
  await fs.mkdir(stale)
  await fs.copyFile(join(linked, '.git'), join(stale, '.git'))
  const probes = new Map()
  async function metadata(path, method) {
    const stat = await fs[method](path).catch(error => { if (error.code !== 'ENOENT') throw error })
    if (stat) return { type: stat.isDirectory() ? 'directory' : 'file' }
  }
  const ctx = { fs: {
    resolve: path => fs.realpath(path), processPath: path => path,
    stat: path => metadata(path, 'stat'),
    lstat(path) { probes.set(path, (probes.get(path) ?? 0) + 1); return metadata(path, 'lstat') },
    readBytes: path => fs.readFile(path),
  } }
  const paths = [main, child, alias, sibling, linked, child, nested, stale, dir, join(linked, 'removed'), 'relative']
  const expected = { [linked]: linked, [child]: linked, [sibling]: linked, [alias]: linked }
  assert.deepEqual(await linkedWorktreeRoots(ctx, paths), expected)
  assert.equal(probes.get(join(linked, '.git')), 1)
  assert.equal(probes.get(join(linked, 'one', '.git')), 1)
  // Modern Git can store both registration pointers relative to their file.
  const marker = join(linked, '.git')
  const admin = (await fs.readFile(marker, 'utf8')).slice(8).trimEnd()
  await fs.writeFile(marker, `gitdir: ${relative(linked, admin)}\n`)
  await fs.writeFile(join(admin, 'gitdir'), `${relative(admin, marker)}\n`)
  assert.deepEqual(await linkedWorktreeRoots(ctx, [child, dirname(child)]), { [child]: linked, [dirname(child)]: linked })
})
