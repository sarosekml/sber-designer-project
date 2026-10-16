# 2026-06-03 Closed-Contour Regression

Sanitized evidence from a failed `ai-product-designer` run where the useful generated screen appeared only after reloading the product.

The historical run stayed failed because render health was skipped when Chrome
debugging was unavailable, and the retry saw no new target diff. Current code
records missing Chrome/static Storybook evidence as `unavailable` / weak render
evidence instead of treating it as proof that a screen failed, then uses fresh
run receipts to clear stale screen health when a later repair succeeds.

The fixture keeps only non-secret manifest, timeline, and weak/stale
component-pack fields needed to reproduce the old classification bug.
