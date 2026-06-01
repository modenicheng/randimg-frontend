<script setup lang="ts">
import Axios from '../axios/axios';
import { ref, computed, onMounted } from 'vue';

interface Task {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_at: string | null;
  done_at: string | null;
  last_result: string | null;
  priority: number;
  payload?: any;
}

const tasks = ref<Task[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const pageSize = 20;

const filterType = ref<string | null>(null);
const filterStatus = ref<string | null>(null);

const createDialog = ref(false);
const creating = ref(false);
const cancelAllDialog = ref(false);
const cancellingAll = ref(false);
const cancelTaskDialog = ref(false);
const cancelTaskId = ref<string | null>(null);
const retryTaskDialog = ref(false);
const retryTaskId = ref<string | null>(null);
const createForm = ref({
  crawler_id: 1,
  crawl_type: 1,
  target_user_id: '',
  target_start_date: '',
  target_end_date: '',
  target_search_prompt: '',
});

const snackbar = ref({ show: false, text: '', color: 'error' });

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const statusColor: Record<string, string> = {
  pending: 'blue',
  running: 'orange',
  completed: 'green',
  failed: 'red',
  killed: 'grey',
};

const statusLabel: Record<string, string> = {
  pending: '待处理',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  killed: '已取消',
};

const jobLabel: Record<string, string> = {
  crawl: '爬取',
  download: '下载',
  color_extract: '颜色提取',
  upload: '上传',
  accessibility_check: '合规检查',
  discover: '发现',
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

/** Status sort priority: running → pending → failed/killed → completed */
const statusOrder: Record<string, number> = {
  running: 0,
  pending: 1,
  failed: 2,
  killed: 3,
  completed: 4,
};

const sortedTasks = computed(() =>
  [...tasks.value].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
);

const fetchTasks = async () => {
  loading.value = true;
  tasks.value = [];
  try {
    const params: Record<string, any> = {
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    };
    if (filterType.value) params.task_type = filterType.value;
    if (filterStatus.value) params.status = filterStatus.value;

    const res = await Axios.get('/tasks', { params });
    if (res.status === 200) {
      tasks.value = res.data.tasks ?? [];
      total.value = res.data.total ?? 0;
    }
  } catch (e: any) {
    showError(e.response?.data?.message ?? '加载失败');
  } finally {
    loading.value = false;
  }
};

const applyFilter = () => {
  page.value = 1;
  fetchTasks();
};

const submitCreate = async () => {
  creating.value = true;
  try {
    const body: any = {
      crawler_id: createForm.value.crawler_id,
      crawl_type: createForm.value.crawl_type,
    };
    if (createForm.value.target_user_id) body.target_user_id = createForm.value.target_user_id;
    if (createForm.value.target_start_date) body.target_start_date = createForm.value.target_start_date;
    if (createForm.value.target_end_date) body.target_end_date = createForm.value.target_end_date;
    if (createForm.value.target_search_prompt) body.target_search_prompt = createForm.value.target_search_prompt;

    await Axios.post('/crawler', body);
    createDialog.value = false;
    snackbar.value = { show: true, text: '爬取任务已提交', color: 'success' };
    await fetchTasks();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '提交失败');
  } finally {
    creating.value = false;
  }
};

const openCancelTask = (id: string) => {
  cancelTaskId.value = id;
  cancelTaskDialog.value = true;
};

const confirmCancelTask = async () => {
  if (!cancelTaskId.value) return;
  try {
    await Axios.delete(`/tasks/${cancelTaskId.value}`);
    snackbar.value = { show: true, text: '任务已取消', color: 'success' };
    await fetchTasks();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '取消失败');
  } finally {
    cancelTaskDialog.value = false;
    cancelTaskId.value = null;
  }
};

const openRetryTask = (id: string) => {
  retryTaskId.value = id;
  retryTaskDialog.value = true;
};

const confirmRetryTask = async () => {
  if (!retryTaskId.value) return;
  try {
    await Axios.post(`/tasks/${retryTaskId.value}/retry`);
    snackbar.value = { show: true, text: '任务已重试', color: 'success' };
    await fetchTasks();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '重试失败');
  } finally {
    retryTaskDialog.value = false;
    retryTaskId.value = null;
  }
};

const cancelAllTasks = async () => {
  cancellingAll.value = true;
  try {
    const params: Record<string, any> = {};
    if (filterType.value) params.task_type = filterType.value;
    const res = await Axios.delete('/tasks/pending', { params });
    cancelAllDialog.value = false;
    snackbar.value = {
      show: true,
      text: `已取消 ${res.data.deleted ?? 0} 个任务`,
      color: 'success',
    };
    await fetchTasks();
  } catch (e: any) {
    showError(e.response?.data?.message ?? '取消失败');
  } finally {
    cancellingAll.value = false;
  }
};

const showError = (text: string) => {
  snackbar.value = { show: true, text, color: 'error' };
};

const taskTitle = (t: Task): string => {
  const label = jobLabel[t.job_type] ?? t.job_type;
  let hint = '';
  if (t.payload?.target_user_id) hint = `user: ${t.payload.target_user_id}`;
  else if (t.payload?.target_start_date) hint = `${t.payload.target_start_date} ~ ${t.payload.target_end_date ?? ''}`;
  else if (t.payload?.image_id) hint = `image #${t.payload.image_id}`;
  return `${label}${hint ? ': ' + hint : ''}`;
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

onMounted(fetchTasks);
</script>

<template>
  <v-container>
    <!-- Header -->
    <v-row align="center" class="mb-4">
      <v-col>
        <h2>任务管理</h2>
      </v-col>
      <v-col cols="auto" class="d-flex ga-2">
        <v-btn color="error" variant="outlined" @click="cancelAllDialog = true">取消所有任务</v-btn>
        <v-btn color="primary" @click="createDialog = true">创建任务</v-btn>
      </v-col>
    </v-row>

    <!-- Filters -->
    <v-row dense class="mb-4" align="center">
      <v-col cols="12" sm="4">
        <v-select v-model="filterType" :items="typeItems" label="任务类型" clearable density="comfortable" hide-details />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select v-model="filterStatus" :items="statusItems" label="状态" clearable density="comfortable" hide-details />
      </v-col>
      <v-col cols="12" sm="4" class="d-flex align-center">
        <v-btn color="primary" @click="applyFilter" :loading="loading" class="mr-2">筛选</v-btn>
        <span class="text-caption text-medium-emphasis">共 {{ total }} 条</span>
      </v-col>
    </v-row>

    <!-- Accordion task list -->
    <div style="max-height: 65vh; overflow-y: auto;">
      <!-- Skeleton loading -->
      <template v-if="loading">
        <v-skeleton-loader v-for="i in 5" :key="i" type="list-item-two-line" class="mb-1" />
      </template>

      <v-expansion-panels v-else-if="sortedTasks.length > 0" variant="accordion" multiple>
        <v-expansion-panel v-for="task in sortedTasks" :key="task.id">
          <v-expansion-panel-title class="pa-3">
            <div class="d-flex align-center" style="width: 100%; min-width: 0;">
              <v-chip :color="statusColor[task.status] ?? 'grey'" size="small" label class="flex-shrink-0 mr-3">
                {{ statusLabel[task.status] ?? task.status }}
              </v-chip>
              <span class="font-weight-medium text-truncate flex-grow-1" style="min-width: 0;">
                {{ taskTitle(task) }}
              </span>
              <span class="text-caption text-medium-emphasis ml-3 flex-shrink-0">
                {{ formatDate(task.run_at) }}
              </span>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <v-list density="compact" class="py-0">
              <v-list-item>
                <v-list-item-title>状态</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip :color="statusColor[task.status] ?? 'grey'" size="small" label>
                    {{ statusLabel[task.status] ?? task.status }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>重试次数</v-list-item-title>
                <v-list-item-subtitle>{{ task.attempts }} / {{ task.max_attempts }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>创建时间</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(task.run_at) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>完成时间</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(task.done_at) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="task.priority">
                <v-list-item-title>优先级</v-list-item-title>
                <v-list-item-subtitle>{{ task.priority }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="task.payload">
                <v-list-item-title>参数</v-list-item-title>
                <v-list-item-subtitle>
                  <pre class="text-caption bg-grey-lighten-4 pa-2 rounded mt-1"
                    style="max-height: 160px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">{{ formatJson(task.payload) }}</pre>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="task.last_result">
                <v-list-item-title>结果</v-list-item-title>
                <v-list-item-subtitle>
                  <pre class="text-caption bg-grey-lighten-4 pa-2 rounded mt-1"
                    style="max-height: 160px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">{{ formatJson(task.last_result) }}</pre>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-divider class="my-2" />
            <div class="d-flex justify-end ga-2">
              <v-btn v-if="task.status === 'pending'" size="small" color="error" variant="outlined"
                @click="openCancelTask(task.id)">取消</v-btn>
              <v-btn v-if="task.status === 'failed' || task.status === 'killed'" size="small" color="warning"
                variant="outlined" @click="openRetryTask(task.id)">重试</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-alert v-else type="info" variant="tonal" class="mt-2">暂无任务</v-alert>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="d-flex flex-column align-center mt-4">
      <v-pagination v-model="page" :length="totalPages" :total-visible="5" :disabled="loading"
        @update:model-value="fetchTasks" rounded="circle" />
      <span class="text-caption text-medium-emphasis mt-1">第 {{ page }} / {{ totalPages }} 页</span>
    </div>

    <!-- Create Task Dialog -->
    <v-dialog v-model="createDialog" max-width="520">
      <v-card>
        <v-card-title>创建爬取任务</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="submitCreate">
            <v-text-field v-model.number="createForm.crawler_id" label="Crawler ID" type="number" required />
            <v-select v-model="createForm.crawl_type" :items="crawlTypeItems" label="爬取类型" />
            <v-text-field v-if="createForm.crawl_type === 1" v-model="createForm.target_user_id"
              label="目标用户 ID" />
            <v-text-field v-if="createForm.crawl_type === 0" v-model="createForm.target_start_date"
              label="开始日期" type="date" />
            <v-text-field v-if="createForm.crawl_type === 0" v-model="createForm.target_end_date"
              label="结束日期" type="date" />
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

    <!-- Cancel All Confirmation Dialog -->
    <v-dialog v-model="cancelAllDialog" max-width="420">
      <v-card>
        <v-card-title>确认取消所有任务</v-card-title>
        <v-card-text>
          此操作将删除所有待处理的任务{{ filterType ? `（类型: ${jobLabel[filterType] ?? filterType}）` : '' }}，不可撤销。确定继续吗？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="cancelAllDialog = false" />
          <v-btn color="error" text="确认取消" :loading="cancellingAll" @click="cancelAllTasks" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cancel Task Confirmation Dialog -->
    <v-dialog v-model="cancelTaskDialog" max-width="400">
      <v-card>
        <v-card-title>确认取消任务</v-card-title>
        <v-card-text>确定要取消此任务吗？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="cancelTaskDialog = false" />
          <v-btn color="error" text="确认取消" @click="confirmCancelTask" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Retry Task Confirmation Dialog -->
    <v-dialog v-model="retryTaskDialog" max-width="400">
      <v-card>
        <v-card-title>确认重试任务</v-card-title>
        <v-card-text>确定要重试此任务吗？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="返回" @click="retryTaskDialog = false" />
          <v-btn color="warning" text="确认重试" @click="confirmRetryTask" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="top">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
