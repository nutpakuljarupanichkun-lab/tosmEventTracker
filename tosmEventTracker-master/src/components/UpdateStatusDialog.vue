// src/components/UpdateStatusDialog.vue

<template>
  <el-dialog
    :model-value="modelValue"
    @update:modelValue="$emit('update:modelValue', $event)"
    title="อัปเดตสถานะ"
    width="400px"
    :show-close="false"
    :close-on-click-modal="true"
    align-center
  >
    <span style="font-size: large;">{{ showName }}</span>
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 300px;
        margin: 0 auto 20px;
      "
    >
      <el-input
        v-if="featureFlags?.nosec"
        v-model="newCdTimeInput"
        placeholder="ชม.นาที + enter"
        style="width: 230px"
        @keyup.enter="handleCustomCd"
      />
      <el-input
        v-else
        v-model="newCdTimeInput"
        placeholder="ชม.นาที.วินาที + enter"
        style="width: 230px"
        @keyup.enter="handleCustomCd"
      />
      <el-button
        type="warning"
        @click="handleCustomCd"
        style="width: 60px; margin-left: 5px"
      >
        อัปเดต CD
      </el-button>
    </div>

    <!-- ขั้น -->
    <div
      style="
        width: 300px;
        margin: 0 auto 20px;
        display: flex;
        justify-content: space-between;
      "
    >
      <div
        v-for="i in currentNote?.maxStages || 4"
        :key="`stage-${i}`"
        style="text-align: center; margin-bottom: 5px"
      >
        <el-button @click="handleSelection(`stage_${i}`)" style="width: 70px">
          ขั้น {{ i }}/{{ currentNote?.maxStages || 4 }}
        </el-button>
      </div>
    </div>

    <!-- ON -->
    <div :span="24" style="text-align: center; margin-bottom: 10px">
      <el-button
        type="success"
        @click="handleSelection('on')"
        style="width: 300px"
      >
        ON
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, inject, Ref } from "vue";
import { ElMessage } from "element-plus";
import type { Note, NoteState } from "@/types/Note";

const featureFlags = inject<Ref<{ nosec: boolean }>>("feature-flags");

const props = defineProps<{
  modelValue: boolean;
  currentNote: Note | null;
  showName: string;
}>();

const emit = defineEmits([
  "update:modelValue",
  "update-note-status",
  "update-note-cd",
]);

const newCdTimeInput = ref<string>("");

watch(
  () => props.currentNote,
  () => {
    newCdTimeInput.value = "";
  }
);

const handleSelection = (action: string) => {
  emit("update:modelValue", false);
  if (!props.currentNote) return;

  let newState: NoteState;
  let newTime: number | null = null;

  if (action === "on") {
    newState = "ON";
    newTime =
      props.currentNote.state === "ON" ? props.currentNote.onTime : Date.now();
  } else {
    const stage = action.split("_")[1];
    newState = `STAGE_${stage}` as NoteState;
    newTime =
      props.currentNote.state === `STAGE_${stage}` &&
      props.currentNote.stageTime
        ? props.currentNote.stageTime
        : Date.now();
  }

  emit("update-note-status", props.currentNote.id, newState, newTime);
};

const handleCustomCd = () => {
  const timeStr = newCdTimeInput.value.trim();
  let respawnTime: number | null = null;

  if (!timeStr) {
    ElMessage.error("กรุณาใส่เวลา!");
    return;
  }

  if (timeStr.includes(":") || timeStr.includes(".")) {
    const timeParts = featureFlags?.value.nosec
      ? (timeStr + ".0").split(/[.:]/).map(Number)
      : timeStr.split(/[.:]/).map(Number);
    let totalSeconds = 0;

    if (timeParts.length === 2) {
      totalSeconds = timeParts[0] * 60 + (timeParts[1] || 0);
    } else if (timeParts.length === 3) {
      totalSeconds =
        timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);
    } else {
      ElMessage.error("รูปแบบเวลาไม่ถูกต้อง กรุณาใช้ นาที:วินาที หรือ ชม:นาที:วินาที");
      return;
    }
    respawnTime = Date.now() + totalSeconds * 1000;
  } else if (!isNaN(parseInt(timeStr))) {
    const minutes = parseInt(timeStr);
    respawnTime = Date.now() + minutes * 60 * 1000;
  } else {
    ElMessage.error("รูปแบบเวลาไม่ถูกต้อง กรุณาใส่ตัวเลขหรือรูปแบบเวลา");
    return;
  }

  if (respawnTime === null) {
    ElMessage.error("ไม่สามารถอ่านค่าเวลาได้");
    return;
  }

  emit("update:modelValue", false);
  emit("update-note-cd", props.currentNote?.id, respawnTime);
};
</script>