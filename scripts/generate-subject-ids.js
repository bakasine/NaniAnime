import { mkdir, writeFile } from 'node:fs/promises';

const BANGUMI_SUBJECTS_URL = 'https://api.bgm.tv/v0/subjects';
const BANGUMI_USER_AGENT = 'uerax/NaniAnime';
const PAGE_LIMIT = Number(process.env.PAGE_LIMIT || 50);
const PAGE_CONCURRENCY = Number(process.env.PAGE_CONCURRENCY || 3);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 10000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 800);
const OUTPUT_DIR = new URL('../public/data/subject-ids/', import.meta.url);
const SUBJECT_TYPES = {
  anime: {
    type: 2,
    label: '动漫',
    output: new URL('anime.json', OUTPUT_DIR),
  },
  book: {
    type: 1,
    label: '漫画小说',
    output: new URL('book.json', OUTPUT_DIR),
  },
  drama: {
    type: 6,
    label: '三次元',
    output: new URL('drama.json', OUTPUT_DIR),
  },
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': BANGUMI_USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildSubjectsUrl(subjectType, offset) {
  const params = new URLSearchParams({
    type: String(subjectType.type),
    sort: 'date',
    limit: String(PAGE_LIMIT),
    offset: String(offset),
  });

  return `${BANGUMI_SUBJECTS_URL}?${params}`;
}

async function fetchSubjectsPage(subjectKey, subjectType, offset) {
  const url = buildSubjectsUrl(subjectType, offset);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`Bangumi API 返回 ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(`${subjectKey} offset=${offset} 获取失败：${error.message}`);
      }

      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`${subjectKey} offset=${offset} 获取失败`);
}

function extractSubjectIds(page, subjectType) {
  if (!Array.isArray(page.data)) {
    return [];
  }

  return page.data
    .filter((subject) => Number.isInteger(subject?.id) && subject.type === subjectType.type)
    .map((subject) => subject.id);
}

async function collectSubjectIds(subjectKey, subjectType) {
  console.log(`开始生成 ${subjectType.label} ID：type=${subjectType.type}`);

  const firstPage = await fetchSubjectsPage(subjectKey, subjectType, 0);
  const total = Number(firstPage.total);

  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`${subjectKey} total 无效：${firstPage.total}`);
  }

  const subjectIds = new Set(extractSubjectIds(firstPage, subjectType));
  const offsets = [];

  for (let offset = PAGE_LIMIT; offset < total; offset += PAGE_LIMIT) {
    offsets.push(offset);
  }

  let nextIndex = 0;
  const failures = [];

  async function worker() {
    while (nextIndex < offsets.length) {
      const offset = offsets[nextIndex];
      nextIndex += 1;

      try {
        const page = await fetchSubjectsPage(subjectKey, subjectType, offset);
        extractSubjectIds(page, subjectType).forEach((id) => subjectIds.add(id));
      } catch (error) {
        failures.push({ offset, message: error.message });
      }

      const finishedCount = nextIndex + 1;

      if (finishedCount % 50 === 0 || finishedCount >= offsets.length + 1) {
        console.log(`${subjectType.label} 进度：${Math.min(finishedCount, offsets.length + 1)}/${offsets.length + 1}，已收集 ${subjectIds.size}/${total}`);
      }
    }
  }

  const workerCount = Math.min(PAGE_CONCURRENCY, offsets.length || 1);
  await Promise.all(Array.from({ length: workerCount }, worker));

  if (failures.length > 0) {
    throw new Error(`${subjectKey} 有 ${failures.length} 个 offset 获取失败：${JSON.stringify(failures.slice(0, 5))}`);
  }

  const sortedIds = [...subjectIds].sort((left, right) => left - right);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(subjectType.output, `${JSON.stringify(sortedIds)}\n`, 'utf8');

  console.log(`${subjectType.label} 完成：写入 ${sortedIds.length} 个 ID -> ${subjectType.output.pathname}`);
}

async function main() {
  const requestedKeys = process.argv.slice(2);
  const subjectKeys = requestedKeys.length > 0 ? requestedKeys : Object.keys(SUBJECT_TYPES);

  for (const subjectKey of subjectKeys) {
    const subjectType = SUBJECT_TYPES[subjectKey];

    if (!subjectType) {
      throw new Error(`未知类型：${subjectKey}，可选：${Object.keys(SUBJECT_TYPES).join(', ')}`);
    }

    await collectSubjectIds(subjectKey, subjectType);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
