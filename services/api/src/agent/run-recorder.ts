/**
 * Agent run recorder — compatibility facade. Implementation lives in
 * ./run-record/* (types, store, receipts, evidence, handoff, manifest;
 * task 0078, KT2). Routes and tests keep importing from this path.
 */
export * from './run-record/types';
export * from './run-record/store';
export * from './run-record/receipts';
export * from './run-record/evidence';
export * from './run-record/handoff';
export * from './run-record/dataset';
export * from './run-record/feedback';
export * from './run-record/quality';
export * from './run-record/review';
export * from './run-record/preference-signals';
export * from './run-record/manifest';
export * from './run-record/reaper';
