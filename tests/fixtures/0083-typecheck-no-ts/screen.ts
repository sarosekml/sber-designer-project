// A project with no tsconfig at its root — the gate must degrade to zero
// findings (non-TS / empty repo path), never throw.
export const x = 1;
