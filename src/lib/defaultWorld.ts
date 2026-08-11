import type { Database } from '@/lib/storage/database'
import { BUILTIN_ASSET_PATHS } from '@/lib/assetSources'

export const EXAMPLE_PROJECT_NAME = '神秘复苏示例：雾港档案'
export const EXAMPLE_PROJECT_DESCRIPTION = '原创灵异生存示例：诡异遵循规则，力量伴随代价。'
export const DEFAULT_MAP_ASSET_PATH = BUILTIN_ASSET_PATHS.map

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

  return { mapAssetId: mapAsset.id }
}
