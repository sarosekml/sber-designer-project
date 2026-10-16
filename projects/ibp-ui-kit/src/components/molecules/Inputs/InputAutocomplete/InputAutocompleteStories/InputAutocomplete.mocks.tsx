import React, { ReactNode } from 'react';

import { Dictionary } from '@sber-ibp/core';

import { Icon } from '@/components/atoms/Icon';

export const autocompleteArgsConfig = {
  dataTestId: { control: 'text' as const },
  disabled: { control: 'boolean' as const },
  multiple: { control: 'boolean' as const },
  autoFocus: { control: 'boolean' as const },
  isColoredBg: { control: 'boolean' as const },
  size: {
    options: ['sm', 'md', 'lg'],
    control: { type: 'radio' as const },
  },
  viewFormat: {
    options: ['text', 'chip', 'marker', 'outerChip'],
    control: { type: 'radio' as const },
  },
  viewType: {
    options: ['edit', 'read'],
    control: { type: 'radio' as const },
  },
  helperText: { control: 'text' as const },
  placeholder: { control: 'text' as const },
  label: { control: 'text' as const },
};

export type InputAutocompleteOptionsMockType = Dictionary & { group: string } & { helperText: string; icon: ReactNode };

export const inputAutocompleteOptions: InputAutocompleteOptionsMockType[] = [
  {
    code: 'HarryPotter',
    name: 'DID ',
    helperText: 'История о мальчике, который выжил...',
    icon: <Icon name={'User'} />,
    group: 'Фентези',
  },
  // Same item with different code for testing duplicates
  {
    code: 'HarryPotter1',
    name: 'PIP',
    helperText: 'История о мальчике, который выжил...',
    icon: <Icon name={'User'} />,
    group: 'Фентези',
  },
  {
    code: 'HarryPotter2',
    name: 'Гарри Поттер и Филосовский камень Гарри Поттер и Филосовский камень',
    helperText: 'История о мальчике, который выжил...',
    icon: <Icon name={'User'} />,
    group: 'Фентези',
  },
  {
    code: 'LordOfTheRing1',
    name: 'Властелин колец. Братство кольца',
    helperText: 'История, которую должен знать каждый...',
    icon: <Icon name={'User'} />,
    group: 'Фентези',
  },
  {
    code: 'LordOfTheRing2',
    name: 'Властелин колец. Две башни',
    helperText: 'История, которую должен знать каждый...',
    icon: <Icon name={'ArrowRight'} />,
    group: 'Фентези',
  },
  {
    code: 'LordOfTheRing3',
    name: 'Властелин колец. Возвращение короля',
    helperText: 'История, которую должен знать каждый...',
    icon: <Icon name={'ArrowRight'} />,
    group: 'Фентези',
  },
  {
    code: 'BraweNewWorld',
    name: 'О дивный новый мир',
    helperText: 'Антиутопия и что может быть с нами в будущем',
    icon: <Icon name={'Add'} />,
    group: 'Фантастика',
  },
  {
    code: 'ReadyPlayrFirst',
    name: 'Первому игроку приготовиться',
    helperText: 'Виртуальная реальность и бесконечность игровых миров',
    icon: <Icon name={'Trash'} />,
    group: 'Фантастика',
  },
  {
    code: 'HungerGames',
    name: 'Голодные игры',
    helperText: 'Игра в которую лучше не проигрывать',
    icon: <Icon name={'KpkiCal'} />,
    group: 'Фантастика',
  },
  {
    code: 'HungerGames2',
    name: 'Голодные игры. И вспыхнет пламя',
    helperText: 'Игра в которую лучше не проигрывать',
    icon: <Icon name={'KpkiCal'} />,
    group: 'Фантастика',
  },
  {
    code: 'HungerGames3',
    name: 'Голодные игры. Сойка пересмешница',
    helperText: 'Игра в которую лучше не проигрывать',
    icon: <Icon name={'KpkiCal'} />,
    group: 'Фантастика',
  },
];
