export interface EditorPanelVisibility {
  screensHidden: boolean;
  assistantHidden: boolean;
  componentsHidden: boolean;
}

export function areAllEditorPanelsHidden(visibility: EditorPanelVisibility): boolean {
  return visibility.screensHidden && visibility.assistantHidden && visibility.componentsHidden;
}

export function setAllEditorPanelsHidden(
  visibility: EditorPanelVisibility,
  hidden: boolean,
): EditorPanelVisibility {
  void visibility;
  return {
    screensHidden: hidden,
    assistantHidden: hidden,
    componentsHidden: hidden,
  };
}
