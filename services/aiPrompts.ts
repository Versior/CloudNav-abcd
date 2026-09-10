export type ContentSummaryKind = 'rss' | 'website' | 'workbench';

export interface ContentSummaryPromptInput {
  title?: string;
  url?: string;
  sourceTitle?: string;
  summary?: string;
}

const value = (input: ContentSummaryPromptInput, key: keyof ContentSummaryPromptInput, fallback: string) => {
  const raw = input[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
};

export const buildContentSummaryPrompt = (kind: ContentSummaryKind, input: ContentSummaryPromptInput) => {
  const title = value(input, 'title', '未知标题');
  const sourceTitle = value(input, 'sourceTitle', '未知来源');
  const url = value(input, 'url', '未知链接');
  const summary = value(input, 'summary', '无可用摘要');

  if (kind === 'website') {
    return {
      system: '你是中文网站研究编辑。只依据用户提供的网站标题、网址和已有描述进行归纳；不要臆测网站未提供的功能、数据、价格或安全结论。只返回合法 JSON，不要 Markdown，不要英文解释。',
      user: [
        '请分析 CloudNav 网站库，帮助读者快速理解这组入口的主题和使用价值。',
        '标题：' + title,
        '来源：' + sourceTitle,
        '网站资料：',
        summary,
        '',
        '输出 JSON：{"summary":"整体结论","facts":["资料中明确的事实"],"actions":["可执行的使用建议"],"evidence":["支持结论的原文信息；没有时写资料不足"],"tags":["主题标签"]}',
        '要求：简体中文；summary 不超过 120 字；bullets 3-5 条，每条不超过 60 字；tags 最多 6 个，每个不超过 18 字；优先概括主要用途、适合人群、资料中反复出现的主题和明确描述；资料不足时明确写“资料不足”，不要根据域名或标题脑补；不要把推测写成事实。',
      ].join('\n'),
    };
  }

  if (kind === 'workbench') {
    return {
      system: '你是中文个人工作台编辑。只依据提供的工作台数据生成清晰、可执行的简报；不虚构用户行为或任务状态。只返回合法 JSON，不要 Markdown。',
      user: [
        '请总结下面的 CloudNav 工作台数据，让用户快速知道当前重点。',
        '标题：' + title,
        '来源：' + sourceTitle,
        '数据：',
        summary,
        '',
        '输出 JSON：{"summary":"当前状态结论","facts":["数据中明确的事实"],"actions":["下一步建议"],"evidence":["支持结论的数据依据"],"tags":["主题标签"]}',
        '要求：简体中文；summary 不超过 120 字；bullets 3-5 条，每条不超过 60 字；tags 最多 6 个；只引用提供的数据；没有数据时写“暂无足够数据”，不要补写不存在的事实。',
      ].join('\n'),
    };
  }

  return {
    system: '你是中文资讯编辑和事实核对助手。只依据标题、来源、链接和原始摘要归纳；明确区分事实与推测，不把推测写成事实。只返回合法 JSON，不要 Markdown，不要英文解释。',
    user: [
      '请总结下面这篇文章，帮助读者在 20 秒内判断是否值得阅读。',
      '标题：' + title,
      '来源：' + sourceTitle,
      '链接：' + url,
      '原始摘要：' + summary,
      '',
      '输出 JSON：{"summary":"一句话结论","facts":["关键事实1","关键事实2"],"actions":["对读者的下一步建议；没有时写资料不足"],"evidence":["支持结论的原文信息；没有时写资料不足"],"tags":["标签1","标签2"]}',
      '要求：简体中文；summary 不超过 120 字；facts 3-5 条，每条不超过 60 字；actions 最多 3 条，每条不超过 60 字；evidence 最多 4 条，每条不超过 80 字；tags 最多 6 个，每个不超过 18 字；优先保留时间、人物、数字、结论和行动影响等明确内容；摘要缺失时写“原文摘要不足，无法确认更多细节”；不要臆造事实，不要把推测写成事实，不要把标题推断当成正文结论；证据必须来自输入资料。',
    ].join('\n'),
  };
};
