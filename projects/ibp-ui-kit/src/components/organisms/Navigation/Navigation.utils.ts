import { CombinedItem, InteractionItem, NavigationItem } from '@/components/organisms/Navigation';

export const isInteractionItem = (item: CombinedItem): item is InteractionItem => {
  return 'onClickInteraction' in item;
};

export const isNavigationItem = (item: CombinedItem): item is NavigationItem => {
  return 'route' in item;
};
