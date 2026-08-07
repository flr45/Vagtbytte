import { describe, expect, it } from "vitest";
import {
  nextIncompletePhotoTask,
  operationalPhotoProgress,
  type OperationalPhotoTask
} from "./operativ-photo-workflow";

function task(key: string, completed: boolean): OperationalPhotoTask {
  return {
    key,
    kind: key.startsWith("view:") ? "vehicle-view" : "room",
    label: key,
    section: "Test",
    completed,
    imageId: completed ? "image-id" : null,
    viewKey: key === "view:front" ? "front" : null,
    placeId: key.startsWith("room:") ? key.slice(5) : null,
    nodeId: null,
    detail: "Test"
  };
}

describe("operativ fototur", () => {
  it("beregner fremdrift som færdige billeder ud af hele planen", () => {
    expect(operationalPhotoProgress([
      task("view:front", true),
      task("room:a", false),
      task("room:b", true),
      task("room:c", false)
    ])).toEqual({ completed: 2, total: 4, percent: 50 });
  });

  it("går videre til næste manglende foto og springer færdige punkter over", () => {
    const tasks = [
      task("view:front", false),
      task("room:a", true),
      task("room:b", false),
      task("room:c", true)
    ];
    expect(nextIncompletePhotoTask(tasks, "view:front")?.key).toBe("room:b");
  });

  it("kan fortsætte rundt fra slutningen uden at vælge det aktuelle punkt igen", () => {
    const tasks = [
      task("view:front", false),
      task("room:a", true),
      task("room:b", true),
      task("room:c", false)
    ];
    expect(nextIncompletePhotoTask(tasks, "room:c")?.key).toBe("view:front");
  });
});
