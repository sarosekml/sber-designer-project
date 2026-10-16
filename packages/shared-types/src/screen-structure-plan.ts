/** Run-owned screen information architecture prepared before the first source write. */

import type { DesignBrief, DesignDirectionSelection } from './design-brief';
import type { ModalDefaults, ProjectScreenSurface } from './modal-surface';

export type ScreenStructureTaskKind =
  | 'image-to-screen'
  | 'screen-generation'
  | 'screen-redesign'
  | 'screen-edit'
  | 'unknown';

export type ScreenStructurePlanSource =
  | 'request'
  | 'design-brief'
  | 'direction-picker'
  | 'screen-template';

export interface ScreenStructureRegion {
  id: string;
  label: string;
  purpose: string;
  uiRoles: string[];
  required: boolean;
}

export interface ScreenStructureDataRequirement {
  id: string;
  regionId: string;
  kind: 'collection' | 'record' | 'metric' | 'form' | 'content';
  description: string;
  source: 'request' | 'template' | 'inferred';
}

export interface ScreenStructureActionRequirement {
  id: string;
  regionId: string;
  label: string;
  priority: 'primary' | 'secondary' | 'row' | 'navigation';
  source: 'request' | 'template' | 'inferred';
}

export interface ScreenStructureStateRequirement {
  id: string;
  state: 'loading' | 'empty' | 'error' | 'success' | 'disabled' | 'unsaved';
  regionId?: string;
  source: 'request' | 'template' | 'inferred';
}

export interface ScreenStructurePlanTarget {
  screenId?: string;
  screenName?: string;
  files: string[];
}

export interface ScreenStructurePlan {
  version: 1;
  taskKind: ScreenStructureTaskKind;
  source: ScreenStructurePlanSource;
  /**
   * Target surface (0132). Absent reads as `page`. Carried so the plan's
   * regions are modal (header / body / footer-actions) rather than page
   * regions (Р-8).
   */
  surface?: ProjectScreenSurface;
  /** Resolved managed-size contract for a modal generation run. */
  modal?: ModalDefaults;
  intent: string;
  target?: ScreenStructurePlanTarget;
  regions: ScreenStructureRegion[];
  data: ScreenStructureDataRequirement[];
  actions: ScreenStructureActionRequirement[];
  states: ScreenStructureStateRequirement[];
  constraints: string[];
  assumptions: string[];
  designBrief?: DesignBrief;
  directionSelection?: DesignDirectionSelection;
}
