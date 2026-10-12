import { emptyStudio, parseDraft, type Draft } from './model'
import { readWorldSettings, type WorldSetting } from './worldSettings'
import { plainText } from '@/features/novel/model'
import { generateId } from '@/lib/utils'
import { t } from '@/lib/i18n'

export interface TrpgModule {
  id: string
  draft: Draft
  settings: WorldSetting[]
}
export function moduleFile(draft: Draft, settings: WorldSetting[]) {
  return { spec: 'wdworld_trpg', version: 1, draft: { ...draft, sessionLog: '' }, settings }
}
export function importModule(text: string, filename: string): TrpgModule {
  if (text.length > 2 * 1024 * 1024) throw new Error(t('跑团资料不能超过 2 MB'))
  let draft: Draft = { ...emptyStudio().drafts.trpg, name: filename.replace(/\.[^.]+$/, '') }
  let settings: WorldSetting[] = []
  if (/\.json$/i.test(filename)) {
    const data = JSON.parse(text)
    if (data?.spec === 'wdworld_trpg' && data.version === 1) {
      draft = parseDraft('trpg', JSON.stringify(data.draft))
      settings = readWorldSettings(data.settings)
    } else if (Array.isArray(data?.entries)) {
      settings = readWorldSettings(
        data.entries
          .filter((e: { status?: string }) => e.status !== 'archived')
          .map((e: { type: string; title: string; content: string }) => ({
            type: e.type,
            title: e.title,
            content: plainText(e.content),
          })),
      )
      draft.name = typeof data.project?.name === 'string' ? data.project.name : draft.name
      draft.scenes = settings.map((s) => `${s.title}\n${s.content}`).join('\n\n')
    } else throw new Error(t('请选择 TRPG 副本 JSON 或世界观导出 JSON'))
  } else if (/\.(txt|md|markdown)$/i.test(filename)) {
    draft.scenes = text
  } else throw new Error(t('支持 JSON、TXT 和 Markdown 文件'))
  draft.sessionLog = ''
  return { id: generateId('module'), draft, settings }
}
// Original, system-neutral one-shots; no licensed adventure text is bundled.
export function trpgPresets(): TrpgModule[] {
  const presets = [
    {
      name: t('奇幻探索：雾钟遗迹'),
      system: t('无系统叙事；2–5 人，约 2–3 小时。检定难度由主持人按所用规则换算。'),
      premise: t('山村每天黄昏都会听到废弃钟楼的钟声。昨夜，一队采药人走进雾中，至今没有回来。'),
      hooks: t('村长请求救援；古物学者悬赏寻找钟楼铭文；一名失踪者是玩家的旧友。'),
      scenes: t('村口：询问目击者。雾林：沿脚印或溪流抵达遗迹。钟楼：修复机关、谈判或破坏钟摆都能解困。'),
      npcs: t('村长岚：急于救人。守钟灵：履行被误解的约定。采药人青：知道安全的小路。'),
      clues: t('泥脚印、采药人的绳结、溪边回声都能指向钟楼；铭文可通过拓印、询问守灵或拼合石片解读。'),
      encounters: t(
        '藤蔓阻路可以绕行、砍开或协作攀越。失控钟摆可停机、引开或以盾抵挡；失败带来耗时或失物，不封死救援。',
      ),
      secrets: t('钟楼保护的是村庄水源；钟声将迷路者聚到安全地。商人私拆齿轮造成迷雾，归还齿轮即可恢复。'),
    },
    {
      name: t('悬疑调查：无声旅馆'),
      system: t('无系统调查；2–5 人，约 2–3 小时。关键线索无需一次检定成功才能取得。'),
      premise: t('暴雨封路，旅馆的客人被困一夜。午夜过后，所有收音机同时播出了一位失踪旅客的求助。'),
      hooks: t('调查失踪案；护送一名旅客；修复旅馆的通信设备。'),
      scenes: t('大厅收集证言；客房检查行李；地下机房寻找广播来源。顺序自由，时间推进会令积水上涨。'),
      npcs: t('店主苏：隐瞒债务。修理工白：害怕被怀疑。旅客林：保留了异常录音。'),
      clues: t('入住登记、湿脚印和一张修理单均指向旧机房；钥匙可借取、复制或从通风口绕入。'),
      encounters: t('停电与涨水造成时间压力。沟通失败可用证物佐证；搜索失败仍得到线索但消耗照明。'),
      secrets: t(
        '失踪旅客被困隔音储藏室，求助来自自制定时发射器。店主为躲债封门，未发现有人在内。终局可救援、曝光或谈判。',
      ),
    },
    {
      name: t('科幻求生：最后一班信标'),
      system: t('无系统求生；2–5 人，约 2–3 小时。由主持人记录氧气与能源，AI 只提供叙事建议。'),
      premise: t('货船在废弃空间站附近失去动力。救援窗口只剩三小时，空间站还在发出断续的引导信号。'),
      hooks: t('寻找燃料；救出信号发出者；保住船上的冷藏样本。'),
      scenes: t('气闸选择供能方式；生态舱寻找资源；控制室修复信标。可分头行动，但通信有延迟。'),
      npcs: t('维护机器人七号：严格遵守节能程序。工程师墨：困在冷却舱。救援船长：需要准确坐标。'),
      clues: t('维修日志、电缆温度和七号的记录都指向冷却故障；坐标可从导航缓存、星图或外部天线恢复。'),
      encounters: t(
        '失压舱可封堵、绕道或短暂穿越。有限电池可用于通信或生命维持；行动前说明可见代价，由玩家选择。',
      ),
      secrets: t(
        '引导信号来自工程师的手动开关。反应堆未爆炸，只是保护停机；救人后可低功率重启，也可弃站撤离。',
      ),
    },
  ]
  return presets.map((p, i) => ({
    id: `preset-${i}`,
    draft: { ...emptyStudio().drafts.trpg, ...p },
    settings: [],
  }))
}
