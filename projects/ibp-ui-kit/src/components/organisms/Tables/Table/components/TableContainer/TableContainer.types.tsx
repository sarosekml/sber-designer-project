import { ScrollState } from '../../TableState';

export interface ScrollEvents {
  change: ScrollState;
  currentState: ScrollState;
}
