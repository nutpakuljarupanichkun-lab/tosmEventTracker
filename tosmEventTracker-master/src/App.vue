<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <div
            v-if="featureFlags?.nosec"
            type="warning"
            style="text-align: left; color: #aaa;"
          >
            โหมด: ไม่ใช้วินาที <br />
            (ตัวอย่าง) CD 1 ชั่วโมง 23 นาที ใส่ <b>1.23</b> <br />
            (ตัวอย่าง) CD 5 นาที ใส่ <b>5</b>
          </div>
        </div>
        <div class="header-right">
          <el-switch
            v-model="isDark"
            inline-prompt
            :active-icon="Moon"
            :inactive-icon="Sunny"
            size="large"
            class="dark-mode-switch"
          />
        </div>
      </div>
    </el-header>
    <el-main class="app-main">
      <NoteInput
        @add-note="handleAddNewNote"
        :hasSound="hasInputSoundOn"
        :maps="maps"
        @update-map-star="handleUpdateMapStar"
      />
      <div class="list-card-container">
        <NoteList
          :notes="notes"
          :currentSortMode="currentSortMode"
          @delete-note="handleDeleteNote"
          @clear-notes="handleClearAllNotes"
          @toggle-sort="toggleSort"
          @update-note-status="handleUpdateNoteStatus"
          @update-note-channel="handleUpdateNoteChannel"
          @toggle-input-sound="handleToggleInputSound"
          :maps="maps"
          @update-map-star="handleUpdateMapStar"
          @show-update-dialog="handleShowUpdateDialog"
          :mapImageCache="mapImageCache"
        />
      </div>
      <UpdateStatusDialog
        v-model="showUpdateDialog"
        :current-note="currentNoteToUpdate"
        :showName="updateMapName"
        @update-note-status="handleUpdateNoteStatus"
        @update-note-cd="handleUpdateNoteCd"
      />
    </el-main>
    <div class="import-export-section">
      <div class="import-export-buttons">
        <el-button type="primary" @click="exportNotes">ส่งออกข้อมูล</el-button>
        <el-button type="success" @click="handleImportClick">นำเข้าข้อมูล</el-button>
      </div>
      <el-input
        v-model="importExportData"
        type="textarea"
        :rows="5"
        placeholder="ข้อมูลที่ส่งออกจะแสดงที่นี่ หรือวางข้อมูลที่ต้องการนำเข้าตรงนี้"
      ></el-input>
    </div>
  </el-container>
  <a
    v-if="featureFlags?.en"
    href="https://github.com/xlisyuan/tosmEventTracker/issues"
    target="_blank"
    rel="noopener noreferrer"
    title="github"
  >
    Lis Taiwan
  </a>
  <a
    v-else
    href="https://forum.gamer.com.tw/C.php?bsn=74968&snA=700"
    target="_blank"
    rel="noopener noreferrer"
    title="ข้อมูลเพิ่มเติม"
  >
    ข้อมูลเพิ่มเติม
  </a>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, h, provide } from "vue";
import { db } from "./firebase";
import { ref as dbRef, onValue, set } from "firebase/database";

const featureFlags = ref({
  nosec: false,
  pic: false,
  en: false,
});
provide("feature-flags", featureFlags);

import { v4 as uuidv4 } from "uuid";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import UpdateStatusDialog from "./components/UpdateStatusDialog.vue";
import type { Note, NoteState } from "./types/Note";
import { ElMessage, ElMessageBox } from "element-plus";
import { maps as originalMaps, type MapData } from "./data/maps";
import packageInfo from "../package.json";
import { Sunny, Moon } from "@element-plus/icons-vue";

const isDark = ref(false);

watch(isDark, (newValue) => {
  if (newValue) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
});

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const settingsParam = urlParams.get("setting");

  if (settingsParam) {
    const enabledFeatures = settingsParam.split(",");
    if (enabledFeatures.includes("nosec")) {
      featureFlags.value.nosec = true;
    }
    if (enabledFeatures.includes("pic")) {
      featureFlags.value.pic = true;
    }
    if (enabledFeatures.includes("en")) {
      featureFlags.value.en = true;
    }
  }
});

const mapMigrations: ((mapsData: MapData[]) => MapData[])[] = [
  (mapsData) => {
    const correctTiraMap = originalMaps.find(
      (map) => map.name === "堤拉修道院"
    );
    if (!correctTiraMap) {
      throw new Error("Missing correct map data for V0→V1 migration.");
    }
    return mapsData.map((map) =>
      map.name === "提拉修道院"
        ? {
            ...map,
            name: correctTiraMap.name,
            imagePath: correctTiraMap.imagePath,
          }
        : map
    );
  },
  (mapsData) => {
    const originalMapsEnNames = new Map(
      originalMaps.map((map) => [map.name, map.enName])
    );
    const migratedMaps = mapsData.map((map) => {
      const newEnName = originalMapsEnNames.get(map.name);
      if (newEnName) {
        return { ...map, enName: newEnName };
      }
      return map;
    });
    return migratedMaps;
  },
];

const savedMaps = localStorage.getItem("mapData");
let mapsData = savedMaps ? JSON.parse(savedMaps) : [];

const existingEpisodes = new Set(mapsData.map((map: MapData) => map.episode));
const newMaps = originalMaps.filter((newMap: MapData) => {
  return !existingEpisodes.has(newMap.episode);
});
mapsData.push(...newMaps);

const mapVersion = localStorage.getItem("mapVersion") || "0";
const mapMigrationIndex = parseInt(mapVersion, 10);
let migrationSuccess = true;
try {
  for (let i = mapMigrationIndex; i < mapMigrations.length; i++) {
    mapsData = mapMigrations[i](mapsData);
  }
} catch (error) {
  migrationSuccess = false;
}

if (migrationSuccess) {
  localStorage.setItem("mapVersion", mapMigrations.length.toString());
}
localStorage.setItem("mapData", JSON.stringify(mapsData));

const maps = ref(mapsData);
const mapImageCache = ref<Record<string, string>>({});

const loadMapImage = async (noteText: string) => {
  const mapData = maps.value.find((m: MapData) => m.name === noteText);
  if (
    featureFlags?.value.pic &&
    mapData?.imagePath &&
    !mapImageCache.value[mapData.name]
  ) {
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = mapData.imagePath as string;
      });
      mapImageCache.value[mapData.name] = mapData.imagePath;
    } catch (e) {
      console.error(`ไม่สามารถโหลดรูปแผนที่: ${mapData.imagePath}`, e);
    }
  }
};

const notes = ref<Note[]>([]);
const currentSortMode = ref<"time" | "map">("time");
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const hasInputSoundOn = ref(true);
const importExportData = ref("");

const showUpdateDialog = ref(false);
const currentNoteToUpdate = ref<Note | null>(null);
const updateMapName = ref("");

const handleShowUpdateDialog = (noteId: string) => {
  const note = notes.value.find((n) => n.id === noteId);
  if (note) {
    currentNoteToUpdate.value = note;
    showUpdateDialog.value = true;
    const finalMapName = featureFlags.value.en
      ? (() => {
          const mapData = maps.value.find(
            (m: MapData) => m.name === note.noteText
          );
          return mapData ? mapData.enName : note.noteText;
        })()
      : note.noteText;
    updateMapName.value = `Lv. ${note.mapLevel} ${finalMapName} Ch. ${note.channel}`;
  }
};

const toggleSort = () => {
  currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
  notes.value.sort(sortNotesArray);
};

const loadNotes = () => {
  const roomId = new URLSearchParams(window.location.search).get("room") || "default";
  onValue(dbRef(db, `rooms/${roomId}/notes`), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      notes.value = JSON.parse(data).map((note: Note) => {
        const mapData = maps.value.find(
          (m: MapData) => m.level === note.mapLevel && m.name === note.noteText
        );
        if (mapData) {
          return { ...note, isStarred: mapData.isStarred, noteText: mapData.name, maxStages: mapData.maxStages };
        }
        return note;
      });
    } else {
      // ถ้า Firebase ไม่มีข้อมูล ให้โหลดจาก localStorage แทน
      const savedNotes = localStorage.getItem("notes");
      if (savedNotes) {
        notes.value = JSON.parse(savedNotes).map((note: Note) => {
          const mapData = maps.value.find(
            (m: MapData) => m.level === note.mapLevel && m.name === note.noteText
          );
          if (mapData) {
            return {
              ...note,
              isStarred: mapData.isStarred,
              noteText: mapData.name,
              maxStages: mapData.maxStages,
              imagePath: (note as any).imagePath || mapData.imagePath,
            };
          }
          return note;
        });
      }
    }
  });
};
      const mapData = maps.value.find(
        (m: MapData) => m.level === note.mapLevel && m.name === note.noteText
      );
      if (mapData) {
        return {
          ...note,
          isStarred: mapData.isStarred,
          noteText: mapData.name,
          maxStages: mapData.maxStages,
          imagePath: (note as any).imagePath || mapData.imagePath,
        };
      }
      return note;
    });
  }
};

const saveNotes = () => {
  localStorage.setItem("notes", JSON.stringify(notes.value));
  const roomId = new URLSearchParams(window.location.search).get("room") || "default";
  set(dbRef(db, `rooms/${roomId}/notes`), JSON.stringify(notes.value));
};

const handleAddNewNote = async (newNote: any) => {
  const mapData = maps.value.find((m: MapData) => m.name === newNote.noteText);
  if (!mapData) {
    ElMessage.error("ไม่พบข้อมูลแผนที่");
    return;
  }
  await loadMapImage(mapData.name);

  const finalNote = {
    ...newNote,
    id: uuidv4(),
    noteText: mapData.name,
    isStarred: mapData.isStarred,
    hasSound: newNote.hasSound,
    maxStages: mapData.maxStages,
  };

  notes.value.forEach((note) => {
    if (
      note.mapLevel === finalNote.mapLevel &&
      note.noteText === finalNote.noteText &&
      note.channel === finalNote.channel
    ) {
      note.isWarning = true;
    } else {
      note.isWarning = false;
    }
  });

  notes.value.unshift(finalNote);
  notes.value.sort(sortNotesArray);
  saveNotes();
  ElMessage({
    type: "success",
    message: `เพิ่มข้อมูลสำเร็จ! ${finalNote.noteText} ช่อง: ${finalNote.channel}`,
  });
};

const handleDeleteNote = (id: string) => {
  const index = notes.value.findIndex((note) => note.id === id);
  if (index !== -1) {
    notes.value.splice(index, 1);
    saveNotes();
    ElMessage({
      type: "success",
      message: "ลบข้อมูลแล้ว",
    });
  }
};

const handleClearAllNotes = () => {
  notes.value = [];
  saveNotes();
};

const getNoteStateCategory = (state: string) => {
  if (state.toLowerCase() === "on") return "ON";
  if (state.includes("_")) return "STAGE";
  return "CD";
};

const sortNotesArray = (a: Note, b: Note): number => {
  const now = Date.now();
  const aStateCategory = getNoteStateCategory(a.state);
  const bStateCategory = getNoteStateCategory(b.state);

  if (currentSortMode.value === "map") {
    if (a.mapLevel !== b.mapLevel) {
      return b.mapLevel - a.mapLevel;
    }
    if (a.channel !== b.channel) {
      return a.channel - b.channel;
    }
  }

  const aIsOnOverLimit =
    aStateCategory === "ON" && now - (a.onTime || now) > ON_TIME_LIMIT_MS;
  const bIsOnOverLimit =
    bStateCategory === "ON" && now - (b.onTime || now) > ON_TIME_LIMIT_MS;

  if (aIsOnOverLimit && !bIsOnOverLimit) return 1;
  if (!aIsOnOverLimit && bIsOnOverLimit) return -1;

  const stateOrder = { ON: 1, STAGE: 2, CD: 3 };
  if (
    stateOrder[aStateCategory as keyof typeof stateOrder] !==
    stateOrder[bStateCategory as keyof typeof stateOrder]
  ) {
    return (
      stateOrder[aStateCategory as keyof typeof stateOrder] -
      stateOrder[bStateCategory as keyof typeof stateOrder]
    );
  }

  if (aStateCategory === "ON") {
    return (a.onTime || 0) - (b.onTime || 0);
  } else if (aStateCategory === "STAGE") {
    const aStage = parseInt(a.state.replace("STAGE_", ""), 10);
    const bStage = parseInt(b.state.replace("STAGE_", ""), 10);
    return bStage - aStage;
  } else if (aStateCategory === "CD") {
    return (a.respawnTime || 0) - (b.respawnTime || 0);
  }

  return 0;
};

const handleUpdateNoteChannel = (id: string, newChannel: number) => {
  const noteToUpdate = notes.value.find((note) => note.id === id);
  if (noteToUpdate) {
    noteToUpdate.channel = newChannel;
  }
  saveNotes();
};

const handleUpdateNoteStatus = (
  id: string,
  newState: NoteState,
  newTime: number | null
) => {
  const noteToUpdate = notes.value.find((note) => note.id === id);
  if (noteToUpdate) {
    noteToUpdate.state = newState;
    noteToUpdate.onTime = null;
    noteToUpdate.stageTime = null;
    noteToUpdate.hasAlerted = false;

    switch (newState) {
      case "ON":
        noteToUpdate.onTime = newTime;
        break;
      case "CD":
        const map = maps.value.find(
          (m: MapData) => m.level === noteToUpdate.mapLevel
        );
        if (map) {
          noteToUpdate.respawnTime = Date.now() + map.respawnTime * 1000;
        }
        break;
      default:
        noteToUpdate.stageTime = newTime;
        break;
    }
    notes.value.sort(sortNotesArray);
  }
  saveNotes();
};

const handleUpdateNoteCd = (id: string, respawnTime: number) => {
  const note = notes.value.find((n) => n.id === id);
  if (note) {
    note.respawnTime = respawnTime;
    note.state = "CD";
    note.onTime = null;
    note.stageTime = null;
    note.hasAlerted = false;
    note.isWarning = false;
    saveNotes();
  }
};

const handleToggleInputSound = (state: boolean) => {
  hasInputSoundOn.value = state;
};

const handleUpdateMapStar = (mapLevel: number) => {
  const map = maps.value.find((m: MapData) => m.level === mapLevel);
  if (map) {
    map.isStarred = !map.isStarred;
    localStorage.setItem("mapData", JSON.stringify(maps.value));
  }
};

const exportNotes = async () => {
  const exportedNotes = notes.value.map((note) => ({
    l: note.mapLevel,
    c: note.channel,
    o: note.onTime,
    r: note.respawnTime,
    s: note.state,
    n: (note as any).noteText,
  }));
  importExportData.value = JSON.stringify(exportedNotes);
  try {
    await navigator.clipboard.writeText(importExportData.value);
    ElMessage({
      type: "success",
      message: "ส่งออกและคัดลอกไปยังคลิปบอร์ดแล้ว",
    });
  } catch (err) {
    ElMessage({
      type: "warning",
      message: "คัดลอกอัตโนมัติไม่ได้ กรุณาคัดลอกข้อความด้านบนเอง",
    });
  }
};

const handleImportClick = async () => {
  if (!importExportData.value) {
    ElMessage({ type: "warning", message: "กรุณาวางข้อมูลที่ต้องการนำเข้าก่อน" });
    return;
  }
  try {
    const importedNotes = JSON.parse(importExportData.value);

    if (
      !Array.isArray(importedNotes) ||
      importedNotes.some((n) => !(n.l || n.mapLevel) || !(n.c || n.channel))
    ) {
      ElMessage({ type: "error", message: "รูปแบบข้อมูลไม่ถูกต้อง" });
      return;
    }

    const processedImportedNotes = importedNotes
      .map((importedNote) => {
        const mapLevel = importedNote.l || importedNote.mapLevel;
        const channel = importedNote.c || importedNote.channel;
        const onTime = importedNote.o || importedNote.onTime;
        const respawnTime = importedNote.r || importedNote.respawnTime;
        const state = importedNote.s || importedNote.state;
        const noteText = importedNote.n || importedNote.noteText;

        if (!mapLevel || !noteText) {
          return null;
        }

        return {
          ...importedNote,
          mapLevel,
          channel,
          onTime,
          respawnTime,
          state,
          noteText,
        };
      })
      .filter((n) => n !== null);

    for (const note of processedImportedNotes) {
      await loadMapImage(note.noteText);
    }

    const currentNotesMap = new Map(
      notes.value.map((note) => [
        `${note.mapLevel}-${note.channel}-${note.noteText}`,
        note,
      ])
    );
    const nonDuplicateNotes: Note[] = [];
    const duplicateNotes: { newNote: Note; oldNote: Note }[] = [];

    processedImportedNotes.forEach((importedNote) => {
      const mapData = maps.value.find(
        (m: MapData) =>
          m.level === importedNote.mapLevel && m.name === importedNote.noteText
      );
      const isExpired = importedNote.respawnTime <= Date.now();
      const processedNote: Note = {
        ...importedNote,
        id: uuidv4(),
        hasSound: hasInputSoundOn.value,
        isStarred: mapData ? mapData.isStarred : false,
        onTime: importedNote.onTime || null,
        respawnTime: importedNote.respawnTime || null,
        hasAlerted: isExpired,
        maxStages: mapData ? mapData.maxStages : 0,
      };
      const existingKey = `${importedNote.mapLevel}-${importedNote.channel}-${importedNote.noteText}`;
      const existingNote = currentNotesMap.get(existingKey);
      if (existingNote) {
        duplicateNotes.push({ newNote: processedNote, oldNote: existingNote });
      } else {
        nonDuplicateNotes.push(processedNote);
      }
    });

    if (duplicateNotes.length > 0) {
      ElMessageBox({
        title: "พบข้อมูลซ้ำ",
        message: h("div", null, [
          h("p", `พบข้อมูลซ้ำ ${duplicateNotes.length} รายการ`),
          h(
            "ul",
            {
              style: "max-height: 200px; overflow-y: auto; padding-left: 20px;",
            },
            duplicateNotes.map((item) =>
              h(
                "li",
                `แผนที่: ${item.newNote.mapLevel} - ${item.newNote.noteText} ช่อง: ${item.newNote.channel}`
              )
            )
          ),
          h("p", "ต้องการจัดการข้อมูลซ้ำอย่างไร?"),
        ]),
        showCancelButton: true,
        confirmButtonText: "เขียนทับทั้งหมด",
        cancelButtonText: "ข้ามทั้งหมด",
        distinguishCancelAndClose: true,
      })
        .then((action) => {
          if (action === "confirm") {
            const finalNotesMap = new Map(
              notes.value.map((note) => [
                `${note.mapLevel}-${note.channel}-${note.noteText}`,
                note,
              ])
            );
            duplicateNotes.forEach((item) =>
              finalNotesMap.set(
                `${item.newNote.mapLevel}-${item.newNote.channel}-${item.newNote.noteText}`,
                item.newNote
              )
            );
            const finalNotes = [...finalNotesMap.values(), ...nonDuplicateNotes];
            notes.value = finalNotes;
            notes.value.sort(sortNotesArray);
            saveNotes();
            ElMessage({
              type: "success",
              message: `เขียนทับ ${duplicateNotes.length} รายการ และเพิ่ม ${nonDuplicateNotes.length} รายการสำเร็จ`,
            });
          } else if (action === "cancel") {
            const finalNotes = [...notes.value, ...nonDuplicateNotes];
            notes.value = finalNotes;
            notes.value.sort(sortNotesArray);
            saveNotes();
            ElMessage({
              type: "success",
              message: `เพิ่ม ${nonDuplicateNotes.length} รายการสำเร็จ`,
            });
          }
        })
        .catch(() => {
          ElMessage({ type: "info", message: "ยกเลิกการนำเข้า" });
        });
    } else {
      notes.value = [...notes.value, ...nonDuplicateNotes];
      notes.value.sort(sortNotesArray);
      saveNotes();
      ElMessage({
        type: "success",
        message: `เพิ่ม ${nonDuplicateNotes.length} รายการสำเร็จ`,
      });
    }
  } catch (e) {
    ElMessage({ type: "error", message: "นำเข้าล้มเหลว กรุณาตรวจสอบรูปแบบข้อมูล" });
  }
};

onMounted(() => {
  const savedTheme = localStorage.getItem("theme");
  isDark.value =
    savedTheme === "dark" ||
    (savedTheme === null &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark.value) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  loadNotes();

  if (notes.value.length > 0) {
    notes.value.forEach((note) => {
      loadMapImage(note.noteText);
    });
  }

  setInterval(() => {
    notes.value.sort(sortNotesArray);
  }, 1000);

  console.log(`เวอร์ชัน: v${packageInfo.version}`);
});

watch(notes, saveNotes, { deep: true });
</script>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--cus-app-container-padding);
  background-color: var(--app-container-color);
  min-height: 100vh;
}
.app-header {
  height: auto;
  text-align: center;
  padding: 5px;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-right {
  display: flex;
  align-items: center;
}
.dark-mode-switch {
  --el-switch-on-color: #0e2d5a;
  --el-switch-off-color: #eba523;
}
.app-main {
  padding: 0;
}
.list-card-container {
  margin-top: 20px;
}
.import-export-section {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.import-export-buttons {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
</style>