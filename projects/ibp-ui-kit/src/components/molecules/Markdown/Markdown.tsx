import React, { memo, useMemo } from 'react';
import { marked } from 'marked';

import 'katex/dist/katex.css';
import 'highlight.js/styles/github.min.css';

import { getDataTestId, mergeSx } from '@/utils';

import { SxBox } from '../../atoms';

import { markdownSx } from './Markdown.styles';
import { MarkdownProps } from './Markdown.types';
import { preprocessText } from './Markdown.utils';

export const Markdown = memo(({ children, sx, dataTestId }: MarkdownProps) => {
  const renderedMarkdown = useMemo(() => {
    return marked.parse(preprocessText(children)) as string;
  }, [children]);

  return (
    <SxBox
      data-testid={getDataTestId(dataTestId, Markdown.name)}
      component={'div'}
      sx={mergeSx(markdownSx, sx)}
      dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
    />
  );
});

Markdown.displayName = Markdown.name;
