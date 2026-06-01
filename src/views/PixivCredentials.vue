<script setup lang="ts">
import Axios from '../axios/axios';
import { ref, onMounted } from 'vue';

interface PixivCredential {
  id: number;
  pixiv_user_id: string;
  status: number;
  note: string | null;
  last_used_at: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CredentialToken {
  id: number;
  pixiv_user_id: string;
  refresh_token: string;
  access_token: string | null;
}

const credentials = ref<PixivCredential[]>([]);
const loading = ref(false);
const dialogOpen = ref(false);
const editMode = ref(false);
const editId = ref<number | null>(null);

// 表单
const form = ref({
  pixiv_user_id: '',
  refresh_token: '',
  note: '',
});

// 编辑表单（PATCH）
const editForm = ref({
  refresh_token: '',
  status: 0,
  note: '',
});

// token 查看弹窗
const tokenDialog = ref(false);
const tokenLoading = ref(false);
const tokenData = ref<CredentialToken | null>(null);

// 刷新状态
const refreshingId = ref<number | null>(null);

// Snackbar
const snackbar = ref({ show: false, text: '', color: 'success' });

// 删除确认弹窗
const deleteDialog = ref(false);
const deleteId = ref<number | null>(null);

const statusLabels: Record<number, string> = {
  0: '正常',
  1: '已过期',
  2: '已禁用',
  3: '频率受限',
};

const statusColors: Record<number, string> = {
  0: 'green',
  1: 'orange',
  2: 'red',
  3: 'purple',
};

const fetchCredentials = async () => {
  loading.value = true;
  try {
    const res = await Axios.get('/pixiv-credential');
    if (res.status === 200) credentials.value = res.data;
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editMode.value = false;
  form.value = { pixiv_user_id: '', refresh_token: '', note: '' };
  dialogOpen.value = true;
};

const openEdit = (cred: PixivCredential) => {
  editMode.value = true;
  editId.value = cred.id;
  editForm.value = {
    refresh_token: '',
    status: cred.status,
    note: cred.note ?? '',
  };
  dialogOpen.value = true;
};

const submitForm = async () => {
  if (editMode.value && editId.value !== null) {
    const body: any = { status: editForm.value.status };
    if (editForm.value.note) body.note = editForm.value.note;
    if (editForm.value.refresh_token) body.refresh_token = editForm.value.refresh_token;
    await Axios.patch(`/pixiv-credential/${editId.value}`, body);
  } else {
    await Axios.post('/pixiv-credential', form.value);
  }
  dialogOpen.value = false;
  await fetchCredentials();
};

const openDelete = (id: number) => {
  deleteId.value = id;
  deleteDialog.value = true;
};

const confirmDelete = async () => {
  if (deleteId.value === null) return;
  await Axios.delete(`/pixiv-credential/${deleteId.value}`);
  deleteDialog.value = false;
  deleteId.value = null;
  await fetchCredentials();
};

const refreshToken = async (id: number) => {
  refreshingId.value = id;
  try {
    const res = await Axios.post(`/pixiv-credential/${id}/refresh`);
    if (res.status === 200) {
      snackbar.value = { show: true, text: '刷新任务已提交', color: 'success' };
    }
  } finally {
    refreshingId.value = null;
  }
};

const viewToken = async (id: number) => {
  tokenDialog.value = true;
  tokenLoading.value = true;
  tokenData.value = null;
  try {
    const res = await Axios.get(`/pixiv-credential/${id}/token`);
    if (res.status === 200) tokenData.value = res.data;
  } finally {
    tokenLoading.value = false;
  }
};

const formatDate = (s: string | null) => {
  if (!s) return '-';
  return new Date(s).toLocaleString();
};

onMounted(fetchCredentials);
</script>

<template>
  <v-container>
    <v-row align="center" class="mb-4">
      <v-col>
        <h2>Pixiv 凭证管理</h2>
      </v-col>
      <v-col cols="auto">
        <v-btn color="primary" @click="openCreate">添加凭证</v-btn>
      </v-col>
    </v-row>

    <v-data-table :items="credentials" :loading="loading" item-key="id" :headers="[
      { title: 'ID', key: 'id', width: 60 },
      { title: 'Pixiv 用户 ID', key: 'pixiv_user_id' },
      { title: '状态', key: 'status', width: 100 },
      { title: '备注', key: 'note' },
      { title: '最后刷新', key: 'last_refreshed_at', width: 180 },
      { title: '创建时间', key: 'created_at', width: 180 },
      { title: '操作', key: 'actions', sortable: false, width: 280 },
    ]">
      <template v-slot:item.status="{ item }">
        <v-chip :color="statusColors[item.status] ?? 'grey'" size="small" label>
          {{ statusLabels[item.status] ?? `未知(${item.status})` }}
        </v-chip>
      </template>
      <template v-slot:item.last_refreshed_at="{ item }">
        {{ formatDate(item.last_refreshed_at) }}
      </template>
      <template v-slot:item.created_at="{ item }">
        {{ formatDate(item.created_at) }}
      </template>
      <template v-slot:item.actions="{ item }">
        <v-btn size="small" variant="text" color="primary" @click="openEdit(item)">编辑</v-btn>
        <v-btn size="small" variant="text" color="info" @click="viewToken(item.id)">查看Token</v-btn>
        <v-btn size="small" variant="text" color="warning" :loading="refreshingId === item.id"
          @click="refreshToken(item.id)">刷新</v-btn>
        <v-btn size="small" variant="text" color="error" @click="openDelete(item.id)">删除</v-btn>
      </template>
    </v-data-table>

    <!-- 创建/编辑弹窗 -->
    <v-dialog v-model="dialogOpen" max-width="500">
      <v-card>
        <v-card-title>{{ editMode ? '编辑凭证' : '添加凭证' }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="submitForm">
            <template v-if="!editMode">
              <v-text-field v-model="form.pixiv_user_id" label="Pixiv 用户 ID" required />
              <v-text-field v-model="form.refresh_token" label="Refresh Token" required />
              <v-text-field v-model="form.note" label="备注（可选）" />
            </template>
            <template v-else>
              <v-text-field v-model="editForm.refresh_token" label="新 Refresh Token（留空不更新）" />
              <v-select v-model="editForm.status" :items="[
                { title: '正常', value: 0 },
                { title: '已过期', value: 1 },
                { title: '已禁用', value: 2 },
                { title: '频率受限', value: 3 },
              ]" label="状态" />
              <v-text-field v-model="editForm.note" label="备注" />
            </template>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="取消" @click="dialogOpen = false" />
          <v-btn color="primary" text="保存" @click="submitForm" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Token 查看弹窗 -->
    <v-dialog v-model="tokenDialog" max-width="500">
      <v-card :loading="tokenLoading">
        <v-card-title>凭证 Token</v-card-title>
        <v-card-text v-if="tokenData">
          <div class="mb-2"><strong>ID:</strong> {{ tokenData.id }}</div>
          <div class="mb-2"><strong>Pixiv User ID:</strong> {{ tokenData.pixiv_user_id }}</div>
          <div class="mb-2">
            <strong>Refresh Token:</strong>
            <code class="d-block mt-1" style="word-break: break-all; white-space: pre-wrap;">{{ tokenData.refresh_token }}</code>
          </div>
          <div>
            <strong>Access Token:</strong>
            <code class="d-block mt-1" style="word-break: break-all; white-space: pre-wrap;">{{ tokenData.access_token ?? '(无)' }}</code>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="关闭" @click="tokenDialog = false" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认弹窗 -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>确定要删除此凭证吗？此操作不可撤销。</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="取消" @click="deleteDialog = false" />
          <v-btn color="error" text="删除" @click="confirmDelete" />
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="top">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
