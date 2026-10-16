export type InsertPolicyMode = 'direct' | 'assistant' | 'blocked';

export interface InsertPolicy {
  mode: InsertPolicyMode;
  operations: string[];
  reason: string;
}

export type InsertPolicyInput =
  | { kind: 'primitive'; tagName: string }
  | { kind: 'catalog-component'; componentName: string; filePath: string };

const SAFE_PRIMITIVE_TAGS = new Set([
  'article',
  'aside',
  'button',
  'div',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'span',
  'ul',
]);

export function resolveInsertPolicy(input: InsertPolicyInput): InsertPolicy {
  if (input.kind === 'catalog-component') {
    return {
      mode: 'assistant',
      operations: ['insert-component-request'],
      reason:
        'Catalog component inserts stay assistant-assisted until component props, imports, and placement safety are proven.',
    };
  }

  const tagName = input.tagName.toLowerCase();
  if (SAFE_PRIMITIVE_TAGS.has(tagName)) {
    return {
      mode: 'direct',
      operations: ['insert-primitive'],
      reason:
        'This primitive tag is safe for direct AST insertion once a source-backed target is selected.',
    };
  }

  return {
    mode: 'blocked',
    operations: [],
    reason: 'Direct insertion is limited to safe layout and text primitives.',
  };
}
