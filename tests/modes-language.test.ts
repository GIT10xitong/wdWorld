import { describe, it, expect, afterEach } from 'vitest'
import { Database } from '@/lib/storage/database'
import { PROFILES } from '@/features/studio/profiles'
import { setLanguage, t, message } from '@/lib/i18n'
import { FIELDS } from '@/features/studio/model'
import en from '@/lib/locales/en.json'
import errors from '../electron/messages.en.json'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
afterEach(() => setLanguage('zh-CN'))
describe('project modes and language', () => {
  it('preserves mode through encrypted payload metadata, database reopen and backup copies', async () => {
    const db = new Database()
    await db.open()
    for (const mode of ['novel', 'oc', 'trpg', 'tavern', 'free'] as const) {
      const project = await db.createProject(mode, '', mode)
      await db.createEntry(project.id, 'lore', mode + ' private lore')
      expect((await db.getProject(project.id))?.mode).toBe(mode)
      const json = await db.exportProjectJSON(project.id)
      expect(JSON.parse(json).project.mode).toBe(mode)
      const other = new Database()
      await other.open()
      const imported = await other.importProjectJSON(json)
      expect(imported.mode).toBe(mode)
      expect(other.getProjectMode(imported.id)).toBe(mode)
      other.close()
    }
    const legacy = await db.createProject('Legacy')
    expect(legacy.mode).toBe('free')
    db.close()
  })
  it('updates live labels, formats messages, and preserves substituted author content', () => {
    setLanguage('en')
    expect(FIELDS.trpg.secrets).toBe('GM secrets')
    expect(PROFILES.oc.label).toBe('OC creator')
    expect(t('打开 {0}', { 0: '世界观设定' })).toBe('Open 世界观设定')
    expect(message('模型请求失败（HTTP 401）。密钥无效或未填写，请重新填写 API 密钥。')).toBe(
      'Model request failed (HTTP 401). API key missing or invalid. Enter it again.',
    )
    setLanguage('zh-CN')
    expect(FIELDS.trpg.secrets).toBe('主持人秘密')
    expect(PROFILES.oc.label).toBe('OC 创作者')
    expect(message('Invalid room code')).toBe('房间码不正确')
  })
  it('includes translations for every literal translation key in the UI', () => {
    const catalog: Record<string, string> = { ...en, ...errors }
    const files: string[] = []
    function walk(dir: string) {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name)
        if (item.isDirectory()) walk(file)
        else if (/\.tsx?$/.test(file)) files.push(file)
      }
    }
    walk('src')
    const missing: string[] = []
    for (const file of files) {
      const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(tree) === 't' &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text
          if (!catalog[key]) missing.push(file + ': ' + key)
        }
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(missing).toEqual([])
  })
})
