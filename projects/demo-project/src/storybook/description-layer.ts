export interface ComponentUsageExample {
  title: string;
  when: string;
  props?: Record<string, string>;
}

export interface ComponentDescriptionLayer {
  purpose: string;
  anatomy: string[];
  usage: ComponentUsageExample[];
  agentGuidance: string[];
  sourceHtml?: string;
}

export function describeComponent(layer: ComponentDescriptionLayer): {
  docs: { description: { component: string } };
  sberDesigner: { descriptionLayer: ComponentDescriptionLayer };
} {
  return {
    docs: {
      description: {
        component: toMarkdown(layer),
      },
    },
    sberDesigner: {
      descriptionLayer: layer,
    },
  };
}

export function describeStory(
  layer: Pick<ComponentDescriptionLayer, 'purpose' | 'agentGuidance'> &
    Partial<Pick<ComponentDescriptionLayer, 'usage'>>,
): {
  docs: { description: { story: string } };
  sberDesigner: {
    storyDescription: Pick<ComponentDescriptionLayer, 'purpose' | 'agentGuidance'> &
      Partial<Pick<ComponentDescriptionLayer, 'usage'>>;
  };
} {
  return {
    docs: {
      description: {
        story: [layer.purpose, ...layer.agentGuidance.map((item) => `- ${item}`)].join('\n\n'),
      },
    },
    sberDesigner: {
      storyDescription: layer,
    },
  };
}

function toMarkdown(layer: ComponentDescriptionLayer): string {
  const usage = layer.usage
    .map((item) => {
      const props = item.props
        ? `\n  Props: ${Object.entries(item.props)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ')}`
        : '';
      return `- **${item.title}:** ${item.when}${props}`;
    })
    .join('\n');

  return [
    layer.purpose,
    `**Anatomy:** ${layer.anatomy.join(', ')}.`,
    `**Usage:**\n${usage}`,
    `**Agent guidance:**\n${layer.agentGuidance.map((item) => `- ${item}`).join('\n')}`,
    layer.sourceHtml ? `Source reference: \`${layer.sourceHtml}\`.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
