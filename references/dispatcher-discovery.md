# Dispatcher Discovery Workflow

## Overview

Discovery is part of the Investigate phase. PM evaluates requirement completeness before writing specifications.

## Intake routing (EPIC-201)

**Dispatcher pre-pipeline** uses deterministic checklists (`scripts/intake-evaluate.py`, `references/intake-routing-epic201.md`) — **not** the confidence % below. Four modes: Conversation, Quick, Discovery, From PRD.

## Confidence Scoring (in-pipeline PM narrative only — deprecated for intake routing)

PM evaluates the user request against:

1. Target files/modules identified
2. Clear user goal defined
3. Constraints documented
4. Acceptance criteria verifiable
5. Dependencies mapped
6. Risks identified

Score each dimension 0-20. Total = 0-100.

## Configurable Thresholds

| Task Complexity | Default Threshold | Guidance |
|----------------|-------------------|----------|
| Simple Bug / Patch | 70% | Minimal discovery needed |
| Standard Feature / Refactor | 80% | Standard discovery required |
| Major System Refactor | 90% | Deep discovery required |

## Clarification Loop

If confidence < threshold:

1. PM generates Structured Clarification Request (max 5 questions)
2. Questions must be answerable by user only (not from codebase)
3. Dispatcher presents questions to user
4. User answers
5. PM re-evaluates confidence
6. Max 1 iteration (if still below threshold, proceed with documented assumptions)

## Discipline Rules

- PM must NOT ask questions answerable from repository inspection
- PM must NOT ask questions answerable from documentation
- PM must NOT ask questions answerable from codebase investigation
- Questions allowed ONLY for information not derivable from project evidence

## Discovery Report

Sections:

- Objective
- Scope
- Out of Scope
- Dependencies
- Constraints
- Assumptions
- Known Unknowns
- Acceptance Criteria
- Confidence Score
- Verdict (READY / NOT READY)
