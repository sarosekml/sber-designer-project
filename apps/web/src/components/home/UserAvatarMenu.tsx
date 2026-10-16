import { useState } from 'react';
import { LogOut, UserRoundCog } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AuthUser } from '@/lib/api/auth';
import type { AuthStateStatus } from '@/stores/auth-store';
import { useAuthStore } from '@/stores/auth-store';

export interface UserMenuModel {
  title: string;
  subtitle: string | null;
  initials: string;
  color: string;
  showProfile: boolean;
  showLogout: boolean;
}

export function userInitials(user: Pick<AuthUser, 'displayName' | 'email'>): string {
  const words = user.displayName.trim().split(/\s+/u).filter(Boolean);
  if (words.length >= 2) {
    return `${firstCharacter(words[0]!)}${firstCharacter(words[words.length - 1]!)}`.toUpperCase();
  }
  if (words[0]) {
    const characters = Array.from(words[0]);
    return characters.slice(0, 2).join('').toUpperCase();
  }
  return firstCharacter(user.email).toUpperCase();
}

export function avatarColor(userId: string): string {
  let hash = 2_166_136_261;
  for (const character of userId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `hsl(${(hash >>> 0) % 360} 58% 46%)`;
}

export function buildUserMenuModel(user: AuthUser): UserMenuModel {
  return {
    title: user.displayName,
    subtitle: user.email,
    initials: userInitials(user),
    color: avatarColor(user.id),
    showProfile: true,
    showLogout: true,
  };
}

export function shouldShowUserAvatarMenu(
  status: AuthStateStatus,
  user: AuthUser | null,
): user is AuthUser {
  return status === 'authed' && user !== null;
}

export function UserAvatar({
  model,
  className = 'size-9',
}: {
  model: UserMenuModel;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarFallback style={{ backgroundColor: model.color }} className="text-white">
        {model.initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserAvatarMenu() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!shouldShowUserAvatarMenu(status, user)) return null;
  const model = buildUserMenuModel(user);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      window.location.assign('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-full hover:bg-sidebar-accent"
          aria-label={`Open user menu for ${model.title}`}
        >
          <UserAvatar model={model} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-64">
        <DropdownMenuLabel className="grid gap-0.5 px-2 py-2 font-normal">
          <span className="truncate text-sm font-medium">{model.title}</span>
          {model.subtitle ? (
            <span className="truncate text-xs text-muted-foreground">{model.subtitle}</span>
          ) : null}
        </DropdownMenuLabel>

        {model.showProfile || model.showLogout ? <DropdownMenuSeparator /> : null}
        {model.showProfile ? (
          <DropdownMenuItem asChild>
            <a href="/profile">
              <UserRoundCog />
              Profile settings
            </a>
          </DropdownMenuItem>
        ) : null}
        {model.showLogout ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={loggingOut}
            onSelect={() => void handleLogout()}
          >
            <LogOut />
            {loggingOut ? 'Logging out…' : 'Log out'}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function firstCharacter(value: string): string {
  return Array.from(value.trim())[0] ?? '';
}
