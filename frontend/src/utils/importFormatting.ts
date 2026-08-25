export function getImportFileType(file: Pick<File, "name">) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return "CSV";
  }

  if (extension === "xlsx") {
    return "XLSX";
  }

  return "File";
}

export function formatFileSize(fileSize: number) {
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  const sizeInKb = fileSize / 1024;

  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(1)} KB`;
  }

  return `${(sizeInKb / 1024).toFixed(1)} MB`;
}
