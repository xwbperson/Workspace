export type IconName =
  | 'timer'
  | 'book-open'
  | 'graduation-cap'
  | 'target'
  | 'list-checks'
  | 'calendar-days'
  | 'calendar-clock'
  | 'inbox'
  | 'credit-card'
  | 'wallet-cards'
  | 'hourglass';
export type FeatureCategory =
  | 'planning-execution'
  | 'notes-knowledge'
  | 'time-reminders'
  | 'goals-review'
  | 'files-collections'
  | 'tools';

export interface WorkbenchFeatureDefinition {
  featureId: string;
  name: string;
  description: string;
  icon: IconName;
  route: string;
  category: FeatureCategory;
  keywords: string[];
  order: number;
  lifecycle: 'released' | 'preview' | 'in-development';
  discoverableInProduction: boolean;
  capabilities: {
    focusCandidates?: boolean;
    upcoming?: boolean;
    recent?: boolean;
    overviewBlocks?: boolean;
    search?: boolean;
    quickCreate?: boolean;
    notifications?: boolean;
  };
}

export const featureCatalog: readonly WorkbenchFeatureDefinition[] = [
  {
    featureId: 'countdowns',
    name: '倒计时',
    description: '把重要日期放到清晰的时间轨道上。',
    icon: 'timer',
    route: '/features/countdowns',
    category: 'time-reminders',
    keywords: ['日期', '时间', '提醒', '纪念日', '截止'],
    order: 10,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      focusCandidates: true,
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
      notifications: true,
    },
  },
  {
    featureId: 'books',
    name: '书籍管理',
    description: '管理书目、章节页码与阅读进度。',
    icon: 'book-open',
    route: '/features/books',
    category: 'notes-knowledge',
    keywords: ['书籍', '阅读', '章节', 'ISBN', '进度', '参考书'],
    order: 20,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'courses',
    name: '课程管理',
    description: '管理课程、上课记录、作业、资料和大纲。',
    icon: 'graduation-cap',
    route: '/features/courses',
    category: 'planning-execution',
    keywords: ['课程', '教师', '学分', '学时', '作业', '教学大纲', '资料'],
    order: 30,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      focusCandidates: true,
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'goals',
    name: '目标管理',
    description: '管理年度、季度和月度目标，用数值与关键结果记录变化。',
    icon: 'target',
    route: '/features/goals',
    category: 'goals-review',
    keywords: ['目标', '年度', '季度', '月度', '关键结果', '进度', '数据'],
    order: 40,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      focusCandidates: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'tasks',
    name: '任务管理',
    description: '管理多级任务、优先级、截止时间与自动滚动的重复事项。',
    icon: 'list-checks',
    route: '/features/tasks',
    category: 'planning-execution',
    keywords: ['任务', '待办', '子任务', '优先级', '截止', '重复'],
    order: 50,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      focusCandidates: true,
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'calendar',
    name: '日程管理',
    description: '用月历安排每天的行程，并记录日记和当日总结。',
    icon: 'calendar-days',
    route: '/features/calendar',
    category: 'time-reminders',
    keywords: ['日程', '日历', '行程', '日记', '总结', '日期'],
    order: 60,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'timetable',
    name: '课程表',
    description: '按教学周查看课程、教师、教室和临时调课。',
    icon: 'calendar-clock',
    route: '/features/timetable',
    category: 'time-reminders',
    keywords: ['课表', '课程', '上课', '教师', '教室', '周次', '调课'],
    order: 65,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'inbox',
    name: '收集箱',
    description: '收集想法、片段、网址和文件，作为多设备处理队列。',
    icon: 'inbox',
    route: '/features/inbox',
    category: 'files-collections',
    keywords: ['收集箱', '想法', '灵感', '片段', '网址', '文件', '中转'],
    order: 70,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: { recent: true, overviewBlocks: true, search: true, quickCreate: true },
  },
  {
    featureId: 'subscriptions',
    name: '订阅管理',
    description: '管理软件、会员、域名和服务器续费，并折算月均成本。',
    icon: 'credit-card',
    route: '/features/subscriptions',
    category: 'tools',
    keywords: ['订阅', '续费', '会员', '域名', '服务器', '费用'],
    order: 80,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
  {
    featureId: 'finance',
    name: '财务管理',
    description: '汇总资金账户、信用额度和月度负债，查看年度趋势。',
    icon: 'wallet-cards',
    route: '/features/finance',
    category: 'tools',
    keywords: ['财务', '账户', '资产', '负债', '信用卡', '余额'],
    order: 90,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: { recent: true, overviewBlocks: true, search: true, quickCreate: true },
  },
  {
    featureId: 'life-countdown',
    name: '人生倒计时',
    description: '查看人生、今年和今天的时间进度，记录重要人生节点。',
    icon: 'hourglass',
    route: '/features/life-countdown',
    category: 'time-reminders',
    keywords: ['人生', '倒计时', '寿命', '时间', '事件', '纪念日'],
    order: 100,
    lifecycle: 'released',
    discoverableInProduction: true,
    capabilities: {
      upcoming: true,
      recent: true,
      overviewBlocks: true,
      search: true,
      quickCreate: true,
    },
  },
] as const;

export const featureCategories: Readonly<Record<FeatureCategory, string>> = {
  'planning-execution': '计划与执行',
  'notes-knowledge': '记录与知识',
  'time-reminders': '时间与提醒',
  'goals-review': '目标与复盘',
  'files-collections': '文件与收藏',
  tools: '工具',
};
