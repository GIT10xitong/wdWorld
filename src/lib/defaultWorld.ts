import type { Database } from '@/lib/storage/database'
import { BUILTIN_ASSET_PATHS } from '@/lib/assetSources'

export const EXAMPLE_PROJECT_NAME = '神秘复苏示例：雾港档案'
export const EXAMPLE_PROJECT_DESCRIPTION = '原创灵异生存示例：诡异遵循规则，力量伴随代价。'
export const DEFAULT_MAP_ASSET_PATH = BUILTIN_ASSET_PATHS.map
export const EXAMPLE_CONTENT_VERSION = 2

/** Adds the feature-rich second chapter to old and newly created example projects. */
export async function enhanceMysteryRevivalWorld(database: Database, projectId: string): Promise<void> {
  const existingEntries = await database.listEntries(projectId)
  if (existingEntries.some((entry) => entry.title === '周岚')) return

  const entryByTitle = new Map(existingEntries.map((entry) => [entry.title, entry]))
  const existingTags = await database.getTags(projectId)
  const ensureTag = async (name: string, color: string) =>
    existingTags.find((tag) => tag.name === name) ?? database.createTag(projectId, name, color)
  const [clueTag, containedTag, unresolvedTag, dangerTag] = await Promise.all([
    ensureTag('调查线索', '#06b6d4'),
    ensureTag('暂时收容', '#22c55e'),
    ensureTag('未解事件', '#f59e0b'),
    ensureTag('高危区域', '#64748b'),
  ])

  const [analyst, missingAgent, silenceIncident, broadcastRoom, classPhoto] = await Promise.all([
    database.createEntry(
      projectId,
      'character',
      '周岚',
      '调查局档案分析员，擅长从被篡改的记录中辨认“缺席者”。',
      `## 人物档案

三十四岁，原市档案馆修复师。她无法驾驭诡异，却能注意到被灵异力量删除后留下的格式空洞。

## 调查方法

- 对照纸质档案与电子副本的页码差异；
- 用红线标记所有“语法正确但没有主语”的句子；
- 从不在零点后阅读名单。

## 隐瞒事项

周岚早已在1998届七中毕业照中见过林默，但她没有把这件事写进正式报告。`,
    ),
    database.createEntry(
      projectId,
      'character',
      '陈渡',
      '三年前失踪的调查员，他的编号仍在系统中持续提交值班记录。',
      `## 失踪经过

陈渡在调查七中旧广播室时失联。最后一段录音只有粉笔书写声，以及一句反复出现的提示：“别让它点完名。”

## 当前疑点

他的门禁卡每周三凌晨会刷开调查局地下档案库，但监控画面中没有任何人。`,
    ),
    database.createEntry(
      projectId,
      'event',
      '七中静默事件',
      '一场被全市档案共同遗忘的集体失踪，是雾港异常的早期源头。',
      `## 已还原经过

1998年秋，七中晚自习期间有一整个班级从教学楼中消失。次日，校方名册、家长记忆与新闻记录同时发生改写，只留下数量对不上的课桌。

## 事件闭环

广播点名会删除“被确认存在的人”；无声影能暂时中断确认；旧课表则保存着尚未被点完的名单。

## 当前风险

雾港敲门事件正在把失踪者的声音送回现实，两个事件可能即将合并。`,
    ),
    database.createEntry(
      projectId,
      'location',
      '七中旧广播室',
      '位于不存在的第四层尽头，广播设备没有电源却始终保持温热。',
      `## 空间规则

门牌只会在广播念到第二个名字后出现。进入者必须带走一件物品，否则离开时会遗忘自己来过这里。

## 现场证据

控制台内藏有一盘标注“1998·秋”的磁带；墙后传来规律敲击，与雾港公寓录音完全一致。`,
    ),
    database.createEntry(
      projectId,
      'item',
      '证物：1998届合照',
      '照片人数会随广播点名减少，背面却会增加对应姓名。',
      `## 外观

褪色的三排合照，拍摄地点是七中操场。照片中共有四十二把椅子，但任何时候都只能数出四十一名学生。

## 观察记录

林默与周岚都出现在照片边缘，年龄却与拍摄年份不符。不要在镜子前翻看照片背面。`,
    ),
  ])

  await Promise.all([
    database.updateEntry(analyst.id, { status: 'active', visibility: 'internal' }),
    database.updateEntry(missingAgent.id, { status: 'complete', visibility: 'internal' }),
    database.updateEntry(silenceIncident.id, {
      status: 'active',
      visibility: 'internal',
      region: '雾港旧城区',
      condition: '疑似重新活跃',
      occupants: '失踪人数：42（记录仅承认41）',
    }),
    database.updateEntry(broadcastRoom.id, {
      status: 'active',
      region: '雾港第七中学·第四层',
      condition: '封锁中',
      occupants: '陈渡（状态未知）',
    }),
    database.updateEntry(classPhoto.id, { status: 'active', condition: '低温密封保存' }),
  ])

  await Promise.all([
    database.createAlias(analyst.id, '红笔档案员'),
    database.createAlias(missingAgent.id, 'D-17'),
    database.createAlias(silenceIncident.id, '1998届消失案'),
    database.createAlias(broadcastRoom.id, '不存在的第四层'),
    database.createAlias(classPhoto.id, '第四十二人'),
    database.addTagToEntry(analyst.id, clueTag.id),
    database.addTagToEntry(missingAgent.id, clueTag.id),
    database.addTagToEntry(silenceIncident.id, clueTag.id),
    database.addTagToEntry(silenceIncident.id, unresolvedTag.id),
    database.addTagToEntry(broadcastRoom.id, dangerTag.id),
    database.addTagToEntry(classPhoto.id, clueTag.id),
    database.addTagToEntry(classPhoto.id, containedTag.id),
  ])

  const requireEntry = (title: string) => {
    const entry = entryByTitle.get(title)
    if (!entry) throw new Error(`示例世界缺少基础条目：${title}`)
    return entry
  }
  const investigator = requireEntry('林默')
  const bureau = requireEntry('异常事件调查局')
  const school = requireEntry('雾港第七中学')
  const incident = requireEntry('雾港敲门事件')
  const umbrella = requireEntry('收容物：黑伞')

  await Promise.all([
    database.createRelation(projectId, analyst.id, bureau.id, 'member_of', '档案与情报组'),
    database.createRelation(projectId, analyst.id, investigator.id, 'colleague_of', '雾港联合调查搭档'),
    database.createRelation(projectId, missingAgent.id, school.id, 'discovered', '失踪前定位到旧广播室'),
    database.createRelation(projectId, silenceIncident.id, school.id, 'located_in', '事件发生地点'),
    database.createRelation(
      projectId,
      silenceIncident.id,
      classPhoto.id,
      'related',
      '唯一未被完全改写的物证',
    ),
    database.createRelation(projectId, incident.id, silenceIncident.id, 'related', '声音与失踪规律正在合并'),
    database.createRelation(
      projectId,
      missingAgent.id,
      incident.id,
      'participated_in',
      '失踪后仍发送事件记录',
    ),
    database.createRelation(projectId, broadcastRoom.id, school.id, 'part_of', '不存在的第四层'),
    database.createRelation(projectId, umbrella.id, classPhoto.id, 'related', '伞面冷水会显现照片背面的姓名'),
    database.addBacklink(projectId, analyst.id, investigator.id, '1998届合照中的林默'),
    database.addBacklink(projectId, classPhoto.id, silenceIncident.id, '人数随点名变化'),
    database.addBacklink(projectId, broadcastRoom.id, incident.id, '敲击录音一致'),
  ])

  await Promise.all([
    database.createTimelineEvent(
      silenceIncident.id,
      '1998年·第0夜',
      '最后一次晚自习',
      1,
      '四十二名学生进入主楼。',
    ),
    database.createTimelineEvent(
      silenceIncident.id,
      '1998年·第1日',
      '全班从记录中消失',
      2,
      '档案被同步改写，只剩数量异常。',
    ),
    database.createTimelineEvent(
      silenceIncident.id,
      '三年前',
      '陈渡重启调查',
      40,
      '旧广播室首次被现代调查员定位。',
    ),
    database.createTimelineEvent(
      silenceIncident.id,
      '现在',
      '两个事件开始合并',
      90,
      '雾港失踪者电话出现点名广播。',
    ),
  ])

  const anchor = await database.createAnchor(
    school.id,
    '旧广播室入口',
    0.78,
    0.22,
    '广播念到第二个名字后，第四层走廊尽头出现门牌。',
  )
  await database.updateEntryAnchor(broadcastRoom.id, anchor.id)
  await Promise.all([
    database.updateEntryMapPosition(broadcastRoom.id, 0.6, 0.14),
    database.updateEntryMapPosition(silenceIncident.id, 0.55, 0.2),
    database.updateEntryMapPosition(analyst.id, 0.66, 0.42),
  ])

  const fieldSchemas = await database.listFieldSchemas(projectId)
  const riskField =
    fieldSchemas.find((field) => field.id === 'example_event_risk') ??
    (await database.createCustomFieldSchema(projectId, {
      id: 'example_event_risk',
      key: 'event_risk',
      label: '事件等级',
      type: 'select',
      entryType: 'event',
      options: ['C级', 'B级', 'A级', 'S级'],
      sortOrder: 5,
      group: '调查局评估',
    }))
  await Promise.all([
    database.upsertFieldValue(incident.id, riskField.id, 'A级'),
    database.upsertFieldValue(silenceIncident.id, riskField.id, 'A级'),
  ])

  const templates = await database.getTemplates(projectId)
  if (!templates.some((template) => template.name === '灵异事件调查档案')) {
    await database.createTemplate(
      projectId,
      '灵异事件调查档案',
      'event',
      '用于记录触发条件、生存规则与未确认线索。',
      '## 现象\n\n## 触发条件\n\n## 行动规律\n\n## 规避方式\n\n## 未确认线索',
      ['未解事件'],
      ['事件代号'],
    )
  }
}

/** Creates the original supernatural-horror example world. */
export async function seedMysteryRevivalWorld(
  database: Database,
  projectId: string,
): Promise<{ mapAssetId: string }> {
  const tags = await Promise.all([
    database.createTag(projectId, '灵异规则', '#ef4444'),
    database.createTag(projectId, '驭诡者', '#8b5cf6'),
    database.createTag(projectId, '未解事件', '#f59e0b'),
    database.createTag(projectId, '高危区域', '#64748b'),
  ])

  const [rules, revival, city, school, bureau, investigator, umbrella, incident, fogZone, hooks] =
    await Promise.all([
      database.createEntry(
        projectId,
        'lore',
        '核心法则：诡异复苏',
        '诡异遵循固定的杀人规律，无法被常规手段彻底消灭。',
        `## 世界真相

诡异并非生物，而是由残缺执念与超自然规则形成的现象。它们没有善恶，也不会被沟通，只会机械地执行自身规律。

## 三条铁律

1. **诡异无法被常规力量杀死**：只能限制、转移或暂时封存。
2. **洞察规律才能活下去**：每起事件都有触发条件、行动范围与规避方式。
3. **驾驭诡异必有代价**：借用力量越频繁，体内的诡异复苏越快。

## 故事基调

调查不是为了战胜恐惧，而是在有限时间里寻找一条仍能活着离开的路。`,
      ),
      database.createEntry(
        projectId,
        'lore',
        '驭诡者与复苏倒计时',
        '少数幸存者将诡异封入身体，以寿命和人性换取对抗灵异的能力。',
        `## 驭诡者

驭诡者能够短暂调用一种诡异规则，但每次使用都会加深侵蚀。典型征兆包括体温消失、记忆断层、情绪淡化与身体异常。

## 平衡方式

- 驾驭第二种相互制衡的诡异；
- 使用特殊容器延缓复苏；
- 主动减少能力使用次数；
- 完成诡异执念，但成功率极低。

当平衡彻底破裂，驭诡者会成为新的灵异事件源头。`,
      ),
      database.createEntry(
        projectId,
        'location',
        '临江市',
        '沿海工业城，近期灵异警情数量异常上升。',
        `## 城市概况

临江市常住人口八百万，旧城区、雾港和新金融区被环城河分割。近三个月，城市监控频繁出现无法解释的灰雾与时间缺口。

## 当前状态

- 风险等级：橙色
- 负责人：林默
- 已知事件：雾港敲门事件、七中静默区
- 疏散预案：尚未公开启动`,
      ),
      database.createEntry(
        projectId,
        'location',
        '雾港第七中学',
        '凌晨零点后，教学楼会出现一条不属于现实的第四层走廊。',
        `## 异常现象

零点后的第七中学无法通过正门离开。主楼广播会依次念出仍在校内的人名，被念到第三次的人会从所有照片与记录中消失。

## 生存线索

- 不要回应广播中的名字；
- 楼梯只上不下时，寻找贴有旧课表的教室；
- 黑板上的缺席人数可能代表安全出口剩余次数。`,
      ),
      database.createEntry(
        projectId,
        'faction',
        '异常事件调查局',
        '负责封锁、调查与收容灵异事件的跨区域机构。',
        `## 职责

调查局维护灵异档案、调度城市负责人，并在事件失控时执行区域封锁。公开身份是重大灾害应急协调中心。

## 内部矛盾

行动派主张优先控制事件，研究派希望保留诡异样本，保全派则把平民伤亡率视为唯一指标。三方在“雾港计划”上存在严重分歧。`,
      ),
      database.createEntry(
        projectId,
        'character',
        '林默',
        '临江市新任负责人，能够借助影子短暂隔绝灵异影响。',
        `## 人物档案

前刑警，二十九岁。在一次电梯失踪案中成为唯一幸存者，并驾驭了“无声影”。

## 能力与代价

当林默屏住呼吸时，影子可以覆盖一小片区域，使其中的声音与灵异感知暂时中断。每次使用后，他都会永久失去一段与声音有关的记忆。

## 当前目标

在复苏前查清七中事件与自己少年时期的一次集体失踪是否有关。`,
      ),
      database.createEntry(
        projectId,
        'item',
        '收容物：黑伞',
        '撑开后可让持有者暂时不被诡异视为目标，但伞下必须保持人数不变。',
        `## 使用规则

黑伞撑开时，伞下的人不会成为新目标。若有人进入或离开，保护立即失效，伞面会开始滴落来源不明的冷水。

## 收容方式

保持合拢，存放在无镜面、恒定照明的金属柜中。任何情况下不得在室内确认伞下人数。`,
      ),
      database.createEntry(
        projectId,
        'event',
        '雾港敲门事件',
        '连续七夜，港区居民会在凌晨听到来自屋内的敲门声。',
        `## 事件规律

敲门声并非来自门外，而是从屋内某个封闭空间传出。打开错误的门后，房间会被灰雾替换，进入者失踪。

## 已知触发条件

- 听见第一轮敲门后主动说话；
- 在镜面中寻找声源；
- 连续忽略七轮敲门。

## 待确认线索

失踪者的手机会在次日同一时间拨打家属电话，背景音疑似来自第七中学广播站。`,
      ),
      database.createEntry(
        projectId,
        'region',
        '灰雾区',
        '被灵异力量覆盖、现实规则持续失真的封锁区域。',
        `## 区域特征

灰雾会削弱方向感和时间感，电子设备显示的时间彼此矛盾。区域边界并不固定，会沿着“被遗忘的路线”扩张。

## 进入守则

以机械表计时；每十分钟核对一次同行者身份；不要沿原路返回；若看见自己的背影，立刻闭眼并停止移动。`,
      ),
      database.createEntry(
        projectId,
        'note',
        '开篇故事钩子',
        '可直接展开第一章或第一次跑团的五个切入点。',
        `1. 调查局收到一通来自三年前失踪探员的求救电话，定位在七中第四层。
2. 林默发现自己的档案中多出一张少年合照，但照片里所有人都没有影子。
3. 黑伞收容柜内侧出现潮湿脚印，数量每天增加一双。
4. 雾港事件的幸存者都记得同一位不存在的班主任。
5. 城市广播提前播报了明天的失踪者名单，其中最后一个名字是临江市本身。`,
      ),
    ])

  const tagAssignments = [
    [rules.id, tags[0].id],
    [revival.id, tags[0].id],
    [revival.id, tags[1].id],
    [investigator.id, tags[1].id],
    [incident.id, tags[2].id],
    [school.id, tags[2].id],
    [fogZone.id, tags[3].id],
    [city.id, tags[3].id],
    [hooks.id, tags[2].id],
  ]
  await Promise.all(tagAssignments.map(([entryId, tagId]) => database.addTagToEntry(entryId, tagId)))

  await Promise.all([
    database.createRelation(projectId, investigator.id, bureau.id, 'member_of', '临江市负责人'),
    database.createRelation(projectId, investigator.id, city.id, 'stationed_at', '负责临江市灵异事件'),
    database.createRelation(projectId, investigator.id, umbrella.id, 'user_of', '紧急行动授权使用'),
    database.createRelation(projectId, incident.id, city.id, 'located_in', '事件中心位于雾港旧城区'),
    database.createRelation(projectId, school.id, city.id, 'located_in', '旧城区北侧'),
    database.createRelation(projectId, incident.id, school.id, 'related', '失踪者电话中出现学校广播'),
    database.createRelation(projectId, fogZone.id, incident.id, 'caused', '敲门事件导致灰雾扩张'),
    database.createRelation(projectId, rules.id, revival.id, 'related', '能力体系建立在核心法则之上'),
  ])

  await database.createEra(
    projectId,
    null,
    '复苏纪元',
    '复苏纪',
    0,
    999,
    '诡异事件进入全球性增长阶段。',
    '#7c3aed',
  )
  await Promise.all([
    database.createTimelineEvent(
      incident.id,
      '第1夜',
      '第一起失踪案',
      10,
      '雾港公寓一户三人从封闭房间内消失。',
    ),
    database.createTimelineEvent(
      incident.id,
      '第3夜',
      '调查局介入',
      30,
      '事件被临时评定为B级，港区开始秘密疏散。',
    ),
    database.createTimelineEvent(incident.id, '第7夜', '灰雾越界', 70, '灰雾首次跨过环城河，风险等级上调。'),
  ])

  const [mapAsset, linMoAsset, umbrellaAsset, schoolAsset] = await Promise.all([
    database.createAsset(
      projectId,
      'map_image',
      '临江市调查地图.png',
      BUILTIN_ASSET_PATHS.map,
      'image/png',
      2838691,
    ),
    database.createAsset(projectId, 'cover', '林默.png', BUILTIN_ASSET_PATHS.linMo, 'image/png', 1753962),
    database.createAsset(
      projectId,
      'cover',
      '收容物-黑伞.png',
      BUILTIN_ASSET_PATHS.blackUmbrella,
      'image/png',
      2243848,
    ),
    database.createAsset(
      projectId,
      'cover',
      '雾港第七中学.png',
      BUILTIN_ASSET_PATHS.seventhSchool,
      'image/png',
      1692064,
    ),
  ])
  await Promise.all([
    database.updateEntryCoverAsset(investigator.id, linMoAsset.id),
    database.updateEntryCoverAsset(umbrella.id, umbrellaAsset.id),
    database.updateEntryCoverAsset(school.id, schoolAsset.id),
    database.updateEntryMapPosition(city.id, 0.63, 0.43),
    database.updateEntryMapPosition(school.id, 0.58, 0.16),
    database.updateEntryMapPosition(incident.id, 0.26, 0.68),
    database.updateEntryMapPosition(fogZone.id, 0.17, 0.73),
    database.updateEntryMapPosition(bureau.id, 0.69, 0.39),
    database.updateEntryMapPosition(investigator.id, 0.61, 0.48),
  ])

  await enhanceMysteryRevivalWorld(database, projectId)

  return { mapAssetId: mapAsset.id }
}
