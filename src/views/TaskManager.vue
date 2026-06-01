<script setup lang="ts">
import Axios from '../axios/axios';
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import { mdiPlus, mdiCancel } from '@mdi/js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Core task data returned by both /tasks/roots and /tasks/{id}/subtasks. */
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
}

/** Per-root subtask pagination & data state. */
interface SubtaskState {
  items: Task[];
  total: number;
  loading: boolean;
  loaded: boolean;         // true after first load → only re-fetch on explicit action
  filterType: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const statusColor: Record<string, string> = {
  pending:   'blue',
  running:   'orange',
  completed: 'green',
  failed:    'red',
  killed:    'grey',
};

const statusLabel: Record<string, string> = {
  pending:   '待处理',
  running:   '运行中',
  completed: '已完成',
  failed:    '失败',
  killed:    '已取消',
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
  { title: '爬取', value: 'crawl' },
  { title: '下载', value: 'download' },
  { title: '颜色提取', value: 'color_extract' },
  { title: '上传', value: 'upload' },
  { title: '合规检查', value: 'accessibility_check' },
  { title: '发现', value: 'discover' },
];

const statusItems = [
  { title: '全部', value: null },
  { title: '待处理', value: 'pending' },
  { title: '运行中', value: 'running' },
  { title: '已完成', value: 'completed' },
  { title: '失败', value: 'failed' },
  { title: '已取消', value: 'killed' },
];

const crawlTypeItems = [
  { title: '排名爬取', value: 0 },
  { title: '用户爬取', value: 1 },
  { title: '收藏爬取', value: 2 },
];

/** Sort priority: running → pending → failed/killed → completed */
const statusOrder: Record<string, number> = {
  running: 0, pending: 1, failed: 2, killed: 3, completed: 4,
};

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

const rootTasks   = ref<Task[]>([]);
const total         = ref(0);
const page          = ref(1);
const loading       = ref(false);
const pageSize      = ref(20);
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

const scrollContainer = ref<HTMLElement | null>(null);

const createForm = ref({
  crawler_id:          1,
  crawl_type:           1,
  target_user_id:      '',
  target_start_date:   '',
  target_end_date:     '',
  target_search_prompt: '',
});

const snackbar = ref({ show: false, text: '', color: 'error' });

const requiredRule = [(v: any) => !!v || '此项为必填'];

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const sortedRoots = computed(() =>
  [...rootTasks.value].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)),
);

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

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
});

const fetchRoots = async () => {
  loading.value = true;
  rootTasks.value = [];
  scrollContainer.value?.scrollTo({ top: 0 });
  try {
    const params: Record<string, any> = {
      limit:  pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    };
    if (filterType.value) params.task_type = filterType.value;
    if (filterStatus.value) params.status = filterStatus.value;

    const res = await Axios.get('/tasks/roots', { params });
    if (res.status === 200) {
      rootTasks.value = (res.data.tasks ?? []).map(parseTask);
      total.value      = res.data.total ?? 0;
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '加载失败');
  } finally {
    loading.value = false;
  }
};

/** Fetch subtasks for a single root (first time → full load; subsequent → silent refresh). */
const fetchSubtasks = async (rootId: string, silent = false) => {
  const state = subtaskMap[rootId];
  if (!state) return;
  if (!silent) state.loading = true;
  try {
    const params: Record<string, any> = {};
    if (state.filterType) params.task_type = state.filterType;

    const res = await Axios.get(`/tasks/${rootId}/subtasks`, { params });
    if (res.status === 200) {
      state.items = (res.data.subtasks ?? []).map(parseTask);
      state.total = res.data.total ?? 0;
      state.loaded = true;
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '子任务加载失败');
  } finally {
    state.loading = false;
  }
};

watch([filterType, filterStatus], () => {
  page.value = 1;
  fetchRoots();
});

// ---------------------------------------------------------------------------
// Panel lifecycle
// ---------------------------------------------------------------------------

/** Called by v-expansion-panels @update:modelValue. */
const onRootExpandChange = (openIds: string | string[]) => {
  const ids = Array.isArray(openIds) ? openIds : openIds ? [openIds] : [];
  const newSet = new Set(ids);

  // Detect newly expanded panels and init subtask state
  for (const id of newSet) {
    if (!subtaskMap[id]) {
      subtaskMap[id] = {
        items: [],
        total: 0,
        loading: false,
        loaded: false,
        filterType: null,
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

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const applySubtaskFilter = (rootId: string) => {
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
      await fetchRoots();
    } else {
      const rootId = (cancelDialog as any)._rootId as string;
      if (rootId) await refreshSubtask(rootId);
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

/** Confirm: delete all pending subtasks of the root. */
const confirmInterrupt = async () => {
  if (!interruptId.value) return;
  interrupting.value = true;
  try {
    const rootId = interruptId.value;
    const params: Record<string, any> = {};
    const subFilter = subtaskMap[rootId]?.filterType;
    if (subFilter) params.task_type = subFilter;

    const res = await Axios.delete(`/tasks/${rootId}/subtasks`, { params });
    snackbar.value = {
      show: true,
      text: `已取消 ${res.data.cancelled ?? 0} 个子任务`,
      color: 'success',
    };
    await refreshSubtask(rootId);
    await fetchRoots();  // Also refresh root (status might change)
  } catch (e: any) {
    showError(e.response?.data?.message ?? '批量取消失败');
  } finally {
    interrupting.value = false;
    interruptDialog.value = false;
    interruptId.value     = null;
  }
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const submitCreate = async () => {
  const { valid } = await createFormRef.value?.validate();
  if (!valid) return;
  creating.value = true;
  try {
    const body: any = {
      crawler_id: createForm.value.crawler_id,
      crawl_type:  createForm.value.crawl_type,
    };
    if (createForm.value.target_user_id)       body.target_user_id       = createForm.value.target_user_id;
    if (createForm.value.target_start_date)    body.target_start_date    = createForm.value.target_start_date;
    if (createForm.value.target_end_date)      body.target_end_date      = createForm.value.target_end_date;
    if (createForm.value.target_search_prompt) body.target_search_prompt = createForm.value.target_search_prompt;

    await Axios.post('/crawler', body);
    createDialog.value = false;
    snackbar.value = { show: true, text: '爬取任务已提交', color: 'success' };
    await fetchRoots();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '提交失败');
  } finally {
    creating.value = false;
  }
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const showError = (text: string) => {
  snackbar.value = { show: true, text, color: 'error' };
};

const taskTitle = (t: Task): string => {
  const label = jobLabel[t.jobType] ?? t.jobType;
  let hint = '';
  if (t.payload?.target_user_id)                     hint = `user: ${t.payload.target_user_id}`;
  else if (t.payload?.target_start_date)             hint = `${t.payload.target_start_date} ~ ${t.payload.target_end_date ?? ''}`;
  else if (t.payload?.image_id)                      hint = `image #${t.payload.image_id}`;
  else if (t.payload?.credential_id)                 hint = `credential #${t.payload.credential_id}`;
  return label + (hint ? ': ' + hint : '');
};

const formatDate = (s: string | null) => {
  if (!s) return '-';
  return new Date(s).toLocaleString();
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

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(fetchRoots);
</script>

<template>
  <v-container>

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <v-row align="center" class="mb-4">
      <v-col>
        <h2>任务管理</h2>
        <span class="text-caption text-medium-emphasis">共 {{ total }} 条根任务</span>
      </v-col>
      <v-col cols="auto" class="d-flex ga-2">
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="createDialog = true">
          创建任务
        </v-btn>
      </v-col>
    </v-row>

    <!-- ── Filters ───────────────────────────────────────────────────── -->
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

    <!-- ── Root task list ─────────────────────────────────────────────── -->
    <div ref="scrollContainer" class="task-scroll-container">
      <template v-if="loading">
        <v-skeleton-loader v-for="i in 5" :key="i" type="list-item-two-line" class="mb-2" />
      </template>

      <v-expansion-panels
        v-else-if="sortedRoots.length > 0"
        variant="accordion"
        multiple
        @update:model-value="onRootExpandChange"
      >
        <v-expansion-panel
          v-for="root in sortedRoots"
          :key="root.id"
          :value="root.id"
          class="mb-2"
        >
          <!-- Root panel title -->
          <v-expansion-panel-title class="py-3 px-4">
            <div class="d-flex align-center" style="width: 100%; min-width: 0;">
              <v-chip
                :color="statusColor[root.status] ?? 'grey'"
                size="small"
                label
                class="flex-shrink-0 mr-3"
              >
                {{ statusLabel[root.status] ?? root.status }}
              </v-chip>
              <span class="font-weight-medium text-truncate" style="min-width: 0; flex: 1;">
                {{ taskTitle(root) }}
              </span>
              <span class="text-caption text-medium-emphasis ml-3 flex-shrink-0">
                {{ formatDate(root.runAt) }}
              </span>
            </div>
          </v-expansion-panel-title>

          <!-- Root panel content -->
          <v-expansion-panel-text>

            <!-- Basic info — 2-column grid -->
            <div class="root-info-grid mb-4">
              <div class="info-item">
                <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">状态</span>
                <v-chip :color="statusColor[root.status] ?? 'grey'" size="x-small" label>
                  {{ statusLabel[root.status] ?? root.status }}
                </v-chip>
              </div>
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
            <v-expansion-panels v-if="root.payload || root.lastResult" variant="popout" class="mb-4">
              <v-expansion-panel v-if="root.payload" title="参数">
                <v-expansion-panel-text>
                  <pre class="json-block">{{ formatJson(root.payload) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel v-if="root.lastResult" title="执行结果">
                <v-expansion-panel-text>
                  <pre class="json-block">{{ formatJson(root.lastResult) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Root action buttons -->
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

            <v-divider class="mb-4" />

            <!-- ── Subtask controls bar ─────────────────────────────── -->
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
                :items="typeItems"
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

            <!-- ── Subtask list (nested accordion) ─────────────────── -->
            <div v-if="subtaskMap[root.id]?.loading" class="py-2">
              <v-skeleton-loader v-for="j in 3" :key="j" type="list-item-two-line" class="mb-1" />
            </div>

            <v-expansion-panels
              v-else-if="(subtaskMap[root.id]?.items ?? []).length > 0"
              variant="accordion"
              class="subtask-panels"
            >
              <v-expansion-panel
                v-for="child in subtaskMap[root.id].items"
                :key="child.id"
                density="compact"
              >
                <v-expansion-panel-title class="py-2 px-3">
                  <div class="d-flex align-center" style="width: 100%; min-width: 0;">
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
                </v-expansion-panel-title>

                <v-expansion-panel-text>
                  <v-list density="compact" class="py-0">
                    <v-list-item>
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">状态</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-chip :color="statusColor[child.status] ?? 'grey'" size="x-small" label>
                          {{ statusLabel[child.status] ?? child.status }}
                        </v-chip>
                      </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">类型</v-list-item-title>
                      <v-list-item-subtitle>{{ jobLabel[child.jobType] ?? child.jobType }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">重试次数</v-list-item-title>
                      <v-list-item-subtitle>{{ child.attempts }} / {{ child.maxAttempts }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">创建时间</v-list-item-title>
                      <v-list-item-subtitle>{{ formatDate(child.runAt) }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="child.doneAt">
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">完成时间</v-list-item-title>
                      <v-list-item-subtitle>{{ formatDate(child.doneAt) }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="child.payload">
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">参数</v-list-item-title>
                      <v-list-item-subtitle>
                        <pre class="json-block" style="max-height: 120px;">{{ formatJson(child.payload) }}</pre>
                      </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="child.lastResult">
                      <v-list-item-title class="text-caption text-medium-emphasis font-weight-medium">结果</v-list-item-title>
                      <v-list-item-subtitle>
                        <pre class="json-block" style="max-height: 120px;">{{ formatJson(child.lastResult) }}</pre>
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>

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

            <v-alert
              v-else-if="subtaskMap[root.id]?.loaded"
              type="info"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              暂无子任务
            </v-alert>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-alert v-else type="info" variant="tonal" class="mt-2">暂无任务</v-alert>
    </div>

    <!-- ── Pagination ───────────────────────────────────────────────────── -->
    <div v-if="totalPages > 1" class="d-flex flex-column align-center mt-4">
      <v-pagination
        v-model="page"
        :length="totalPages"
        :total-visible="5"
        :disabled="loading"
        rounded="circle"
        @update:model-value="fetchRoots"
      />
      <span class="text-caption text-medium-emphasis mt-1">
        第 {{ page }} / {{ totalPages }} 页
      </span>
    </div>

    <!-- ── Create dialog ────────────────────────────────────────────────── -->
    <v-dialog v-model="createDialog" max-width="520">
      <v-card>
        <v-card-title>创建爬取任务</v-card-title>
        <v-card-text>
          <v-form ref="createFormRef" @submit.prevent="submitCreate">
            <v-text-field v-model.number="createForm.crawler_id" label="Crawler ID" type="number" :rules="requiredRule" />
            <v-select v-model="createForm.crawl_type" :items="crawlTypeItems" label="爬取类型" :rules="requiredRule" />
            <v-text-field
              v-if="createForm.crawl_type === 1"
              v-model="createForm.target_user_id"
              label="目标用户 ID"
              :rules="requiredRule"
            />
            <v-text-field
              v-if="createForm.crawl_type === 0"
              v-model="createForm.target_start_date"
              label="开始日期"
              type="date"
              :rules="requiredRule"
            />
            <v-text-field
              v-if="createForm.crawl_type === 0"
              v-model="createForm.target_end_date"
              label="结束日期"
              type="date"
              :rules="requiredRule"
            />
            <v-text-field v-model="createForm.target_search_prompt" label="搜索关键词（可选）" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="取消" @click="createDialog = false" />
          <v-btn color="primary" text="提交" :loading="creating" @click="submitCreate" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── Cancel single task dialog ────────────────────────────────────── -->
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

    <!-- ── Interrupt all pending subtasks dialog ────────────────────────── -->
    <v-dialog v-model="interruptDialog" max-width="420">
      <v-card>
        <v-card-title>取消所有待处理子任务</v-card-title>
        <v-card-text>
          将取消此根任务下所有待处理状态的子任务，不可撤销。
          <template v-if="interruptId && subtaskMap[interruptId]?.filterType">
            <br />
            <strong>当前类型筛选：</strong>
            {{ jobLabel[subtaskMap[interruptId].filterType!] ?? subtaskMap[interruptId].filterType }}
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

    <!-- ── Snackbar ─────────────────────────────────────────────────────── -->
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
