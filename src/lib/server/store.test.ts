import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createJsonStore } from "./store";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporaryStore() {
  const directory = await mkdtemp(join(tmpdir(), "hmp-json-store-"));
  tempDirectories.push(directory);
  return { directory, store: createJsonStore(directory) };
}

describe("private JSON storage", () => {
  it("initializes missing datasets as empty and writes atomically with a backup", async () => {
    const { directory, store } = await temporaryStore();

    expect(await store.read("families")).toEqual([]);
    await store.update("families", (families) => [
      ...families,
      {
        id: "HMP-001",
        name: "Test Parivar",
        head: "Test",
        contactNumber: "+911234567890",
        members: 1,
        mohalla: "",
        active: true,
        order: 1,
        monthlyFee: 500,
      },
    ]);
    await store.update("families", (families) => families);

    expect(await store.read("families")).toHaveLength(1);
    expect(await readFile(join(directory, "families.json"), "utf8")).toContain("HMP-001");
    const backupFiles = await (
      await import("node:fs/promises")
    ).readdir(join(directory, "backups"));
    expect(backupFiles).toHaveLength(1);
  });

  it("serializes concurrent updates without losing records", async () => {
    const { store } = await temporaryStore();
    const updates = Array.from({ length: 10 }, (_, index) =>
      store.update("announcements", (items) => [
        ...items,
        {
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          title: `Notice ${index}`,
          body: "Test",
          date: "2026-11-13",
          tag: "Notice",
          pinned: false,
        },
      ]),
    );

    await Promise.all(updates);

    expect(await store.read("announcements")).toHaveLength(10);
  });

  it("persists an updated reminder time when a store instance is recreated", async () => {
    const { directory, store } = await temporaryStore();

    await store.update("settings", (settings) => ({ ...settings, reminderTime: "18:30" }));

    expect(await createJsonStore(directory).read("settings")).toMatchObject({
      reminderTime: "18:30",
      timezone: "Asia/Kolkata",
    });
  });

  it("refuses to overwrite malformed existing JSON", async () => {
    const { directory, store } = await temporaryStore();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "families.json"), "{not valid json", "utf8");

    await expect(store.update("families", () => [])).rejects.toThrow(
      "Stored families.json is invalid",
    );
    expect(await readFile(join(directory, "families.json"), "utf8")).toBe("{not valid json");
  });
});
