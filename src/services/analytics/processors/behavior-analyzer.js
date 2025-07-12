/**
 * Behavior Analyzer - Analyzes user behavior patterns and journeys
 */
class BehaviorAnalyzer {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    
    // Behavior data storage
    this.userJourneys = new Map();
    this.patterns = new Map();
    this.segments = new Map();
    
    // Configuration
    this.sessionTimeout = config.sessionTimeout || 1800000; // 30 minutes
    this.minPatternSupport = config.minPatternSupport || 0.01; // 1%
    this.maxPatternLength = config.maxPatternLength || 5;
  }

  /**
   * Analyze user journey
   */
  analyzeUserJourney(userId, events) {
    const journey = {
      userId,
      sessions: [],
      totalEvents: events.length,
      firstSeen: events[0]?.timestamp,
      lastSeen: events[events.length - 1]?.timestamp,
      patterns: [],
      metrics: {}
    };
    
    // Group events into sessions
    let currentSession = null;
    for (const event of events) {
      if (!currentSession || 
          event.timestamp - currentSession.endTime > this.sessionTimeout) {
        if (currentSession) {
          journey.sessions.push(currentSession);
        }
        currentSession = {
          id: `${userId}-${event.timestamp.getTime()}`,
          startTime: event.timestamp,
          endTime: event.timestamp,
          events: [],
          pages: new Set(),
          actions: [],
          duration: 0
        };
      }
      
      currentSession.events.push(event);
      currentSession.endTime = event.timestamp;
      currentSession.duration = currentSession.endTime - currentSession.startTime;
      
      if (event.event === 'page_view' && event.properties.page) {
        currentSession.pages.add(event.properties.page);
      }
      
      currentSession.actions.push(event.event);
    }
    
    if (currentSession) {
      journey.sessions.push(currentSession);
    }
    
    // Calculate journey metrics
    journey.metrics = this.calculateJourneyMetrics(journey);
    
    // Identify patterns
    journey.patterns = this.identifyUserPatterns(journey);
    
    // Store journey
    this.userJourneys.set(userId, journey);
    
    return journey;
  }

  /**
   * Calculate journey metrics
   */
  calculateJourneyMetrics(journey) {
    const metrics = {
      sessionCount: journey.sessions.length,
      avgSessionDuration: 0,
      avgEventsPerSession: 0,
      bounceRate: 0,
      engagementScore: 0,
      conversionEvents: [],
      dropoffPoints: []
    };
    
    if (journey.sessions.length === 0) {
      return metrics;
    }
    
    // Session metrics
    const totalDuration = journey.sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalEvents = journey.sessions.reduce((sum, s) => sum + s.events.length, 0);
    
    metrics.avgSessionDuration = totalDuration / journey.sessions.length;
    metrics.avgEventsPerSession = totalEvents / journey.sessions.length;
    
    // Bounce rate (sessions with only one event)
    const bouncedSessions = journey.sessions.filter(s => s.events.length === 1).length;
    metrics.bounceRate = bouncedSessions / journey.sessions.length;
    
    // Engagement score (based on various factors)
    metrics.engagementScore = this.calculateEngagementScore(journey);
    
    // Find conversion events
    for (const session of journey.sessions) {
      const conversions = session.events.filter(e => 
        e.event === 'conversion' || 
        e.event.includes('purchase') || 
        e.event.includes('signup')
      );
      metrics.conversionEvents.push(...conversions);
    }
    
    // Identify dropoff points
    metrics.dropoffPoints = this.identifyDropoffPoints(journey);
    
    return metrics;
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(journey) {
    let score = 0;
    
    // Factors that increase engagement
    score += Math.min(journey.sessions.length * 10, 50); // Up to 50 points for sessions
    score += Math.min(journey.totalEvents / 10, 30); // Up to 30 points for events
    
    // Average session duration (normalized)
    const avgDuration = journey.metrics.avgSessionDuration || 0;
    score += Math.min(avgDuration / 60000, 20); // Up to 20 points for duration
    
    // Penalize high bounce rate
    score -= journey.metrics.bounceRate * 20;
    
    // Bonus for conversions
    score += journey.metrics.conversionEvents.length * 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Identify user patterns
   */
  identifyUserPatterns(journey) {
    const patterns = [];
    const sequences = [];
    
    // Extract action sequences from sessions
    for (const session of journey.sessions) {
      if (session.actions.length >= 2) {
        sequences.push(session.actions);
      }
    }
    
    // Find frequent subsequences
    const frequentPatterns = this.findFrequentPatterns(sequences);
    
    // Analyze each pattern
    for (const [pattern, support] of frequentPatterns) {
      patterns.push({
        pattern: pattern.split(','),
        support,
        confidence: support / sequences.length,
        lift: this.calculatePatternLift(pattern, sequences)
      });
    }
    
    return patterns.sort((a, b) => b.support - a.support);
  }

  /**
   * Find frequent patterns using Apriori-like algorithm
   */
  findFrequentPatterns(sequences) {
    const patterns = new Map();
    
    // Start with single items
    for (const sequence of sequences) {
      for (let i = 0; i < sequence.length; i++) {
        const pattern = sequence[i];
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    }
    
    // Generate longer patterns
    for (let length = 2; length <= this.maxPatternLength; length++) {
      const newPatterns = new Map();
      
      for (const sequence of sequences) {
        for (let i = 0; i <= sequence.length - length; i++) {
          const pattern = sequence.slice(i, i + length).join(',');
          newPatterns.set(pattern, (newPatterns.get(pattern) || 0) + 1);
        }
      }
      
      // Keep only patterns above minimum support
      const minSupport = sequences.length * this.minPatternSupport;
      for (const [pattern, count] of newPatterns) {
        if (count >= minSupport) {
          patterns.set(pattern, count);
        }
      }
    }
    
    return patterns;
  }

  /**
   * Calculate pattern lift
   */
  calculatePatternLift(pattern, sequences) {
    const items = pattern.split(',');
    if (items.length < 2) return 1;
    
    // Calculate individual probabilities
    const totalSequences = sequences.length;
    const itemCounts = new Map();
    
    for (const item of items) {
      let count = 0;
      for (const sequence of sequences) {
        if (sequence.includes(item)) count++;
      }
      itemCounts.set(item, count / totalSequences);
    }
    
    // Calculate expected probability (assuming independence)
    let expectedProb = 1;
    for (const prob of itemCounts.values()) {
      expectedProb *= prob;
    }
    
    // Calculate actual probability
    let actualCount = 0;
    for (const sequence of sequences) {
      if (items.every(item => sequence.includes(item))) {
        actualCount++;
      }
    }
    const actualProb = actualCount / totalSequences;
    
    // Lift = actual / expected
    return expectedProb > 0 ? actualProb / expectedProb : 0;
  }

  /**
   * Identify dropoff points
   */
  identifyDropoffPoints(journey) {
    const dropoffs = [];
    
    for (const session of journey.sessions) {
      // Check if session ended without conversion
      const hasConversion = session.events.some(e => 
        e.event === 'conversion' || 
        e.event.includes('purchase') || 
        e.event.includes('signup')
      );
      
      if (!hasConversion && session.events.length > 1) {
        const lastEvent = session.events[session.events.length - 1];
        dropoffs.push({
          event: lastEvent.event,
          page: lastEvent.properties.page,
          timestamp: lastEvent.timestamp,
          sessionDuration: session.duration,
          eventsBeforeDropoff: session.events.length
        });
      }
    }
    
    return dropoffs;
  }

  /**
   * Segment users based on behavior
   */
  segmentUsers(userIds) {
    const segments = {
      'power_users': [],
      'regular_users': [],
      'at_risk': [],
      'churned': [],
      'new_users': []
    };
    
    const now = new Date();
    const daysSinceLastSeen = (lastSeen) => 
      (now - new Date(lastSeen)) / (1000 * 60 * 60 * 24);
    
    for (const userId of userIds) {
      const journey = this.userJourneys.get(userId);
      if (!journey) continue;
      
      const metrics = journey.metrics;
      const daysSinceLast = daysSinceLastSeen(journey.lastSeen);
      const engagementScore = metrics.engagementScore || 0;
      
      // Segmentation rules
      if (engagementScore >= 70 && daysSinceLast < 7) {
        segments.power_users.push({
          userId,
          score: engagementScore,
          lastSeen: journey.lastSeen
        });
      } else if (engagementScore >= 40 && daysSinceLast < 14) {
        segments.regular_users.push({
          userId,
          score: engagementScore,
          lastSeen: journey.lastSeen
        });
      } else if (engagementScore < 40 && daysSinceLast < 30) {
        segments.at_risk.push({
          userId,
          score: engagementScore,
          lastSeen: journey.lastSeen,
          risk: 'low_engagement'
        });
      } else if (daysSinceLast > 30) {
        segments.churned.push({
          userId,
          score: engagementScore,
          lastSeen: journey.lastSeen,
          daysSinceLast
        });
      }
      
      // New users (first seen within 7 days)
      const daysSinceFirst = daysSinceLastSeen(journey.firstSeen);
      if (daysSinceFirst <= 7) {
        segments.new_users.push({
          userId,
          score: engagementScore,
          firstSeen: journey.firstSeen
        });
      }
    }
    
    // Store segments
    for (const [segmentName, users] of Object.entries(segments)) {
      this.segments.set(segmentName, users);
    }
    
    return segments;
  }

  /**
   * Get behavior insights
   */
  getBehaviorInsights() {
    const insights = {
      userPatterns: [],
      commonPaths: [],
      dropoffAnalysis: {},
      segmentSummary: {},
      recommendations: []
    };
    
    // Aggregate patterns across all users
    const allPatterns = new Map();
    for (const journey of this.userJourneys.values()) {
      for (const pattern of journey.patterns) {
        const key = pattern.pattern.join(' → ');
        if (!allPatterns.has(key)) {
          allPatterns.set(key, {
            pattern: pattern.pattern,
            totalSupport: 0,
            userCount: 0
          });
        }
        allPatterns.get(key).totalSupport += pattern.support;
        allPatterns.get(key).userCount++;
      }
    }
    
    // Top patterns
    insights.userPatterns = Array.from(allPatterns.values())
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 10)
      .map(p => ({
        pattern: p.pattern,
        users: p.userCount,
        avgSupport: p.totalSupport / p.userCount
      }));
    
    // Common user paths
    insights.commonPaths = this.identifyCommonPaths();
    
    // Dropoff analysis
    const allDropoffs = [];
    for (const journey of this.userJourneys.values()) {
      allDropoffs.push(...journey.metrics.dropoffPoints);
    }
    
    const dropoffByPage = new Map();
    for (const dropoff of allDropoffs) {
      const page = dropoff.page || 'unknown';
      if (!dropoffByPage.has(page)) {
        dropoffByPage.set(page, {
          count: 0,
          avgDuration: 0,
          avgEvents: 0
        });
      }
      const stats = dropoffByPage.get(page);
      stats.count++;
      stats.avgDuration += dropoff.sessionDuration;
      stats.avgEvents += dropoff.eventsBeforeDropoff;
    }
    
    // Calculate averages
    for (const [page, stats] of dropoffByPage) {
      stats.avgDuration /= stats.count;
      stats.avgEvents /= stats.count;
    }
    
    insights.dropoffAnalysis = Object.fromEntries(
      Array.from(dropoffByPage.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
    );
    
    // Segment summary
    for (const [segment, users] of this.segments) {
      insights.segmentSummary[segment] = {
        count: users.length,
        percentage: (users.length / this.userJourneys.size) * 100
      };
    }
    
    // Generate recommendations
    insights.recommendations = this.generateBehaviorRecommendations(insights);
    
    return insights;
  }

  /**
   * Identify common paths
   */
  identifyCommonPaths() {
    const paths = new Map();
    
    for (const journey of this.userJourneys.values()) {
      for (const session of journey.sessions) {
        // Extract page navigation paths
        const pageSequence = [];
        for (const event of session.events) {
          if (event.event === 'page_view' && event.properties.page) {
            pageSequence.push(event.properties.page);
          }
        }
        
        if (pageSequence.length >= 2) {
          const pathKey = pageSequence.join(' → ');
          paths.set(pathKey, (paths.get(pathKey) || 0) + 1);
        }
      }
    }
    
    return Array.from(paths.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Generate behavior recommendations
   */
  generateBehaviorRecommendations(insights) {
    const recommendations = [];
    
    // Check dropoff points
    const topDropoffs = Object.entries(insights.dropoffAnalysis).slice(0, 3);
    for (const [page, stats] of topDropoffs) {
      if (stats.count > 10) {
        recommendations.push({
          type: 'reduce_dropoff',
          priority: 'high',
          page,
          issue: `High dropoff rate: ${stats.count} users`,
          suggestions: [
            'Improve page load time',
            'Simplify user interface',
            'Add clear call-to-action',
            'A/B test different layouts'
          ]
        });
      }
    }
    
    // Check user segments
    if (insights.segmentSummary.at_risk && 
        insights.segmentSummary.at_risk.percentage > 20) {
      recommendations.push({
        type: 'retain_users',
        priority: 'high',
        issue: `${insights.segmentSummary.at_risk.percentage.toFixed(1)}% of users are at risk`,
        suggestions: [
          'Implement re-engagement campaigns',
          'Send personalized notifications',
          'Offer incentives for activity',
          'Improve onboarding experience'
        ]
      });
    }
    
    if (insights.segmentSummary.new_users && 
        insights.segmentSummary.new_users.percentage > 30) {
      recommendations.push({
        type: 'improve_onboarding',
        priority: 'medium',
        issue: 'High percentage of new users',
        suggestions: [
          'Create interactive tutorials',
          'Implement progressive disclosure',
          'Add contextual help',
          'Monitor first-session behavior'
        ]
      });
    }
    
    // Check common patterns
    if (insights.userPatterns.length > 0) {
      const topPattern = insights.userPatterns[0];
      recommendations.push({
        type: 'optimize_flow',
        priority: 'medium',
        pattern: topPattern.pattern.join(' → '),
        issue: `Common pattern used by ${topPattern.users} users`,
        suggestions: [
          'Streamline this user flow',
          'Add shortcuts for common actions',
          'Pre-load next likely pages',
          'Optimize for this journey'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Predict next user action
   */
  predictNextAction(userId, recentActions) {
    const predictions = new Map();
    
    // Get user's historical patterns
    const journey = this.userJourneys.get(userId);
    if (!journey) {
      return this.getGlobalPredictions(recentActions);
    }
    
    // Find matching patterns
    for (const pattern of journey.patterns) {
      const patternActions = pattern.pattern;
      
      // Check if recent actions match the beginning of this pattern
      if (patternActions.length > recentActions.length) {
        let matches = true;
        for (let i = 0; i < recentActions.length; i++) {
          if (patternActions[i] !== recentActions[i]) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          const nextAction = patternActions[recentActions.length];
          const confidence = pattern.confidence * pattern.lift;
          predictions.set(nextAction, 
            Math.max(predictions.get(nextAction) || 0, confidence)
          );
        }
      }
    }
    
    // Convert to sorted array
    return Array.from(predictions.entries())
      .map(([action, confidence]) => ({ action, confidence }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Get global predictions based on all users
   */
  getGlobalPredictions(recentActions) {
    const predictions = new Map();
    
    // Aggregate patterns from all users
    for (const journey of this.userJourneys.values()) {
      for (const pattern of journey.patterns) {
        const patternActions = pattern.pattern;
        
        if (patternActions.length > recentActions.length) {
          let matches = true;
          for (let i = 0; i < recentActions.length; i++) {
            if (patternActions[i] !== recentActions[i]) {
              matches = false;
              break;
            }
          }
          
          if (matches) {
            const nextAction = patternActions[recentActions.length];
            predictions.set(nextAction, 
              (predictions.get(nextAction) || 0) + pattern.support
            );
          }
        }
      }
    }
    
    // Normalize and sort
    const total = Array.from(predictions.values()).reduce((a, b) => a + b, 0);
    
    return Array.from(predictions.entries())
      .map(([action, support]) => ({ 
        action, 
        confidence: total > 0 ? support / total : 0 
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }
}

export default BehaviorAnalyzer;