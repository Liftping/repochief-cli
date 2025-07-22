# RepoChief Plan Templates Catalog

## Overview

This directory contains standardized YAML templates for common development workflows in RepoChief. These templates demonstrate the power of RepoChief's planning system, inherited and enhanced from ETM (Enhanced Task Management).

## Template Structure

All templates follow the RepoChief plan schema:

```yaml
apiVersion: repochief.io/v1      # API version for compatibility
kind: <PlanType>                 # Type of plan (WeeklySprint, FeatureDevelopment, etc.)
metadata:                        # Plan metadata
  schemaVersion: "1.0"          # Schema version
  name: "Plan Name"             # Human-readable name
  description: "Description"     # Detailed description
  author: "email@company.com"   # Plan author
  created: "ISO 8601 timestamp" # Creation timestamp
  tags: []                      # Categorization tags
spec:                           # Plan specification
  settings: {}                  # Execution settings
  # ... plan-specific fields
```

## Available Templates

### 1. Weekly Sprint Template (`01_weekly_sprint.yml`)

**Purpose**: Organize weekly development sprints with multiple parallel tracks.

**Use Case**: Regular development cycles, team coordination, milestone-based delivery.

**Key Features**:
- Multi-track development (Core, Docs, Test)
- Parallel task execution
- Milestone tracking
- Agent-specific track assignment

**Example Usage**:
```bash
repochief plan create --template weekly-sprint \
  --name "Week 21 - Feature Sprint" \
  --tracks "backend,frontend,qa"
```

### 2. Feature Development Template (`02_feature_development.yml`)

**Purpose**: Implement complete features with requirements-driven development.

**Use Case**: New feature implementation, user stories, PRD-based development.

**Key Features**:
- Requirements specification (functional & non-functional)
- Phased implementation approach
- Deliverables tracking
- Multi-agent collaboration

**Example Usage**:
```bash
repochief plan create --template feature-development \
  --name "Payment Integration" \
  --requirements "requirements.md"
```

### 3. Bug Fix Campaign Template (`03_bug_fix_campaign.yml`)

**Purpose**: Systematic resolution of bugs with proper tracking and verification.

**Use Case**: Bug fix sprints, quality improvement campaigns, security patches.

**Key Features**:
- Bug severity classification
- Reproduction steps documentation
- Test-first approach
- Regression prevention
- Comprehensive verification

**Example Usage**:
```bash
repochief plan create --template bug-fix \
  --bugs "JIRA-123,JIRA-456,JIRA-789" \
  --priority "critical"
```

### 4. Refactoring Project Template (`04_refactoring_project.yml`)

**Purpose**: Modernize legacy code while maintaining functionality.

**Use Case**: Technical debt reduction, code modernization, architecture improvements.

**Key Features**:
- Metrics-driven approach (before/after)
- Incremental refactoring strategy
- Safety net creation (tests first)
- Behavior preservation
- Architecture documentation

**Example Usage**:
```bash
repochief plan create --template refactoring \
  --target "src/legacy/payment-system" \
  --metrics "complexity,coverage,duplication"
```

### 5. TDD Workflow Template (`05_tdd_workflow.yml`)

**Purpose**: Implement features using strict Test-Driven Development cycles.

**Use Case**: Quality-first development, training, best practices demonstration.

**Key Features**:
- Red-Green-Refactor cycles
- Enforced test-first approach
- Coverage requirements
- Small iteration cycles
- Comprehensive documentation

**Example Usage**:
```bash
repochief plan create --template tdd \
  --feature "User Authentication" \
  --coverage-threshold 95
```

## Template Selection Guide

Choose the right template based on your needs:

| Scenario | Recommended Template | Why |
|----------|---------------------|-----|
| Regular sprint planning | Weekly Sprint | Multi-track coordination |
| New feature from scratch | Feature Development | Requirements-driven |
| Fixing production issues | Bug Fix Campaign | Systematic approach |
| Cleaning technical debt | Refactoring Project | Metrics & safety |
| Learning TDD | TDD Workflow | Enforced practices |
| Quick prototype | Feature Development | Rapid phases |
| Performance optimization | Refactoring Project | Measure improvements |

## Customization

### Modifying Templates

1. **Copy template as starting point**:
   ```bash
   cp 01_weekly_sprint.yml my_custom_sprint.yml
   ```

2. **Adjust settings**:
   ```yaml
   settings:
     executionMode: "sequential"  # Change from parallel
     defaultAgent: "aider"        # Different AI agent
   ```

3. **Add custom fields**:
   ```yaml
   spec:
     customField: "value"
     specialRequirements: []
   ```

### Creating New Templates

1. **Start with schema**:
   ```yaml
   apiVersion: repochief.io/v1
   kind: CustomWorkflow
   metadata:
     schemaVersion: "1.0"
   ```

2. **Define your structure**:
   ```yaml
   spec:
     phases: []      # Your workflow phases
     validation: []  # Success criteria
     metrics: {}     # What to measure
   ```

3. **Test locally**:
   ```bash
   repochief plan validate my_template.yml
   ```

## ETM Heritage

These templates build upon ETM's proven patterns:

### From ETM
- Multi-track coordination
- Task dependencies
- Agent specialization
- Wave-based execution

### RepoChief Enhancements
- Visual plan builder compatibility
- Cloud-local synchronization
- Real-time analytics hooks
- Language-agnostic design
- Multi-agent support

## Integration with Cloud UI

When using the cloud control panel:

1. **Template Library**: All templates appear in the visual plan builder
2. **Drag & Drop**: Modify template tasks visually
3. **AI Assistance**: Get task suggestions based on template type
4. **Team Sharing**: Save customized templates for team use

## Best Practices

### 1. Version Control
- Commit templates to your repository
- Tag template versions
- Document template changes

### 2. Estimation Accuracy
- Use historical data for estimates
- Adjust based on team velocity
- Include buffer time for unknowns

### 3. Agent Selection
- Match agents to task types
- Consider agent strengths
- Balance load across agents

### 4. Dependency Management
- Keep dependencies minimal
- Avoid circular dependencies
- Use phases for clarity

### 5. Testing Integration
- Include test tasks in every plan
- Specify coverage requirements
- Automate verification steps

## Migration from ETM

For teams migrating from ETM:

```bash
# Convert ETM markdown plans
repochief migrate --from-etm WEEK_20_UNIFIED_TODO.md

# Bulk conversion
repochief migrate --from-etm ./etm-plans/ --output ./repochief-plans/
```

## Template Evolution

Templates are versioned and backward compatible:

- **v1.0**: Initial schema (current)
- **v1.1**: (Planned) Conditional logic support
- **v2.0**: (Future) Advanced workflow features

## Contributing Templates

Share your templates with the community:

1. Fork the RepoChief repository
2. Add template to `examples/plan-templates/`
3. Update this catalog
4. Submit pull request

## Support

- **Documentation**: https://docs.repochief.com/templates
- **Community**: https://discord.gg/repochief
- **Issues**: https://github.com/repochief/repochief/issues

---

*Templates are living documents. Customize them to fit your team's workflow!*