import React from 'react';

import * as SourceStories from '../../stories/BaseScreenTemplate.stories';

type SourceStory = {
  args?: Record<string, unknown>;
  render?: React.ComponentType<Record<string, unknown>>;
};
type SourceMeta = {
  component?: React.ComponentType<Record<string, unknown>>;
};

const sourceMeta = SourceStories.default as SourceMeta;
const sourceStory = SourceStories.SidebarShell as SourceStory | undefined;
const SourceComponent = sourceMeta.component;
const sourceArgs = sourceStory?.args ?? {};

export function BaseScreenSidebarShellmp9ufm89() {
  const SourceRender = sourceStory?.render;
  if (SourceRender) return <SourceRender {...sourceArgs} />;
  return SourceComponent ? <SourceComponent {...sourceArgs} /> : null;
}
