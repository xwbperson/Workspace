export type IconName = 'timer' | 'book-open' | 'graduation-cap';
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
  canPin: boolean;
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
    canPin: true,
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
    canPin: true,
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
    canPin: true,
    capabilities: {
      focusCandidates: true,
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
