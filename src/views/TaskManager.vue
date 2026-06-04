<script setup lang="ts">
import Axios from '../axios/axios';
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { mdiPlus, mdiCancel, mdiStopCircleOutline, mdiBroom, mdiChevronRight, mdiChevronDown, mdiFormatListChecks, mdiCheckboxBlankOutline } from '@mdi/js';
import { formatDate } from '../utils/formatDate';

/** Core task data returned by both /tasks/roots and /tasks/{id}/tree?flatten=true. */
interface Task {
  id: string;
  jobType: string;        // camelCase from backend
  status: string;
  attempts: number;
  maxAttempts: number;
  runAt: string | null;
  doneAt: string | null;
  lastResult: string | null;
  priority: number;
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
  // Pagination
  total: number;
  page: number;
  pageSize: number;
}

const statusColor: Record<string, string> = {
  pending:          'blue',
  running:          'orange',
  completed:        'green',
  failed:           'deep-purple',
  killed:           'red',
  partial_success:  'amber',
};

const statusLabel: Record<string, string> = {
  pending:          '待处理',
  running:          '运行中',
  completed:        '已完成',
  failed:           '重试中',
  killed:           '失败',
  partial_success:  '部分成功',
};

const jobLabel: Record<string, string> = {
  crawl:               '爬取',
  download:            '下载',
  color_extract:       '颜色提取',
  upload:              '上传',
  accessibility_check: '合规检查',
  discover:            '发现',
  refresh_pixiv_token: '刷新Token',
};

const typeItems = [
  { title: '全部', value: null },
  { title: '爬取：按用户', value: 'crawl:1' },
  { title: '爬取：按收藏', value: 'crawl:2' },
  { title: '爬取：按日榜', value: 'crawl:0' },
  { title: '凭证更新', value: 'refresh-pixiv-token' },
];

/** Type filter items for subtask panels — subtasks are download/upload/etc, not crawl roots. */
const subtaskTypeItems = [
  { title: '全部', value: null },
  { title: '下载', value: 'download' },
  { title: '颜色提取', value: 'color-extract' },
  { title: '上传', value: 'upload' },
  { title: '合规检查', value: 'accessibility-check' },
  { title: '发现', value: 'discover' },
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
const POLL_INTERVAL = 5000; // 5 seconds

const createForm = ref({
  crawl_type:           1,
  target_user_id:      '',
  target_date_range:   [] as Date[],
  target_search_prompt: '',
  ranking_mode:       'day',
  illust_type_filter: ['illust'] as string[],
  max_pages:           0,
  discover_hops:       0,
  discover_seed_limit: 0,
  discover_seed_method: 'popularity',
});

const snackbar = ref({ show: false, text: '', color: 'error' });

const requiredRule = [(v: any) => (v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)) || '此项为必填'];

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const sortedRoots = computed(() =>
  [...rootTasks.value].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)),
);

/** Derived: root IDs whose panels should be shown as expanded (for :model-value binding). */
const expandedIds = computed(() => [...expandedRoots.value]);

/** Parse a backend task object (camelCase) into our Task interface. */
const parseTask = (raw: any): Task => ({
  id:         raw.id,
  jobType:    raw.jobType ?? raw.job_type ?? '',
  status:     raw.status,
  attempts:   raw.attempts,
  maxAttempts: raw.maxAttempts ?? raw.max_attempts ?? 0,
  runAt:      raw.runAt ?? raw.run_at ?? null,
  doneAt:     raw.doneAt ?? raw.done_at ?? null,
  lastResult: raw.lastResult ?? raw.last_result ?? null,
  priority:   raw.priority ?? 0,
  payload:    raw.payload,
  parent_job_id: raw.parent_job_id,
  root_job_id:   raw.root_job_id,
});

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
    const res = await Axios.get(`/tasks/${rootId}/tree`, {
      params: {
        flatten: true,
        limit: state.pageSize,
        offset: offset,
      }
    });
    if (res.status === 200) {
      let tasks = (res.data.tasks ?? []).map(parseTask);
      state.total = res.data.total ?? 0;
      // Apply client-side type filter if set
      if (state.filterType) {
        tasks = tasks.filter((t: Task) => t.jobType === state.filterType);
      }
      state.items = tasks;
      state.loaded = true;
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '子任务加载失败');
  } finally {
    state.loading = false;
  }
};

/** Handle subtask page change. */
const onSubtaskPageChange = (rootId: string, newPage: number) => {
  const state = subtaskMap[rootId];
  if (!state) return;
  state.page = newPage;
  fetchSubtasks(rootId);
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
    if (!subtaskMap[id]) {
      subtaskMap[id] = {
        items: [],
        loading: false,
        loaded: false,
        filterType: null,
        total: 0,
        page: 1,
        pageSize: 50,
      };
      // Fire and forget (don't await so expansion happens instantly)
      nextTick(() => fetchSubtasks(id));
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
  if (state) state.page = 1;
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
      const colonIdx = subFilter.indexOf(':');
      params.task_type = colonIdx === -1 ? subFilter : subFilter.slice(0, colonIdx);
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

/** Format a Date to "YYYY-MM-DD" for the backend */
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const submitCreate = async () => {
  const result = await createFormRef.value?.validate();
  if (!result?.valid) return;
  creating.value = true;
  try {
    const body: any = {
      crawl_type:  createForm.value.crawl_type,
    };
    if (createForm.value.target_user_id)       body.target_user_id       = createForm.value.target_user_id;
    // v-date-input range returns Date[]; backend expects NaiveDateTime "YYYY-MM-DDTHH:MM:SS"
    const range = createForm.value.target_date_range;
    if (range.length >= 2) {
      body.target_start_date = fmtDate(range[0]) + 'T00:00:00';
      body.target_end_date   = fmtDate(range[1]) + 'T00:00:00';
    }
    if (createForm.value.target_search_prompt) body.target_search_prompt = createForm.value.target_search_prompt;
    // 排名模式（排行爬取）
    if (createForm.value.crawl_type === 0 && createForm.value.ranking_mode) {
      body.ranking_mode = createForm.value.ranking_mode;
    }
    // 图片类型过滤（所有爬取类型）
    if (createForm.value.illust_type_filter.length > 0 && createForm.value.illust_type_filter.length < illustTypeFilterItems.length) {
      body.illust_type_filter = createForm.value.illust_type_filter;
    }
    // 页数限制
    if (createForm.value.max_pages > 0) body.max_pages = createForm.value.max_pages;
    // Discover 参数
    if (createForm.value.discover_hops > 0) body.discover_hops = createForm.value.discover_hops;
    if (createForm.value.discover_seed_limit > 0) body.discover_seed_limit = createForm.value.discover_seed_limit;
    if (createForm.value.discover_seed_method && createForm.value.discover_seed_method !== 'popularity') {
      body.discover_seed_method = createForm.value.discover_seed_method;
    }

    await Axios.post('/crawler', body);
    createDialog.value = false;
    createForm.value.target_date_range = [];
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
  const label = jobLabel[t.jobType] ?? stripJobTypePrefix(t.jobType);
  let hint = '';
  if (t.payload?.target_user_id)                     hint = `user: ${t.payload.target_user_id}`;
  else if (t.payload?.target_start_date)             hint = `${t.payload.target_start_date} ~ ${t.payload.target_end_date ?? ''}`;
  else if (t.payload?.image_id)                      hint = `image #${t.payload.image_id}`;
  else if (t.payload?.credential_id)                 hint = `credential #${t.payload.credential_id}`;
  return label + (hint ? ': ' + hint : '');
};


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
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <v-container>

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
                {{ formatDate(root.runAt) }}
              </span>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>

            <!-- Basic info — 2-column grid -->
            <div class="root-info-grid mb-4">
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">类型</span>
                <span>{{ jobLabel[root.jobType] ?? root.jobType }}</span>
              </div>
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">尝试次数</span>
                <span>{{ root.attempts }} / {{ root.maxAttempts }}</span>
              </div>
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">创建时间</span>
                <span>{{ formatDate(root.runAt) }}</span>
              </div>
              <div class="info-item" v-if="root.doneAt">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">完成时间</span>
                <span>{{ formatDate(root.doneAt) }}</span>
              </div>
              <div class="info-item" v-if="root.priority">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">优先级</span>
                <span>{{ root.priority }}</span>
              </div>
            </div>

            <!-- Payload / last_result -->
            <v-expansion-panels v-if="root.payload || root.lastResult" variant="accordion" class="subtask-panels mb-4">
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

              <v-expansion-panel v-if="root.lastResult">
                <v-expansion-panel-title class="py-2 px-3" hide-actions>
                  <template #default="{ expanded }">
                    <div class="d-flex align-center w-100" style="min-width: 0;">
                      <v-icon
                        class="mr-2 text-medium-emphasis"
                        :icon="expanded ? mdiChevronDown : mdiChevronRight"
                        size="small"
                      />
                      <span class="text-body-2">执行结果</span>
                    </div>
                  </template>
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pt-0">
                  <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(root.lastResult) }}</pre>
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

            <v-divider v-if="(subtaskMap[root.id]?.items.length ?? 0) > 0" class="mb-4" />

            <template v-if="(subtaskMap[root.id]?.items.length ?? 0) > 0">
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
                <v-select
                  v-if="subtaskMap[root.id]"
                  v-model="subtaskMap[root.id].filterType"
                  :items="subtaskTypeItems"
                  label="类型筛选"
                  clearable
                  density="compact"
                  hide-details
                  style="max-width: 160px;"
                  @update:model-value="applySubtaskFilter(root.id)"
                />
                <v-btn
                  v-if="subtaskMap[root.id] && pendingCount(subtaskMap[root.id].items) > 0"
                  size="small"
                  color="warning"
                  variant="flat"
                  @click="openInterruptSubtasks(root.id)"
                >
                  <v-icon size="16" class="mr-1" :icon="mdiCancel" />
                  取消所有待处理子任务
                </v-btn>
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
                      {{ formatDate(child.runAt) }}
                    </span>
                  </div>
                  </template>
                </v-expansion-panel-title>

                <v-expansion-panel-text class="pt-0">
                  <div class="root-info-grid mb-2 mt-2">
                    <div class="info-item">
                      <span class="text-caption text-medium-emphasis font-weight-medium">类型</span>
                      <span class="text-body-2">{{ jobLabel[child.jobType] ?? child.jobType }}</span>
                    </div>
                    <div class="info-item">
                      <span class="text-caption text-medium-emphasis font-weight-medium">重试次数</span>
                      <span class="text-body-2">{{ child.attempts }} / {{ child.maxAttempts }}</span>
                    </div>
                    <div class="info-item">
                      <span class="text-caption text-medium-emphasis font-weight-medium">创建时间</span>
                      <span class="text-body-2">{{ formatDate(child.runAt) }}</span>
                    </div>
                    <div class="info-item" v-if="child.doneAt">
                      <span class="text-caption text-medium-emphasis font-weight-medium">完成时间</span>
                      <span class="text-body-2">{{ formatDate(child.doneAt) }}</span>
                    </div>
                  </div>

                  <div v-if="child.payload" class="mb-2">
                    <span class="text-caption text-medium-emphasis font-weight-medium d-block mb-1">参数</span>
                    <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(child.payload) }}</pre>
                  </div>

                  <div v-if="child.lastResult" class="mb-2">
                    <span class="text-caption text-medium-emphasis font-weight-medium d-block mb-1">结果</span>
                    <pre class="json-block" style="max-height: 120px; font-size: 0.75rem;">{{ formatJson(child.lastResult) }}</pre>
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

              <v-pagination
                v-if="subtaskMap[root.id] && subtaskMap[root.id].total > subtaskMap[root.id].pageSize"
                v-model="subtaskMap[root.id].page"
                :length="Math.ceil(subtaskMap[root.id].total / subtaskMap[root.id].pageSize)"
                rounded="circle"
                density="compact"
                class="mt-4"
                @update:model-value="onSubtaskPageChange(root.id, $event)"
              />
            </template>

            <v-empty-state
              v-else-if="subtaskMap[root.id]?.loaded"
              :icon="mdiCheckboxBlankOutline"
              title="暂无子任务"
              text="该任务下还没有产生子任务。"
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
        rounded="circle"
        @update:model-value="() => fetchRoots()"
      />
      <span class="text-caption text-medium-emphasis mt-1">
        第 {{ page }} / {{ totalPages }} 页
      </span>
    </div>

    <v-dialog v-model="createDialog" max-width="520">
      <v-card>
        <v-card-title>创建爬取任务</v-card-title>
        <v-card-text>
          <v-form ref="createFormRef" class="d-flex flex-column ga-2" @submit.prevent="submitCreate">
            <v-select v-model="createForm.crawl_type" :items="crawlTypeItems" item-title="title" item-value="value" label="爬取类型" :rules="requiredRule" hide-details="auto" />
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
            <v-text-field v-model="createForm.target_search_prompt" label="搜索关键词（可选）" hide-details="auto" />

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
            <v-text-field v-model.number="createForm.max_pages" label="最大页数（0=不限）" type="number" min="0" hide-details="auto" />

            <v-divider class="my-1" />
            <span class="text-caption text-medium-emphasis">Discover 参数</span>
            <v-text-field v-model.number="createForm.discover_hops" label="Discover 跳数（0=使用默认值）" type="number" min="0" hide-details="auto" />
            <v-text-field v-model.number="createForm.discover_seed_limit" label="Discover 种子数（0=使用默认值）" type="number" min="0" hide-details="auto" />
            <v-select v-model="createForm.discover_seed_method" :items="seedMethodItems" item-title="title" item-value="value" label="Discover 种子选择策略" hide-details="auto" />
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
            {{ typeItems.find(i => i.value === subtaskMap[interruptId!]?.filterType)?.title ?? subtaskMap[interruptId!]?.filterType }}
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
.task-scroll-container {
  --scroll-bg: rgb(var(--v-theme-surface));
  max-height: 70vh;
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
</style>
