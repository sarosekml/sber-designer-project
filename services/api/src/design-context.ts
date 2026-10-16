/**
 * Project design context — compatibility facade. Implementation lives in
 * ./design-context/* (contract, markdown, state, prompt-summary, load,
 * validate, generate; task 0078, KT2). Consumers and tests keep importing
 * from this path.
 */
export * from './design-context/contract';
export * from './design-context/prompt-summary';
export * from './design-context/load';
export * from './design-context/validate';
export * from './design-context/generate';
