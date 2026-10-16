export function parentPath(path: string): string {
  const normalized = path.replace(/\/+$/g, '');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}

export function joinPath(base: string, child: string): string {
  const cleanBase = base.replace(/\/+$/g, '');
  if (!cleanBase || cleanBase === '/') return `/${child}`;
  return `${cleanBase}/${child}`;
}

export function projectFolderNameFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function duplicateProjectCopyPath(parentDir: string, name: string): string {
  const cleanParentDir = parentDir.trim();
  const folderName = projectFolderNameFromName(name);
  return cleanParentDir && folderName ? joinPath(cleanParentDir, folderName) : '';
}

export function scaffoldProjectWorkspacePath(
  selectedDir: string,
  name: string,
  createProjectSubfolder: boolean,
): string {
  const cleanSelectedDir = selectedDir.trim().replace(/\/+$/g, '');
  if (!cleanSelectedDir) return '';
  if (!createProjectSubfolder) return cleanSelectedDir;
  return duplicateProjectCopyPath(cleanSelectedDir, name);
}

export function isDuplicateNestedProjectPath(selectedDir: string, name: string): boolean {
  const folderName = projectFolderNameFromName(name);
  if (!folderName) return false;
  const normalized = selectedDir.trim().replace(/\/+$/g, '');
  const lastSlash = normalized.lastIndexOf('/');
  const selectedFolderName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  return selectedFolderName.toLowerCase() === folderName;
}
