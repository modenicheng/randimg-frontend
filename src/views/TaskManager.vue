<script setup lang="ts">
import Axios from '../axios/axios';
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { mdiPlus, mdiCancel, mdiStopCircleOutline, mdiBroom, mdiChevronRight, mdiChevronDown, mdiFormatListChecks, mdiCheckboxBlankOutline } from '@mdi/js';
import { formatDate } from '../utils/formatDate';

/** Core task data returned by both /tasks/roots and /tasks/{id}/tree?flatten=true. */
interface Task {
  id: string;
  taskType: string;       // snake_case from backend: task_type
  status: string;
  rawStatus?: string;     // raw_status before derived-status rollup
  retryCount: number;     // retry_count
  createdAt: string;      // created_at
  updatedAt?: string;     // updated_at
  completedAt: string | null;  // completed_at
  errorMessage: string | null; // error_message
  rootId?: string | null;      // root_id
  crawlerId?: number | null;   // crawler_id
  imageId?: number | null;     // image_id
  payload?: any;
  /** Direct parent job ID (only present in flattened tree view). */
  parent_job_id?: string;
  /** Root job ID (only present in flattened tree view). */
  root_job_id?: string;
}

/** Per-root subtask state (flattened, server-side pagination). */
interface SubtaskState {
  items: Task[];
  loading: boolean;
  loaded: boolean;         // true after first load → only re-fetch on explicit action
  filterType: string | null;
  filterStatus: string | null;
  // Pagination
  total: number;
  page: number;
  pageInput: number | null;
  pageSize: number;
}

const statusColor: Record<string, string> = {
  pending:          'blue',
  running:          'orange',
  completed:        'green',
  failed:           'orange',
  killed:           'red',
  partial_success:  'amber',
  queue:            'blue',
  queued:           'blue',
  done:             'green',
};

const statusLabel: Record<string, string> = {
  pending:          '待处理',
  running:          '运行中',
  completed:        '已完成',
  failed:           '重试中',
  killed:           '失败',
  partial_success:  '部分成功',
  queue:            '待处理',
  queued:           '待处理',
  done:             '已完成',
};

const jobLabel: Record<string, string> = {
  crawl:               '爬取',
  download:            '下载',
  color_extract:       '颜色提取',
  upload:              '上传',
  accessibility_check: '合规检查',
  discover:            '发现',
  refresh_pixiv_token: '刷新Token',
  cleanup:             '清理',
};

const typeItems = [
  { title: '全部', value: null },
  { title: '爬取：按用户', value: 'crawl:1' },
  { title: '爬取：按收藏', value: 'crawl:2' },
  { title: '爬取：按日榜', value: 'crawl:0' },
  { title: '凭证更新', value: 'refresh_pixiv_token' },
];

/** Type filter items for subtask panels — subtasks are download/upload/etc, not crawl roots. */
const subtaskTypeItems = [
  { title: '全部', value: null },
  { title: '下载', value: 'download' },
  { title: '颜色提取', value: 'color_extract' },
  { title: '上传', value: 'upload' },
  { title: '合规检查', value: 'accessibility_check' },
  { title: '发现', value: 'discover' },
  { title: '清理', value: 'cleanup' },
  { title: '爬取：按用户', value: 'crawl:1' },
  { title: '爬取：按收藏', value: 'crawl:2' },
  { title: '爬取：按日榜', value: 'crawl:0' },
  { title: '凭证更新', value: 'refresh_pixiv_token' },
];

const statusItems = [
  { title: '全部', value: null },
  { title: '待处理', value: 'pending' },
  { title: '运行中', value: 'running' },
  { title: '已完成', value: 'completed' },
  { title: '重试中', value: 'failed' },
  { title: '失败', value: 'killed' },
  { title: '部分成功', value: 'partial_success' },
];

const crawlTypeItems = [
  { title: '排名爬取', value: 0 },
  { title: '用户爬取', value: 1 },
  { title: '收藏爬取', value: 2 },
];

const rankingModeItems = [
  { title: '日榜', value: 'day' },
  { title: '周榜', value: 'week' },
  { title: '月榜', value: 'month' },
  { title: '原创榜', value: 'original' },
  { title: '新人榜', value: 'rookie' },
  { title: 'R18 日榜', value: 'daily_r18' },
  { title: 'R18 周榜', value: 'weekly_r18' },
];

const illustTypeFilterItems = [
  { title: '插画', value: 'illust' },
  { title: '漫画', value: 'manga' },
  { title: '动图', value: 'ugoira' },
];

const seedMethodItems = [
  { title: '流行度', value: 'popularity' },
  { title: '浏览量', value: 'views' },
  { title: '收藏量', value: 'bookmarks' },
  { title: '随机', value: 'random' },
];

/** Sort priority: running → pending → retrying/failed → completed */
const statusOrder: Record<string, number> = {
  running: 0, pending: 1, partial_success: 2, failed: 3, killed: 4, completed: 5,
  queue: 1, queued: 1, done: 5,
};

const normalizeStatus = (status: string | null | undefined): string => {
  switch (status) {
    case 'done':
      return 'completed';
    case 'queue':
    case 'queued':
      return 'pending';
    default:
      return status ?? '';
  }
};

const treeStatusParam = (status: string | null): string | null => {
  switch (status) {
    case 'completed':
      return 'done';
    case 'pending':
      return 'queue';
    default:
      return status;
  }
};

const rootTasks   = ref<Task[]>([]);
const total         = ref(0);
const page          = ref(1);
const loading       = ref(false);
const pageSize      = ref(10);
const filterType    = ref<string | null>(null);
const filterStatus  = ref<string | null>(null);

/** Map root task id → subtask state. Populated lazily on panel open. */
const subtaskMap    = reactive<Record<string, SubtaskState>>({});

/** Set of root task ids whose subtask-panel is currently expanded. */
const expandedRoots = ref<Set<string>>(new Set());

const createDialog  = ref(false);
const creating      = ref(false);
const createFormRef = ref<any>(null);
const cancelDialog  = ref(false);
const cancelId      = ref<string | null>(null);
const cancelIsRoot  = ref(true);
const cancelling    = ref(false);

const interruptDialog = ref(false);
const interruptId     = ref<string | null>(null);
const interrupting    = ref(false);

const cancelAllDialog = ref(false);
const cancellingAll   = ref(false);

const cleanDialog  = ref(false);
const cleaning     = ref(false);
const cleanFlags   = ref<string[]>([]);
const cleanType    = ref<string | null>(null);

const cleanFlagItems = [
  { title: '已完成', value: 'completed' },
  { title: '重试中', value: 'failed' },
  { title: '失败', value: 'killed' },
  { title: '待处理', value: 'pending' },
  { title: '运行中', value: 'running' },
];

const scrollContainer = ref<HTMLElement | null>(null);
/** Polling timer ID — refetched every POLL_INTERVAL ms while any task is active. */
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollRequestLocked = false;
const POLL_INTERVAL = 5000; // 5 seconds

type CrawlType = 0 | 1 | 2;

interface CreateCrawlerForm {
  crawl_type: CrawlType;
  task_name: string;
  target_user_id: string;
  target_date_range: Date[];
  target_search_prompt: string;
  ranking_mode: string;
  illust_type_filter: string[];
  exclude_r18: boolean;
  exclude_ai: boolean;
  max_pages: number;
  disable_discover: boolean;
  discover_hops: number;
  discover_seed_limit: number;
  discover_seed_method: string;
  credential_ids: number[];
}

const defaultCreateForm = (): CreateCrawlerForm => ({
  crawl_type:           1,
  task_name:            '',
  target_user_id:      '',
  target_date_range:   [] as Date[],
  target_search_prompt: '',
  ranking_mode:       'day',
  illust_type_filter: ['illust'] as string[],
  exclude_r18:         true,
  exclude_ai:          true,
  max_pages:           0,
  disable_discover:    false,
  discover_hops:       0,
  discover_seed_limit: 0,
  discover_seed_method: 'popularity',
  credential_ids:      [] as number[],
});

const createForm = ref<CreateCrawlerForm>(defaultCreateForm());

/** Pixiv credentials for the credential selector. */
interface PixivCred {
  id: number;
  pixiv_user_id: string;
  status: number;
  note: string | null;
}
const credentials = ref<PixivCred[]>([]);

const fetchCredentials = async () => {
  try {
    const res = await Axios.get('/pixiv-credential');
    if (res.status === 200) credentials.value = res.data;
  } catch { /* silent */ }
};

/** Active credentials for the selector. */
const activeCredentials = computed(() =>
  credentials.value.filter(c => c.status === 0)
);

/** Credential selector item title. */
const credTitle = (c: PixivCred) =>
  `#${c.id} — ${c.pixiv_user_id}${c.note ? ' (' + c.note + ')' : ''}`;

const snackbar = ref({ show: false, text: '', color: 'error' });

const requiredRule = [(v: any) => (v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)) || '此项为必填'];

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const sortedRoots = computed(() =>
  [...rootTasks.value].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)),
);

/** Derived: root IDs whose panels should be shown as expanded (for :model-value binding). */
const expandedIds = computed(() => [...expandedRoots.value]);

/** Parse a backend task object into our Task interface. */
const parseTask = (raw: any): Task => {
  const task = raw?.job ?? raw ?? {};
  const rawTaskStatus = task.status ?? raw?.status ?? '';
  const status = normalizeStatus(rawTaskStatus);
  const rawStatus = task.raw_status ?? task.rawStatus ?? raw?.raw_status ?? raw?.rawStatus;
  return {
    id:           task.id ?? raw?.id ?? '',
    taskType:     task.task_type ?? task.taskType ?? task.job_type ?? task.jobType ?? '',
    status:       status,
    rawStatus:    rawStatus ?? (rawTaskStatus && rawTaskStatus !== status ? rawTaskStatus : undefined),
    retryCount:   task.retry_count ?? task.retryCount ?? raw?.retry_count ?? raw?.retryCount ?? 0,
    createdAt:    task.created_at ?? task.createdAt ?? raw?.created_at ?? raw?.createdAt ?? '',
    updatedAt:    task.updated_at ?? task.updatedAt ?? raw?.updated_at ?? raw?.updatedAt,
    completedAt:  task.completed_at ?? task.completedAt ?? raw?.completed_at ?? raw?.completedAt ?? null,
    errorMessage: task.error_message ?? task.errorMessage ?? raw?.error_message ?? raw?.errorMessage ?? null,
    rootId:       task.root_id ?? task.rootId ?? raw?.root_id ?? raw?.rootId ?? null,
    crawlerId:    task.crawler_id ?? task.crawlerId ?? raw?.crawler_id ?? raw?.crawlerId ?? null,
    imageId:      task.image_id ?? task.imageId ?? raw?.image_id ?? raw?.imageId ?? null,
    payload:      task.payload ?? task.params ?? raw?.payload ?? raw?.params,
    parent_job_id: task.parent_job_id ?? task.parentJobId ?? raw?.parent_job_id ?? raw?.parentJobId,
    root_job_id:   task.root_job_id ?? task.rootJobId ?? raw?.root_job_id ?? raw?.rootJobId,
  };
};

let fetchGeneration = 0;

/** Parse composite type filter value (e.g. "crawl:1") into API params. */
const parseTypeFilter = (value: string | null): Record<string, any> => {
  if (!value) return {};
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) return { task_type: value };
  return { task_type: value.slice(0, colonIdx), crawl_type: parseInt(value.slice(colonIdx + 1), 10) };
};

const fetchRoots = async (opts?: { preserveExpanded?: boolean; silent?: boolean }) => {
  const gen = ++fetchGeneration;
  if (!opts?.silent) {
    loading.value = true;
    rootTasks.value = [];
    scrollContainer.value?.scrollTo({ top: 0 });
  }
  if (!opts?.preserveExpanded) {
    // Clear expansion & subtask state on page / filter change
    expandedRoots.value = new Set();
    for (const key of Object.keys(subtaskMap)) {
      delete subtaskMap[key];
    }
  }
  try {
    const params: Record<string, any> = {
      limit:  pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    };
    Object.assign(params, parseTypeFilter(filterType.value));
    if (filterStatus.value) params.status = filterStatus.value;

    const res = await Axios.get('/tasks/roots', { params });
    if (res.status === 200) {
      if (fetchGeneration === gen) {
        rootTasks.value = (res.data.tasks ?? []).map(parseTask);
        total.value      = res.data.total ?? 0;
      }
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '加载失败');
  } finally {
    if (!opts?.silent && fetchGeneration === gen) {
      loading.value = false;
    }
  }
};

/** Fetch subtasks for a single root using the flatten tree API (server-side pagination). */
const fetchSubtasks = async (rootId: string, silent = false) => {
  const state = subtaskMap[rootId];
  if (!state) return;
  if (!silent) state.loading = true;
  try {
    const offset = (state.page - 1) * state.pageSize;
    const params: Record<string, any> = {
      flatten: true,
      limit: state.pageSize,
      offset: offset,
    };
    Object.assign(params, parseTypeFilter(state.filterType));
    const status = treeStatusParam(state.filterStatus);
    if (status) params.status = status;

    const res = await Axios.get(`/tasks/${rootId}/tree`, {
      params,
    });
    if (res.status === 200) {
      const tasks = (res.data.tasks ?? []).map(parseTask);
      state.total = res.data.total ?? 0;
      state.pageInput = state.page;
      state.items = tasks;
      state.loaded = true;
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '子任务加载失败');
  } finally {
    state.loading = false;
  }
};

const subtaskTotalPages = (state?: SubtaskState) =>
  Math.max(1, Math.ceil((state?.total ?? 0) / (state?.pageSize || 1)));

const normalizedSubtaskPage = (state: SubtaskState, value: number | null) => {
  const totalPages = subtaskTotalPages(state);
  const pageValue = Number(value);
  if (!Number.isFinite(pageValue)) return state.page;
  return Math.min(totalPages, Math.max(1, Math.trunc(pageValue)));
};

/** Handle subtask page change. */
const onSubtaskPageChange = (rootId: string, newPage: number) => {
  const state = subtaskMap[rootId];
  if (!state) return;
  state.page = normalizedSubtaskPage(state, newPage);
  state.pageInput = state.page;
  fetchSubtasks(rootId);
};

const jumpToSubtaskPage = (rootId: string) => {
  const state = subtaskMap[rootId];
  if (!state) return;
  const nextPage = normalizedSubtaskPage(state, state.pageInput);
  state.pageInput = nextPage;
  if (nextPage === state.page) return;
  state.page = nextPage;
  fetchSubtasks(rootId);
};

const showSubtaskSection = (rootId: string) => {
  const state = subtaskMap[rootId];
  if (!state) return false;
  return state.loading || state.total > 0 || state.items.length > 0 || !!state.filterType || !!state.filterStatus;
};

watch([filterType, filterStatus], () => {
  page.value = 1;
  fetchRoots();
});

/** Called by v-expansion-panels @update:modelValue (bound via :model-value for persistence). */
const onRootExpandChange = (openIds: unknown) => {
  const ids: string[] = Array.isArray(openIds)
    ? openIds.filter((x): x is string => typeof x === 'string')
    : typeof openIds === 'string' ? [openIds] : [];
  const newSet = new Set(ids);

  for (const id of newSet) {
    const root = rootTasks.value.find(t => t.id === id);
    if (!root || !canHaveSubtasks(root)) continue;

    if (!subtaskMap[id]) {
      subtaskMap[id] = {
        items: [],
        loading: true,
        loaded: false,
        filterType: null,
        filterStatus: null,
        total: 0,
        page: 1,
        pageInput: 1,
        pageSize: 10,
      };
      // Fire and forget (don't await so expansion happens instantly)
      nextTick(() => fetchSubtasks(id, true));
    }
  }

  expandedRoots.value = newSet;
};

/** Refresh subtasks after a subtask-level action (cancel/retry). */
const refreshSubtask = async (rootId: string) => {
  if (subtaskMap[rootId]?.loaded) {
    await fetchSubtasks(rootId, true);
  }
};

const applySubtaskFilter = (rootId: string) => {
  const state = subtaskMap[rootId];
  if (state) {
    state.page = 1;
    state.pageInput = 1;
  }
  fetchSubtasks(rootId);
};

const openCancelRoot = (id: string) => {
  cancelId.value     = id;
  cancelIsRoot.value = true;
  cancelDialog.value = true;
};

const openCancelSubtask = (rootId: string, childId: string) => {
  cancelId.value     = childId;
  cancelIsRoot.value = false;
  (cancelDialog as any)._rootId = rootId;  // stashed for confirm handler
  cancelDialog.value = true;
};

const confirmCancel = async () => {
  if (!cancelId.value) return;
  cancelling.value = true;
  try {
    await Axios.delete(`/tasks/${cancelId.value}`);
    snackbar.value = { show: true, text: '任务已取消', color: 'success' };

    if (cancelIsRoot.value) {
      await fetchRoots({ preserveExpanded: true });
    } else {
      const rootId = (cancelDialog as any)._rootId as string;
      if (rootId) {
        await refreshSubtask(rootId);
        await fetchRoots({ preserveExpanded: true });
      }
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '取消操作失败');
  } finally {
    cancelling.value  = false;
    cancelDialog.value = false;
    cancelId.value     = null;
  }
};

/** Open the interrupt-all-pending-subtasks dialog for a root. */
const openInterruptSubtasks = (rootId: string) => {
  interruptId.value     = rootId;
  interruptDialog.value = true;
};

const openCancelAll = () => {
  cancelAllDialog.value = true;
};

const openCleanAll = () => {
  cleanFlags.value = ['completed', 'failed', 'killed'];
  cleanType.value  = null;
  cleanDialog.value = true;
};

const confirmCleanAll = async () => {
  if (cleanFlags.value.length === 0) return;
  cleaning.value = true;
  try {
    const body: Record<string, any> = { flags: cleanFlags.value };
    Object.assign(body, parseTypeFilter(cleanType.value));
    const res = await Axios.post('/tasks/clean', body);
    snackbar.value = {
      show: true,
      text: `已清理 ${res.data.deleted ?? 0} 个任务`,
      color: 'success',
    };
    await fetchRoots();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '清理任务失败');
  } finally {
    cleaning.value     = false;
    cleanDialog.value  = false;
  }
};

const confirmCancelAll = async () => {
  cancellingAll.value = true;
  try {
    const res = await Axios.delete('/tasks/pending');
    snackbar.value = {
      show: true,
      text: `已终止 ${res.data.deleted ?? 0} 个任务`,
      color: 'success',
    };
    await fetchRoots();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '终止所有任务失败');
  } finally {
    cancellingAll.value   = false;
    cancelAllDialog.value = false;
  }
};

/** Confirm: delete all pending subtasks of the root. */
const confirmInterrupt = async () => {
  if (!interruptId.value) return;
  interrupting.value = true;
  try {
    const rootId = interruptId.value;
    const params: Record<string, any> = {};
    const subFilter = subtaskMap[rootId]?.filterType;
    if (subFilter) {
      Object.assign(params, parseTypeFilter(subFilter));
    }

    const res = await Axios.delete(`/tasks/${rootId}/subtasks`, { params });
    snackbar.value = {
      show: true,
      text: `已取消 ${res.data.cancelled ?? 0} 个子任务`,
      color: 'success',
    };
    await refreshSubtask(rootId);
    await fetchRoots({ preserveExpanded: true });  // Also refresh root (status might change)
  } catch (e: any) {
    showError(e.response?.data?.message ?? '批量取消失败');
  } finally {
    interrupting.value = false;
    interruptDialog.value = false;
    interruptId.value     = null;
  }
};

/** Format a Date to local "YYYY-MM-DD" for backend NaiveDateTime strings. */
const fmtDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const submitCreate = async () => {
  const result = await createFormRef.value?.validate();
  if (!result?.valid) return;

  if (createForm.value.crawl_type === 0 && createForm.value.target_date_range.length < 2) {
    snackbar.value = { show: true, text: '排行榜爬取必须选择起止日期', color: 'error' };
    return;
  }
  if (createForm.value.crawl_type === 1 && !createForm.value.target_user_id.trim()) {
    snackbar.value = { show: true, text: '用户爬取必须填写目标用户 ID', color: 'error' };
    return;
  }
  if (createForm.value.crawl_type === 2 && createForm.value.credential_ids.length === 0) {
    snackbar.value = { show: true, text: '收藏夹爬取必须选择至少一个 Pixiv 凭证', color: 'error' };
    return;
  }

  creating.value = true;
  try {
    const body: any = {
      crawl_type:  createForm.value.crawl_type,
    };

    if (createForm.value.task_name.trim()) {
      body.task_name = createForm.value.task_name.trim();
    }

    if (createForm.value.crawl_type === 1) {
      body.target_user_id = createForm.value.target_user_id.trim();
    }

    // v-date-input range returns Date[]; backend expects NaiveDateTime "YYYY-MM-DDTHH:MM:SS"
    const range = createForm.value.target_date_range;
    if (createForm.value.crawl_type === 0 && range.length >= 2) {
      body.target_start_date = fmtDate(range[0]) + 'T00:00:00';
      body.target_end_date   = fmtDate(range[range.length - 1]) + 'T23:59:59';
    }

    if (createForm.value.crawl_type === 2 && createForm.value.target_search_prompt.trim()) {
      body.target_search_prompt = createForm.value.target_search_prompt.trim();
    }

    if (createForm.value.crawl_type === 0 && createForm.value.ranking_mode) {
      body.ranking_mode = createForm.value.ranking_mode;
    }

    if (createForm.value.illust_type_filter.length > 0) {
      body.illust_type_filter = createForm.value.illust_type_filter;
    }

    if (createForm.value.exclude_r18) body.exclude_r18 = true;
    if (createForm.value.exclude_ai) body.exclude_ai = true;

    if (createForm.value.max_pages > 0) body.max_pages = createForm.value.max_pages;

    if (createForm.value.disable_discover) {
      body.disable_discover = true;
    } else {
      if (createForm.value.discover_hops > 0) body.discover_hops = createForm.value.discover_hops;
      if (createForm.value.discover_seed_limit > 0) body.discover_seed_limit = createForm.value.discover_seed_limit;
      if (createForm.value.discover_seed_method && createForm.value.discover_seed_method !== 'popularity') {
        body.discover_seed_method = createForm.value.discover_seed_method;
      }
    }

    if (createForm.value.credential_ids.length > 0) {
      body.credential_ids = createForm.value.credential_ids;
    }

    await Axios.post('/crawler', body);
    createDialog.value = false;
    createForm.value = defaultCreateForm();
    createFormRef.value?.resetValidation();
    snackbar.value = { show: true, text: '爬取任务已提交', color: 'success' };
    await fetchRoots();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '提交失败');
  } finally {
    creating.value = false;
  }
};

const showError = (text: string) => {
  snackbar.value = { show: true, text, color: 'error' };
};

const JOB_TYPE_PREFIX = 'randimg_backend_rs::task_queue::jobs::';

const stripJobTypePrefix = (jobType: string): string =>
  jobType.startsWith(JOB_TYPE_PREFIX) ? jobType.slice(JOB_TYPE_PREFIX.length) : jobType;

const taskTitle = (t: Task): string => {
  const label = jobLabel[t.taskType] ?? stripJobTypePrefix(t.taskType);
  let hint = '';
  if (t.payload?.target_user_id)                     hint = `user: ${t.payload.target_user_id}`;
  else if (t.payload?.target_start_date)             hint = `${t.payload.target_start_date} ~ ${t.payload.target_end_date ?? ''}`;
  else if (t.imageId)                                hint = `image #${t.imageId}`;
  else if (t.crawlerId)                              hint = `crawler #${t.crawlerId}`;
  else if (t.payload?.credential_id)                 hint = `credential #${t.payload.credential_id}`;
  return label + (hint ? ': ' + hint : '');
};

const canHaveSubtasks = (task: Task): boolean =>
  stripJobTypePrefix(task.taskType) === 'crawl';


const formatJson = (v: any): string => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string') {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
  }
  return JSON.stringify(v, null, 2);
};

const pendingCount = (items?: Task[]) =>
  (items ?? []).filter(t => t.status === 'pending').length;

/** Whether any root task is still active (running or pending). */
const hasActiveTasks = computed(() =>
  rootTasks.value.some(t => t.status === 'running' || t.status === 'pending'),
);

/** Silent background refresh: root list + all expanded subtask panels. */
const pollRefresh = async () => {
  if (pollRequestLocked) return;
  pollRequestLocked = true;
  try {
    if (!hasActiveTasks.value) {
      stopPolling();
      return;
    }
    await fetchRoots({ preserveExpanded: true, silent: true });
    // Also refresh any expanded subtask panels
    for (const rootId of expandedRoots.value) {
      if (subtaskMap[rootId]?.loaded) {
        await fetchSubtasks(rootId, true);
      }
    }
  } finally {
    pollRequestLocked = false;
  }
};

const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(pollRefresh, POLL_INTERVAL);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

/** Re-evaluate polling whenever root tasks change. */
watch(hasActiveTasks, (active) => {
  if (active) startPolling();
  else stopPolling();
});

onMounted(() => {
  fetchRoots();
  fetchCredentials();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <v-container class="task-manager-page">

    <v-row align="center" class="mb-4">
      <v-col>
        <h2 class="text-h5">任务管理</h2>
        <span class="text-caption text-medium-emphasis">共 {{ total }} 条根任务</span>
      </v-col>
      <v-col cols="auto" class="d-flex ga-2">
        <v-btn color="error" variant="outlined" :prepend-icon="mdiStopCircleOutline" @click="openCancelAll">
          终止所有任务
        </v-btn>
        <v-btn color="warning" variant="outlined" :prepend-icon="mdiBroom" @click="openCleanAll">
          清理任务
        </v-btn>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="createDialog = true">
          创建任务
        </v-btn>
      </v-col>
    </v-row>

    <v-row dense class="mb-4" align="center">
      <v-col cols="12" sm="6">
        <v-select
          v-model="filterType"
          :items="typeItems"
          label="任务类型"
          clearable
          density="comfortable"
          hide-details
          :disabled="loading"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-select
          v-model="filterStatus"
          :items="statusItems"
          label="状态"
          clearable
          density="comfortable"
          hide-details
          :disabled="loading"
        />
      </v-col>
    </v-row>

    <div ref="scrollContainer" class="task-scroll-container">
      <template v-if="loading">
        <v-skeleton-loader v-for="i in 5" :key="i" type="list-item-two-line" class="mb-2" />
      </template>

      <v-expansion-panels
        v-else-if="sortedRoots.length > 0"
        :model-value="expandedIds"
        variant="accordion"
        multiple
        @update:model-value="onRootExpandChange"
      >
        <v-expansion-panel
          v-for="root in sortedRoots"
          :key="root.id"
          :value="root.id"
        >
          <v-expansion-panel-title class="py-3 px-4" hide-actions>
            <div class="d-flex align-center w-100" style="min-width: 0">
              <v-icon
                class="mr-3 text-medium-emphasis"
                :icon="expandedRoots.has(root.id) ? mdiChevronDown : mdiChevronRight"
              />
              <v-chip
                :color="statusColor[root.status] ?? 'grey'"
                size="small"
                label
                class="flex-shrink-0 mr-3"
              >
                {{ statusLabel[root.status] ?? root.status }}
              </v-chip>
              <span class="font-weight-medium text-truncate flex-grow-1" style="min-width: 0">
                {{ taskTitle(root) }}
              </span>
              <span class="text-caption text-medium-emphasis ml-3 flex-shrink-0">
                {{ formatDate(root.createdAt) }}
              </span>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>

            <!-- Basic info — 2-column grid -->
            <div class="root-info-grid mb-4">
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">类型</span>
                <span>{{ jobLabel[root.taskType] ?? root.taskType }}</span>
              </div>
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">重试次数</span>
                <span>{{ root.retryCount }}</span>
              </div>
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">创建时间</span>
                <span>{{ formatDate(root.createdAt) }}</span>
              </div>
              <div class="info-item" v-if="root.completedAt">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">完成时间</span>
                <span>{{ formatDate(root.completedAt) }}</span>
              </div>
              <div class="info-item" v-if="root.rawStatus && root.rawStatus !== root.status">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">原始状态</span>
                <span>{{ statusLabel[root.rawStatus] ?? root.rawStatus }}</span>
              </div>
            </div>

            <!-- Payload / last_result -->
            <v-expansion-panels v-if="root.payload || root.errorMessage" variant="accordion" class="subtask-panels mb-4">
              <v-expansion-panel v-if="root.payload">
                <v-expansion-panel-title class="py-2 px-3" hide-actions>
                  <template #default="{ expanded }">
                    <div class="d-flex align-center w-100" style="min-width: 0;">
                      <v-icon
                        class="mr-2 text-medium-emphasis"
                        :icon="expanded ? mdiChevronDown : mdiChevronRight"
                        size="small"
                      />
                      <span class="text-body-2">参数</span>
                    </div>
                  </template>
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pt-0">
                  <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(root.payload) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel v-if="root.errorMessage">
                <v-expansion-panel-title class="py-2 px-3" hide-actions>
                  <template #default="{ expanded }">
                    <div class="d-flex align-center w-100" style="min-width: 0;">
                      <v-icon
                        class="mr-2 text-medium-emphasis"
                        :icon="expanded ? mdiChevronDown : mdiChevronRight"
                        size="small"
                      />
                      <span class="text-body-2">错误信息</span>
                    </div>
                  </template>
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pt-0">
                  <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(root.errorMessage) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <div class="d-flex ga-2 mb-4">
              <v-btn
                v-if="root.status === 'pending'"
                size="small"
                color="error"
                variant="outlined"
                @click="openCancelRoot(root.id)"
              >
                取消此任务
              </v-btn>
            </div>

            <v-divider v-if="showSubtaskSection(root.id)" class="mb-4" />

            <template v-if="showSubtaskSection(root.id)">
              <div class="d-flex align-center mb-3 ga-3 flex-wrap">
                <span class="text-subtitle-2 font-weight-bold">子任务</span>
                <span
                  v-if="subtaskMap[root.id]"
                  class="text-caption text-medium-emphasis"
                >
                  共 {{ subtaskMap[root.id].total }} 条
                  <template v-if="pendingCount(subtaskMap[root.id].items) > 0">
                    · {{ pendingCount(subtaskMap[root.id].items) }} 条待处理
                  </template>
                </span>
                <v-spacer />
                <div class="subtask-actions d-flex align-center ga-3 flex-wrap">
                  <v-select
                    v-if="subtaskMap[root.id]"
                    v-model="subtaskMap[root.id].filterType"
                    :items="subtaskTypeItems"
                    item-title="title"
                    item-value="value"
                    label="类型筛选"
                    chips
                    density="compact"
                    variant="underlined"
                    hide-details
                    class="subtask-type-select"
                    @update:model-value="applySubtaskFilter(root.id)"
                  />
                  <v-select
                    v-if="subtaskMap[root.id]"
                    v-model="subtaskMap[root.id].filterStatus"
                    :items="statusItems"
                    item-title="title"
                    item-value="value"
                    label="状态筛选"
                    chips
                    density="compact"
                    variant="underlined"
                    hide-details
                    class="subtask-status-select"
                    @update:model-value="applySubtaskFilter(root.id)"
                  />
                  <v-btn
                    v-if="subtaskMap[root.id] && pendingCount(subtaskMap[root.id].items) > 0"
                    size="small"
                    color="warning"
                    variant="tonal"
                    @click="openInterruptSubtasks(root.id)"
                  >
                    <v-icon size="16" class="mr-1" :icon="mdiCancel" />
                    取消所有待处理子任务
                  </v-btn>
                </div>
              </div>

              <div v-if="subtaskMap[root.id]?.loading" class="py-2">
                <v-skeleton-loader v-for="j in 3" :key="j" type="list-item-two-line" class="mb-1" />
              </div>

              <template v-else-if="(subtaskMap[root.id]?.items ?? []).length > 0">
              <v-expansion-panels
                variant="accordion"
                class="subtask-panels"
              >
                <v-expansion-panel
                  v-for="child in subtaskMap[root.id].items"
                  :key="child.id"
                  density="compact"
                >
                <v-expansion-panel-title class="py-2 px-3" hide-actions>
                  <template #default="{ expanded }">
                    <div class="d-flex align-center" style="width: 100%; min-width: 0;">
                      <v-icon
                        class="mr-2 text-medium-emphasis"
                        :icon="expanded ? mdiChevronDown : mdiChevronRight"
                        size="small"
                      />
                      <v-chip
                        :color="statusColor[child.status] ?? 'grey'"
                      size="x-small"
                      label
                      class="flex-shrink-0 mr-2"
                    >
                      {{ statusLabel[child.status] ?? child.status }}
                    </v-chip>
                    <span class="text-body-2 text-truncate" style="min-width: 0; flex: 1;">
                      {{ taskTitle(child) }}
                    </span>
                    <span class="text-caption text-medium-emphasis ml-2 flex-shrink-0">
                      {{ formatDate(child.createdAt) }}
                    </span>
                  </div>
                  </template>
                </v-expansion-panel-title>

                <v-expansion-panel-text class="pt-0">
                  <div class="root-info-grid mb-2 mt-2">
                    <div class="info-item">
                      <span class="text-caption text-medium-emphasis font-weight-medium">类型</span>
                      <span class="text-body-2">{{ jobLabel[child.taskType] ?? child.taskType }}</span>
                    </div>
                    <div class="info-item">
                      <span class="text-caption text-medium-emphasis font-weight-medium">重试次数</span>
                      <span class="text-body-2">{{ child.retryCount }}</span>
                    </div>
                    <div class="info-item">
                      <span class="text-caption text-medium-emphasis font-weight-medium">创建时间</span>
                      <span class="text-body-2">{{ formatDate(child.createdAt) }}</span>
                    </div>
                    <div class="info-item" v-if="child.completedAt">
                      <span class="text-caption text-medium-emphasis font-weight-medium">完成时间</span>
                      <span class="text-body-2">{{ formatDate(child.completedAt) }}</span>
                    </div>
                  </div>

                  <div v-if="child.payload" class="mb-2">
                    <span class="text-caption text-medium-emphasis font-weight-medium d-block mb-1">参数</span>
                    <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(child.payload) }}</pre>
                  </div>

                  <div v-if="child.errorMessage" class="mb-2">
                    <span class="text-caption text-medium-emphasis font-weight-medium d-block mb-1">错误信息</span>
                    <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(child.errorMessage) }}</pre>
                  </div>

                  <v-divider class="my-2" />
                  <div class="d-flex justify-end ga-2">
                    <v-btn
                      v-if="child.status === 'pending'"
                      size="small"
                      color="error"
                      variant="outlined"
                      @click="openCancelSubtask(root.id, child.id)"
                    >
                      取消
                    </v-btn>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

                <div
                  v-if="subtaskMap[root.id] && subtaskMap[root.id].total > subtaskMap[root.id].pageSize"
                  class="subtask-pagination d-flex align-center justify-center ga-3 flex-wrap mt-4"
                >
                  <v-pagination
                    :model-value="subtaskMap[root.id].page"
                    :length="subtaskTotalPages(subtaskMap[root.id])"
                    :total-visible="4"
                    density="compact"
                    @update:model-value="onSubtaskPageChange(root.id, $event)"
                  />
                  <v-text-field
                    v-model.number="subtaskMap[root.id].pageInput"
                    type="number"
                    label="跳转到"
                    suffix="页"
                    :min="1"
                    :max="subtaskTotalPages(subtaskMap[root.id])"
                    density="compact"
                    variant="underlined"
                    hide-details
                    class="subtask-page-jump"
                    @keydown.enter="jumpToSubtaskPage(root.id)"
                    @blur="jumpToSubtaskPage(root.id)"
                  />
                </div>
              </template>

              <v-empty-state
                v-else-if="subtaskMap[root.id]?.loaded && (subtaskMap[root.id]?.filterType || subtaskMap[root.id]?.filterStatus)"
                :icon="mdiCheckboxBlankOutline"
                title="暂无匹配子任务"
                text="当前筛选条件下没有子任务。"
                size="64"
                min-height="180"
                class="my-2"
              />
            </template>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-empty-state
        v-else
        :icon="mdiFormatListChecks"
        title="暂无任务"
        text="任务队列为空，可以通过上方按钮新建一个任务。"
      />
    </div>

    <div v-if="totalPages > 1" class="d-flex flex-column align-center mt-4">
      <v-pagination
        v-model="page"
        :length="totalPages"
        :total-visible="5"
        :disabled="loading"
        @update:model-value="() => fetchRoots()"
      />
      <span class="text-caption text-medium-emphasis mt-1">
        第 {{ page }} / {{ totalPages }} 页
      </span>
    </div>

    <v-dialog v-model="createDialog" max-width="560">
      <v-card>
        <v-card-title>创建爬取任务</v-card-title>
        <v-card-text>
          <v-form ref="createFormRef" class="d-flex flex-column ga-2" @submit.prevent="submitCreate">
            <v-select v-model="createForm.crawl_type" :items="crawlTypeItems" item-title="title" item-value="value" label="爬取类型" :rules="requiredRule" hide-details="auto" />
            <v-text-field
              v-model="createForm.task_name"
              label="任务名称（可选）"
              hide-details="auto"
            />
            <v-text-field
              v-if="createForm.crawl_type === 1"
              v-model="createForm.target_user_id"
              label="目标用户 ID"
              :rules="requiredRule"
              hide-details="auto"
            />
            <v-date-input
              v-if="createForm.crawl_type === 0"
              v-model="createForm.target_date_range"
              label="日期范围"
              multiple="range"
              :rules="requiredRule"
              hide-details="auto"
            />
            <v-text-field
              v-if="createForm.crawl_type === 2"
              v-model="createForm.target_search_prompt"
              label="书签标签过滤（可选）"
              hide-details="auto"
            />

            <!-- 凭证选择：收藏夹爬取必填，其他类型可选 -->
            <v-select
              v-model="createForm.credential_ids"
              :items="activeCredentials"
              :item-title="credTitle"
              item-value="id"
              label="Pixiv 凭证"
              :required="createForm.crawl_type === 2"
              :rules="createForm.crawl_type === 2 ? requiredRule : []"
              multiple
              chips
              closable-chips
              hide-details="auto"
              :hint="createForm.crawl_type === 2 ? '收藏夹爬取必须指定凭证' : '留空则自动选择'"
              persistent-hint
            />

            <v-select v-if="createForm.crawl_type === 0" v-model="createForm.ranking_mode" :items="rankingModeItems" item-title="title" item-value="value" label="排行榜类型" hide-details="auto" />
            <div class="mt-1">
              <span class="text-caption text-medium-emphasis">图片类型过滤</span>
              <v-chip-group v-model="createForm.illust_type_filter" multiple column>
                <v-chip
                  v-for="item in illustTypeFilterItems"
                  :key="item.value"
                  :value="item.value"
                  filter
                  variant="outlined"
                  size="small"
                >
                  {{ item.title }}
                </v-chip>
              </v-chip-group>
            </div>
            <div class="d-flex flex-wrap ga-3">
              <v-switch
                v-model="createForm.exclude_r18"
                label="排除 R18"
                color="primary"
                density="compact"
                hide-details
              />
              <v-switch
                v-model="createForm.exclude_ai"
                label="排除 AI 生成"
                color="primary"
                density="compact"
                hide-details
              />
            </div>
            <v-text-field v-model.number="createForm.max_pages" label="最大页数（0=不限）" type="number" min="0" hide-details="auto" />

            <v-divider class="my-1" />
            <div class="d-flex align-center">
              <span class="text-caption text-medium-emphasis">Discover 参数</span>
              <v-spacer />
              <v-switch
                v-model="createForm.disable_discover"
                label="禁用 Discover"
                color="warning"
                density="compact"
                hide-details
                class="ml-2"
              />
            </div>
            <template v-if="!createForm.disable_discover">
              <v-text-field v-model.number="createForm.discover_hops" label="Discover 跳数（0=使用默认值）" type="number" min="0" hide-details="auto" />
              <v-text-field v-model.number="createForm.discover_seed_limit" label="Discover 种子数（0=使用默认值）" type="number" min="0" hide-details="auto" />
              <v-select v-model="createForm.discover_seed_method" :items="seedMethodItems" item-title="title" item-value="value" label="Discover 种子选择策略" hide-details="auto" />
            </template>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="取消" @click="createDialog = false" />
          <v-btn color="primary" text="提交" :loading="creating" @click="submitCreate" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cancelAllDialog" max-width="440">
      <v-card>
        <v-card-title>终止所有任务</v-card-title>
        <v-card-text>
          将终止当前所有<strong>待处理</strong>状态的根任务及其子任务，此操作不可撤销。
          <br />确定继续吗？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="cancelAllDialog = false" />
          <v-btn color="error" text="确认终止" :loading="cancellingAll" @click="confirmCancelAll" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cleanDialog" max-width="480">
      <v-card>
        <v-card-title>清理任务</v-card-title>
        <v-card-text>
          <p class="mb-3">选择要清理的任务状态，符合条件的任务将被永久删除。</p>
          <v-chip-group v-model="cleanFlags" multiple column>
            <v-chip
              v-for="item in cleanFlagItems"
              :key="item.value"
              :value="item.value"
              filter
              variant="outlined"
            >
              {{ item.title }}
            </v-chip>
          </v-chip-group>
          <v-select
            v-model="cleanType"
            :items="typeItems"
            label="任务类型（可选，不选则清理所有类型）"
            clearable
            density="comfortable"
            hide-details
            class="mt-4"
          />
          <v-alert
            v-if="cleanFlags.includes('running') || cleanFlags.includes('pending')"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            包含运行中或待处理的任务，清理后将自动重启 Worker。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="cleanDialog = false" />
          <v-btn
            color="warning"
            text="确认清理"
            :loading="cleaning"
            :disabled="cleanFlags.length === 0"
            @click="confirmCleanAll"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cancelDialog" max-width="400">
      <v-card>
        <v-card-title>确认取消任务</v-card-title>
        <v-card-text>
          {{ cancelIsRoot ? '取消此根任务及其关联数据？' : '确定要取消此子任务吗？' }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="cancelDialog = false" />
          <v-btn color="error" text="确认取消" :loading="cancelling" @click="confirmCancel" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="interruptDialog" max-width="420">
      <v-card>
        <v-card-title>取消所有待处理子任务</v-card-title>
        <v-card-text>
          将取消此根任务下所有待处理状态的子任务，不可撤销。
          <template v-if="interruptId && subtaskMap[interruptId]?.filterType">
            <br />
            <strong>当前类型筛选：</strong>
            {{ subtaskTypeItems.find(i => i.value === subtaskMap[interruptId!]?.filterType)?.title ?? subtaskMap[interruptId!]?.filterType }}
          </template>
          <br />确定继续吗？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="interruptDialog = false" />
          <v-btn
            color="error"
            text="确认取消"
            :loading="interrupting"
            @click="confirmInterrupt"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="top">
      {{ snackbar.text }}
    </v-snackbar>

  </v-container>
</template>

<style scoped>
.task-manager-page {
  align-self: stretch;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: calc(100vh - var(--v-layout-top, 64px));
  overflow: hidden;
  padding-bottom: 0;
}

.task-manager-page > .v-row {
  flex: 0 0 auto;
}

.task-scroll-container {
  --scroll-bg: rgb(var(--v-theme-surface));
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  background:
    linear-gradient(var(--scroll-bg) 30%, transparent),
    linear-gradient(transparent, var(--scroll-bg) 70%) 0 100%,
    radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.12), transparent),
    radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.12), transparent) 0 100%;
  background-repeat: no-repeat;
  background-size: 100% 40px, 100% 40px, 100% 12px, 100% 12px;
  background-attachment: local, local, scroll, scroll;
}
.root-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 24px;
}
@media (max-width: 600px) {
  .root-info-grid {
    grid-template-columns: 1fr;
  }
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.json-block {
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}
.subtask-panels {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
}
.subtask-panels .v-expansion-panel {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.subtask-panels .v-expansion-panel:last-child {
  border-bottom: none;
}
.subtask-actions {
  margin-left: auto;
}
.subtask-type-select {
  flex: 0 0 184px;
}
.subtask-status-select {
  flex: 0 0 144px;
}
.subtask-pagination {
  min-height: 40px;
}
.subtask-pagination :deep(.v-pagination__item .v-btn__content) {
  font-size: clamp(0.6875rem, 2.2vw, 0.875rem);
  line-height: 1;
  letter-spacing: 0;
  max-width: 100%;
}
.subtask-page-jump {
  flex: 0 0 112px;
}
@media (max-width: 700px) {
  .subtask-actions {
    width: 100%;
    margin-left: 0;
  }
  .subtask-type-select {
    flex: 1 1 160px;
  }
  .subtask-status-select {
    flex: 1 1 140px;
  }
  .subtask-page-jump {
    flex: 0 1 112px;
  }
}
</style>
