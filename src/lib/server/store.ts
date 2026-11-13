import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, copyFile, unlink } from "node:fs/promises";
import { env, cwd } from "node:process";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

import { todayIST } from "@/lib/date";
import {
  datasetSchemas,
  emptyDatasets,
  type DatasetName,
  type DatasetValue,
} from "../data-schemas";

const FILES: Record<DatasetName, string> = {
  families: "families.json",
  duties: "duties.json",
  food: "food.json",
  payments: "payments.json",
  contributions: "contributions.json",
  announcements: "announcements.json",
  notifications: "notifications.json",
  pushSubscriptions: "push-subscriptions.json",
  settings: "settings.json",
};

const BACKUP_LIMIT = 10;

export function createJsonStore(root = resolve(cwd(), env["HMP_DATA_DIR"] ?? "data")) {
  let writeQueue: Promise<void> = Promise.resolve();

  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const result = writeQueue.then(task, task);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const readFileData = async <K extends DatasetName>(name: K): Promise<DatasetValue<K>> => {
    const file = join(root, FILES[name]);
    try {
      const contents = await readFile(file, "utf8");
      return validateDataset(name, JSON.parse(contents));
    } catch (error) {
      if (isMissingFile(error)) {
        if (name === "settings") {
          return {
            ...emptyDatasets.settings,
            anchorDate: todayIST(),
          } as DatasetValue<K>;
        }
        return structuredClone(emptyDatasets[name]) as DatasetValue<K>;
      }
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        throw new Error(`Stored ${FILES[name]} is invalid. Restore a backup before continuing.`, {
          cause: error,
        });
      }
      throw error;
    }
  };

  const read = <K extends DatasetName>(name: K) => writeQueue.then(() => readFileData(name));

  const update = <K extends DatasetName>(
    name: K,
    mutate: (current: DatasetValue<K>) => DatasetValue<K>,
  ) =>
    serialize(async () => {
      const current = await readFileData(name);
      const next = validateDataset(name, mutate(current));
      const file = join(root, FILES[name]);
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await backup(file, root);
      await atomicWrite(file, JSON.stringify(next, null, 2));
      return next;
    });

  const exportAll = async () => ({
    families: await read("families"),
    duties: await read("duties"),
    food: await read("food"),
    payments: await read("payments"),
    contributions: await read("contributions"),
    announcements: await read("announcements"),
    notifications: await read("notifications"),
    pushSubscriptions: await read("pushSubscriptions"),
    settings: await read("settings"),
  });

  return { read, update, exportAll, root };
}

export const jsonStore = createJsonStore();

function validateDataset<K extends DatasetName>(name: K, value: unknown): DatasetValue<K> {
  const parsed = datasetSchemas[name].parse(value);
  if (!Array.isArray(parsed)) return parsed as DatasetValue<K>;

  const keys = parsed.map((item) => {
    if (item == null || typeof item !== "object") return "";
    if (name === "duties" && "date" in item) return String(item.date);
    if (name === "payments" && "familyId" in item && "month" in item) {
      return `${item.familyId}:${item.month}`;
    }
    if ("id" in item) return String(item.id);
    return "";
  });
  if (new Set(keys).size !== keys.length) {
    throw new Error(`Stored ${FILES[name]} contains duplicate records.`);
  }
  return parsed as DatasetValue<K>;
}

function isMissingFile(error: unknown): boolean {
  return error != null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function backup(file: string, root: string): Promise<void> {
  try {
    await readFile(file);
  } catch (error) {
    if (isMissingFile(error)) return;
    throw error;
  }

  const backupDir = join(root, "backups");
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const sourceName = file.slice(root.length + 1);
  const backupName = `${sourceName}.${new Date().toISOString().replaceAll(":", "-")}.${randomUUID()}.bak`;
  await copyFile(file, join(backupDir, backupName));

  const backups = (await readdir(backupDir))
    .filter((name) => name.startsWith(`${sourceName}.`))
    .sort()
    .reverse();
  await Promise.all(backups.slice(BACKUP_LIMIT).map((name) => unlink(join(backupDir, name))));
}

async function atomicWrite(file: string, contents: string): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch (error) {
    await handle?.close();
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
