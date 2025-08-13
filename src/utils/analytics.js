const { PostHog } = require('posthog-node');
const os = require('os');
const path = require('path');

class AnalyticsManager {
    constructor() {
        this.client = null;
        this.sessionId = null;
        this.isEnabled = process.env.REPOCHIEF_ANALYTICS !== 'false';
        this.userId = null;
        
        if (this.isEnabled) {
            this.initializePostHog();
        }
    }

    initializePostHog() {
        try {
            this.client = new PostHog(
                process.env.POSTHOG_API_KEY || 'phc_demo_key',
                {
                    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
                    flushAt: 1, // Send events immediately for CLI
                    flushInterval: 0 // Don't batch for CLI usage
                }
            );
            
            this.sessionId = this.generateSessionId();
            
            // Set user properties for development tracking
            this.setUserProperties();
            
        } catch (error) {
            console.warn('Analytics initialization failed:', error.message);
            this.isEnabled = false;
        }
    }

    setUserProperties() {
        if (!this.client || !this.isEnabled) return;

        this.userId = os.userInfo().username || 'unknown';
        
        const userProperties = {
            cli_version: process.env.npm_package_version || 'unknown',
            node_version: process.version,
            platform: os.platform(),
            arch: os.arch(),
            environment: process.env.NODE_ENV || 'production',
            session_id: this.sessionId,
            role: 'developer'
        };

        this.client.identify({
            distinctId: this.userId,
            properties: userProperties
        });
    }

    generateSessionId() {
        return `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Track CLI command usage patterns
    trackCommand(command, options = {}, success = true, duration = 0) {
        if (!this.client || !this.isEnabled) return;

        this.client.capture({
            distinctId: this.userId,
            event: 'cli_command_executed',
            properties: {
                command_name: command,
                command_options: this.sanitizeOptions(options),
                success: success,
                duration_ms: duration,
                session_id: this.sessionId,
                working_directory: process.cwd(),
                timestamp: new Date().toISOString()
            }
        });
    }

    // Track CLI error patterns for development acceleration
    trackError(command, error, context = {}) {
        if (!this.client || !this.isEnabled) return;

        this.client.capture({
            distinctId: this.userId,
            event: 'cli_error_occurred',
            properties: {
                command_name: command,
                error_message: error.message,
                error_type: error.constructor.name,
                error_stack: error.stack ? error.stack.substring(0, 1000) : null,
                context: context,
                session_id: this.sessionId,
                working_directory: process.cwd(),
                timestamp: new Date().toISOString()
            }
        });
    }

    // Track development workflow performance
    trackWorkflowStep(workflow, step, duration, success = true) {
        if (!this.client || !this.isEnabled) return;

        this.client.capture({
            distinctId: this.userId,
            event: 'development_workflow_step',
            properties: {
                workflow_name: workflow,
                step_name: step,
                step_duration_ms: duration,
                step_success: success,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Track CLI usage frequency for optimization insights
    trackUsagePattern(pattern, frequency, optimization_opportunity) {
        if (!this.client || !this.isEnabled) return;

        this.client.capture({
            distinctId: this.userId,
            event: 'cli_usage_pattern',
            properties: {
                pattern_type: pattern,
                usage_frequency: frequency,
                optimization_opportunity: optimization_opportunity,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Track development acceleration results
    trackAcceleration(task, before_time, after_time, method) {
        if (!this.client || !this.isEnabled) return;

        const improvement = ((before_time - after_time) / before_time) * 100;

        this.client.capture({
            distinctId: this.userId,
            event: 'development_acceleration',
            properties: {
                task_name: task,
                before_duration_ms: before_time,
                after_duration_ms: after_time,
                improvement_percentage: improvement,
                acceleration_method: method,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Track CLI performance metrics
    trackPerformance(operation, duration, memory_usage) {
        if (!this.client || !this.isEnabled) return;

        this.client.capture({
            distinctId: this.userId,
            event: 'cli_performance_metric',
            properties: {
                operation_name: operation,
                operation_duration_ms: duration,
                memory_usage_mb: memory_usage ? Math.round(memory_usage / 1024 / 1024) : null,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Sanitize command options to remove sensitive data
    sanitizeOptions(options) {
        const sanitized = { ...options };
        
        // Remove sensitive fields
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    // Flush events before CLI exits
    async flush() {
        if (!this.client || !this.isEnabled) return;

        try {
            await this.client.shutdown();
        } catch (error) {
            // Ignore flush errors to prevent CLI from hanging
        }
    }

    // Track CLI session end
    trackSessionEnd(commands_executed, total_duration) {
        if (!this.client || !this.isEnabled) return;

        this.client.capture({
            distinctId: this.userId,
            event: 'cli_session_ended',
            properties: {
                commands_executed: commands_executed,
                session_duration_ms: total_duration,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Singleton instance
let analyticsInstance = null;

function getAnalytics() {
    if (!analyticsInstance) {
        analyticsInstance = new AnalyticsManager();
    }
    return analyticsInstance;
}

// Convenience functions
function trackCommand(command, options, success, duration) {
    getAnalytics().trackCommand(command, options, success, duration);
}

function trackError(command, error, context) {
    getAnalytics().trackError(command, error, context);
}

function trackWorkflowStep(workflow, step, duration, success) {
    getAnalytics().trackWorkflowStep(workflow, step, duration, success);
}

function trackAcceleration(task, beforeTime, afterTime, method) {
    getAnalytics().trackAcceleration(task, beforeTime, afterTime, method);
}

function trackPerformance(operation, duration, memoryUsage) {
    getAnalytics().trackPerformance(operation, duration, memoryUsage);
}

async function flushAnalytics() {
    if (analyticsInstance) {
        await analyticsInstance.flush();
    }
}

module.exports = {
    getAnalytics,
    trackCommand,
    trackError,
    trackWorkflowStep,
    trackAcceleration,
    trackPerformance,
    flushAnalytics
};