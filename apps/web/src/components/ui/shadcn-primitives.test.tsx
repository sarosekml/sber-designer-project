import { describe, expect, test } from 'bun:test';
import type { ReactElement } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Field, FieldGroup, FieldLabel } from './field';
import { Input } from './input';
import { NativeSelect, NativeSelectOption } from './native-select';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Textarea } from './textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('shadcn primitives', () => {
  test('exports the editor UI primitives used by high-traffic controls', () => {
    expect(Avatar).toBeTypeOf('function');
    expect(AvatarImage).toBeTypeOf('function');
    expect(AvatarFallback).toBeTypeOf('function');
    expect(Button).toBeTypeOf('object');
    expect(TooltipProvider).toBeTypeOf('function');
    expect(Tooltip).toBeTypeOf('function');
    expect(TooltipTrigger).toBeTypeOf('function');
    expect(TooltipContent).toBeTypeOf('function');
    expect(Tabs).toBeTypeOf('function');
    expect(TabsList).toBeTypeOf('function');
    expect(TabsTrigger).toBeTypeOf('function');
    expect(DropdownMenu).toBeTypeOf('function');
    expect(DropdownMenuTrigger).toBeTypeOf('function');
    expect(DropdownMenuContent).toBeTypeOf('function');
    expect(DropdownMenuItem).toBeTypeOf('function');
    expect(Input).toBeTypeOf('function');
    expect(Textarea).toBeTypeOf('function');
    expect(NativeSelect).toBeTypeOf('function');
    expect(NativeSelectOption).toBeTypeOf('function');
    expect(FieldGroup).toBeTypeOf('function');
    expect(Field).toBeTypeOf('function');
    expect(FieldLabel).toBeTypeOf('function');
    expect(Table).toBeTypeOf('object');
    expect(TableHeader).toBeTypeOf('object');
    expect(TableBody).toBeTypeOf('object');
    expect(TableRow).toBeTypeOf('object');
    expect(TableHead).toBeTypeOf('object');
    expect(TableCell).toBeTypeOf('object');
  });

  test('keeps default tab active state on the project primary color', () => {
    const trigger = TabsTrigger({ value: 'screen' }) as ReactElement<{ className?: string }>;
    const className = trigger.props.className ?? '';

    expect(className).toContain(
      'group-data-[variant=default]/tabs-list:data-[state=active]:bg-primary',
    );
    expect(className).toContain(
      'group-data-[variant=default]/tabs-list:data-[state=active]:text-primary-foreground',
    );
    expect(className).toContain(
      'dark:group-data-[variant=default]/tabs-list:data-[state=active]:text-primary-foreground',
    );
    expect(className).not.toContain('data-[state=active]:bg-background');
    expect(className).not.toContain('dark:data-[state=active]:bg-input/30');
  });

  test('provides a secondary tab variant for neutral editor controls', () => {
    const list = TabsList({ variant: 'secondary' }) as ReactElement<{ className?: string }>;
    const trigger = TabsTrigger({ value: 'screen' }) as ReactElement<{ className?: string }>;
    const listClassName = list.props.className ?? '';
    const triggerClassName = trigger.props.className ?? '';

    expect(listClassName).toContain('bg-muted');
    expect(triggerClassName).toContain(
      'group-data-[variant=secondary]/tabs-list:data-[state=active]:bg-secondary',
    );
    expect(triggerClassName).toContain(
      'group-data-[variant=secondary]/tabs-list:data-[state=active]:text-secondary-foreground',
    );
  });

  test('uses project border tokens for dropdown menu surfaces', () => {
    const portal = DropdownMenuContent({}) as ReactElement<{
      children: ReactElement<{ className?: string }>;
    }>;
    const className = portal.props.children.props.className ?? '';

    expect(className).toContain('border-border');
  });

  test('uses theme and accent tokens for tooltip surfaces', () => {
    const portal = TooltipContent({ children: 'Theme-aware tooltip' }) as ReactElement<{
      children: ReactElement<{ className?: string }>;
    }>;
    const className = portal.props.children.props.className ?? '';

    expect(className).toContain('bg-popover');
    expect(className).toContain('text-popover-foreground');
    expect(className).toContain('border-primary/20');
    expect(className).not.toContain('bg-foreground');
    expect(className).not.toContain('text-background');
  });
});
