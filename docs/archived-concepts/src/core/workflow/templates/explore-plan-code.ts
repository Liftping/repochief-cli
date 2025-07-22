/**
 * Explore-Plan-Code-Commit (EPCC) Workflow Template
 * 
 * The most successful development pattern that prevents premature coding
 * by ensuring thorough understanding and planning before implementation.
 */

import { BaseWorkflow, WorkflowStage, AgentRole } from '../base-workflow';
import { ThinkModeBehavior } from '../../agents/behaviors/think-mode';
import { DefensiveCodingBehavior } from '../../agents/behaviors/defensive-coding';
import { NaturalLanguageGit } from '../../../integrations/git/natural-language-git';

export interface EPCCWorkflowConfig {
  thinkDepth: 'low' | 'medium' | 'high' | 'max';
  exploreScope: 'focused' | 'comprehensive' | 'architectural';
  planDetail: 'minimal' | 'detailed' | 'comprehensive';
  codeQuality: 'standard' | 'production' | 'bulletproof';
  commitStyle: 'conventional' | 'descriptive' | 'team-standard';
}

export class ExplorePlanCodeCommitWorkflow extends BaseWorkflow {
  name = 'explore-plan-code-commit';
  description = 'Structured development workflow preventing premature coding';
  
  constructor(private config: EPCCWorkflowConfig = {
    thinkDepth: 'medium',
    exploreScope: 'comprehensive',
    planDetail: 'detailed',
    codeQuality: 'production',
    commitStyle: 'conventional'
  }) {
    super();
  }

  defineStages(): WorkflowStage[] {
    return [
      {
        name: 'explore',
        description: 'Deep exploration and context gathering',
        agent: AgentRole.ARCHITECT,
        behavior: 'think-mode',
        config: {
          thinkDepth: this.config.thinkDepth,
          scope: this.config.exploreScope
        },
        actions: [
          'read-relevant-files',
          'analyze-architecture',
          'understand-context',
          'identify-dependencies',
          'gather-requirements'
        ],
        outputs: {
          explorationReport: 'comprehensive understanding of problem space',
          contextMap: 'architectural context and dependencies',
          requirements: 'extracted and clarified requirements'
        },
        successCriteria: [
          'All relevant files analyzed',
          'Architecture understood',
          'Dependencies mapped',
          'Requirements clarified'
        ]
      },

      {
        name: 'plan',
        description: 'Architectural planning and strategy formation',
        agent: AgentRole.ARCHITECT,
        behavior: 'think-mode',
        dependsOn: ['explore'],
        config: {
          thinkDepth: this.config.thinkDepth,
          detail: this.config.planDetail
        },
        actions: [
          'evaluate-approaches',
          'assess-tradeoffs',
          'plan-implementation',
          'identify-risks',
          'create-roadmap'
        ],
        outputs: {
          implementationPlan: 'step-by-step implementation strategy',
          tradeoffAnalysis: 'evaluated alternatives and decisions',
          riskAssessment: 'identified risks and mitigations',
          roadmap: 'phased implementation approach'
        },
        successCriteria: [
          'Clear implementation strategy',
          'Tradeoffs evaluated',
          'Risks identified and mitigated',
          'Plan validated by architect'
        ]
      },

      {
        name: 'code',
        description: 'Implementation with defensive coding patterns',
        agent: AgentRole.DEVELOPER,
        behavior: 'defensive-coding',
        dependsOn: ['plan'],
        config: {
          quality: this.config.codeQuality,
          patterns: ['error-handling', 'input-validation', 'resilience']
        },
        actions: [
          'implement-core-logic',
          'add-error-handling',
          'implement-validation',
          'add-logging',
          'write-tests'
        ],
        outputs: {
          implementation: 'working code with defensive patterns',
          tests: 'comprehensive test coverage',
          documentation: 'inline and API documentation'
        },
        successCriteria: [
          'All planned features implemented',
          'Defensive patterns applied',
          'Tests passing',
          'Code reviewed'
        ],
        validation: {
          runTests: true,
          checkCoverage: true,
          validatePatterns: true,
          securityScan: true
        }
      },

      {
        name: 'commit',
        description: 'Natural language git operations and PR creation',
        agent: AgentRole.DEVELOPER,
        behavior: 'natural-language-git',
        dependsOn: ['code'],
        config: {
          style: this.config.commitStyle,
          includeTests: true,
          createPR: true
        },
        actions: [
          'stage-changes',
          'generate-commit-message',
          'create-commit',
          'push-branch',
          'create-pull-request'
        ],
        outputs: {
          commit: 'well-structured git commit',
          pullRequest: 'comprehensive pull request',
          changelog: 'generated changelog entry'
        },
        successCriteria: [
          'Changes properly staged',
          'Commit message follows conventions',
          'PR created with description',
          'CI/CD pipeline triggered'
        ]
      }
    ];
  }

  /**
   * Trigger words that activate EPCC workflow
   */
  getTriggerPatterns(): string[] {
    return [
      'explore plan code commit',
      'epcc workflow',
      'structured development',
      'think before coding',
      'architectural approach'
    ];
  }

  /**
   * Pre-execution validation
   */
  async validate(): Promise<boolean> {
    const checks = [
      this.validateGitRepository(),
      this.validateAgentAvailability(['architect', 'developer']),
      this.validateToolAccess(['think-mode', 'defensive-coding', 'git'])
    ];

    const results = await Promise.all(checks);
    return results.every(result => result === true);
  }

  /**
   * Workflow-specific configuration
   */
  getConfiguration(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      config: this.config,
      estimatedDuration: this.estimateDuration(),
      requiredAgents: [AgentRole.ARCHITECT, AgentRole.DEVELOPER],
      requiredTools: ['think-mode', 'defensive-coding', 'natural-language-git'],
      outputs: [
        'exploration-report',
        'implementation-plan',
        'working-code',
        'pull-request'
      ]
    };
  }

  private estimateDuration(): string {
    const durations = {
      explore: this.config.exploreScope === 'architectural' ? '30-45 min' : '15-30 min',
      plan: this.config.planDetail === 'comprehensive' ? '20-30 min' : '10-20 min',
      code: this.config.codeQuality === 'bulletproof' ? '45-90 min' : '30-60 min',
      commit: '5-10 min'
    };

    return `Total: 1.5-3 hours (${Object.values(durations).join(', ')})`;
  }
}

/**
 * Factory function for creating EPCC workflows with different configurations
 */
export const EPCCWorkflowFactory = {
  /**
   * Quick iteration workflow - minimal exploration, fast implementation
   */
  quickIteration(): ExplorePlanCodeCommitWorkflow {
    return new ExplorePlanCodeCommitWorkflow({
      thinkDepth: 'low',
      exploreScope: 'focused',
      planDetail: 'minimal',
      codeQuality: 'standard',
      commitStyle: 'conventional'
    });
  },

  /**
   * Production feature workflow - comprehensive analysis and bulletproof code
   */
  productionFeature(): ExplorePlanCodeCommitWorkflow {
    return new ExplorePlanCodeCommitWorkflow({
      thinkDepth: 'high',
      exploreScope: 'comprehensive',
      planDetail: 'comprehensive',
      codeQuality: 'bulletproof',
      commitStyle: 'descriptive'
    });
  },

  /**
   * Architectural change workflow - maximum thinking and planning
   */
  architecturalChange(): ExplorePlanCodeCommitWorkflow {
    return new ExplorePlanCodeCommitWorkflow({
      thinkDepth: 'max',
      exploreScope: 'architectural',
      planDetail: 'comprehensive',
      codeQuality: 'bulletproof',
      commitStyle: 'descriptive'
    });
  },

  /**
   * Bug fix workflow - focused exploration with defensive coding
   */
  bugFix(): ExplorePlanCodeCommitWorkflow {
    return new ExplorePlanCodeCommitWorkflow({
      thinkDepth: 'medium',
      exploreScope: 'focused',
      planDetail: 'detailed',
      codeQuality: 'production',
      commitStyle: 'conventional'
    });
  }
};