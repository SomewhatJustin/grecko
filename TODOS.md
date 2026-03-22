# TODOS

## Release Confidence

### Add release-source intake after v1 verdict core is trusted

**What:** Add post-v1 GitHub/GitLab release URL intake with provider normalization and asset-selection rules.

**Why:** It removes manual artifact handling and makes the product feel more automatic once the verdict pipeline is already trustworthy.

**Context:** The v1 engineering review deliberately reduced scope to artifact-first intake so the team can prove upload -> run -> verdict quality before taking on provider-specific parsing and asset ambiguity handling. This is the first expansion candidate after the core artifact identity, state machine, baseline matching, and evidence pipeline are stable.

**Effort:** M
**Priority:** P2
**Depends on:** Stable artifact-first verdict pipeline in v1

### Add persistent finding lifecycle states after repeat-use pain is proven

**What:** Add finding lifecycle states such as `new`, `accepted-risk`, `fixed`, and `ignored`, with clear rules for how those states influence later verdicts.

**Why:** It gives repeat users memory across runs and reduces noise from known findings once the product sees repeated use.

**Context:** The broader plan originally included persistent finding lifecycle state, but the v1 engineering review deferred it to keep the initial release focused on trusted verdicts and baseline-backed regressions. This work becomes valuable after stable finding identity across runs exists and users start saying, "we already know about this."

**Effort:** M
**Priority:** P2
**Depends on:** Stable finding identity across runs and working baseline/regression model

## Completed
