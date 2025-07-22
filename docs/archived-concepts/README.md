# Archived RepoChief Concepts

## Overview

This directory contains archived conceptual code from earlier RepoChief development phases. These files represent design ideas that were superseded by the working JavaScript implementation but contain valuable patterns and concepts.

## Contents

### `/src/core/workflow/templates/explore-plan-code.ts`

**Concept**: Explore-Plan-Code-Commit (EPCC) Workflow Template

**Key Ideas**:
- Structured development workflow preventing premature coding
- Multi-stage approach: Explore → Plan → Code → Commit
- Agent specialization (Architect, Developer roles)
- Defensive coding patterns and validation
- Natural language git operations

**Status**: Conceptual TypeScript design, not implemented
**Value**: Good workflow pattern ideas for future enhancement

**Notable Features**:
- Think-mode behavior integration
- Configurable workflow depths and scopes
- Automatic validation and quality gates
- Multi-agent coordination patterns

## Migration Notes

These concepts were archived during the migration from:
- **Old Structure**: `packages/repochief/src/` (TypeScript concepts)
- **New Structure**: `packages/repochief-core/src/` (Working JavaScript implementation)

## Future Considerations

Some concepts from these archived files could be valuable for future RepoChief enhancements:

1. **EPCC Workflow Pattern** - The structured approach could be implemented as a workflow template
2. **Agent Role Specialization** - More sophisticated agent typing
3. **Defensive Coding Behaviors** - Automated pattern enforcement
4. **Natural Language Git** - Git operations with natural language interfaces

## Usage

These files are for reference only and contain broken imports. They should not be executed but can be studied for design patterns and architectural ideas.

---

*Archived on: 2025-07-22*  
*Migration from: packages/repochief/src/*  
*Reason: Superseded by working JavaScript implementation*