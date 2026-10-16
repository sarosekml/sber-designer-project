import type {
  DesignInspectResult,
  DesignPropInfo,
  DesignTargetCapability,
} from '@sber-designer/shared-types';

export function inferCapabilities(input: {
  children: { text?: string; editable: boolean; reason?: string } | null;
  props: DesignPropInfo[];
  styles: NonNullable<DesignInspectResult['styles']>;
  selfClosing: boolean;
}): DesignInspectResult['capabilities'] {
  return {
    text: inferTextCapability(input.children, input.selfClosing),
    props: inferPropsCapability(input.props),
    style: input.styles.styleEditable
      ? capability('editable', ['set-style', 'remove-style'])
      : capability(
          'assistant-only',
          ['layout-restructure-request'],
          input.styles.styleReason ?? 'Style is represented by a complex expression.',
        ),
    className: input.styles.classNameEditable
      ? capability('editable', ['set-class-token'])
      : capability(
          'assistant-only',
          ['layout-restructure-request'],
          input.styles.classNameReason ?? 'className is represented by a complex expression.',
        ),
    insert: capability(
      'assistant-only',
      ['insert-component-request'],
      'Direct AST insert is not enabled for this target yet; route insertion through the assistant.',
    ),
  };
}

export function unmappedCapabilities(reason: string): DesignInspectResult['capabilities'] {
  return {
    text: capability('unmapped', [], reason),
    props: capability('unmapped', [], reason),
    style: capability('unmapped', [], reason),
    className: capability('unmapped', [], reason),
    insert: capability('unmapped', [], reason),
  };
}

function inferTextCapability(
  children: { text?: string; editable: boolean; reason?: string } | null,
  selfClosing: boolean,
): DesignTargetCapability {
  if (children?.editable) return capability('editable', ['set-children-text']);
  if (selfClosing) {
    return capability('read-only', [], 'Self-closing JSX elements have no editable text children.');
  }
  return capability(
    'assistant-only',
    ['layout-restructure-request'],
    children?.reason ?? 'Text children are not plain text.',
  );
}

function inferPropsCapability(props: DesignPropInfo[]): DesignTargetCapability {
  const semanticProps = props.filter((prop) => prop.name !== 'className' && prop.name !== 'style');
  const blocking = semanticProps.find((prop) => !prop.editable);
  if (blocking) {
    return capability(
      'assistant-only',
      ['layout-restructure-request'],
      blocking.reason ?? 'Some props are represented by complex expressions.',
    );
  }
  return capability('editable', ['set-prop', 'remove-prop']);
}

function capability(
  status: DesignTargetCapability['status'],
  operations: string[],
  reason?: string,
): DesignTargetCapability {
  return {
    status,
    operations,
    ...(reason ? { reason } : {}),
  };
}
