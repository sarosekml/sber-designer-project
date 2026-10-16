import { GraduationCap, House, LayoutGrid, type LucideIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { UserAvatarMenu } from './UserAvatarMenu';

export interface HomeRailItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

export const HOME_RAIL_ITEMS: HomeRailItem[] = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Projects', href: '/projects', icon: LayoutGrid },
  { label: 'How it works', href: '/how-it-works', icon: GraduationCap },
];

export function homeRailItemIsActive(pathname: string, href: string): boolean {
  if (href === '/' || href === '/projects') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HomeRail({ currentPath }: { currentPath: string }) {
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-2 text-sidebar-foreground">
      <nav className="flex flex-1 flex-col items-center gap-2" aria-label="Primary navigation">
        {HOME_RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = homeRailItemIsActive(currentPath, item.href);
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <a
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'grid size-11 place-items-center rounded-xl text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                    active &&
                      'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/45',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <UserAvatarMenu />
    </aside>
  );
}
