import path from "node:path";

export function operationalStoredFilePath(directory: string, storageName: string) {
  const name = storageName.trim();
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("\0") ||
    name !== path.basename(name) ||
    path.isAbsolute(name)
  ) {
    throw new Error("Ugyldigt storage-filnavn.");
  }

  const root = path.resolve(directory);
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage-stien ligger uden for den tilladte mappe.");
  }

  return resolved;
}

export function operationalContentDisposition(mimeType: string, encodedFileName: string) {
  const canRenderInline = mimeType === "application/pdf" || mimeType.startsWith("image/");
  return `${canRenderInline ? "inline" : "attachment"}; filename*=UTF-8''${encodedFileName}`;
}
