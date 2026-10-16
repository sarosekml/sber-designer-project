// Minimal stand-in for a design-kit contract: a closed icon-name union and a
// component whose only prop is `name` (mirrors the real `IconProps`), plus a
// closed text-token union (mirrors `TextTypes`). Reproduces the DCM failure
// class without React/JSX so the gate test stays hermetic.
export type IconName = 'Edit' | 'CheckCircle' | 'DocumentCheck';
export type TextType = 'BodyMReg' | 'BodySReg' | 'H4StrongSmb';

export interface IconProps {
  name: IconName;
}

export function makeIcon(props: IconProps): IconName {
  return props.name;
}

export function makeText(type: TextType): TextType {
  return type;
}
