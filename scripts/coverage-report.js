#!/usr/bin/env node

/**
 * Coverage Report Generator
 * 
 * Generates comprehensive coverage reports and validates against quality gates.
 * Provides detailed analysis of test coverage across different dimensions.
 */

const fs = require('fs');
const path = require('path');

class CoverageReporter {
  constructor() {
    this.coverageDir = path.join(process.cwd(), 'coverage');
    this.reportFile = path.join(this.coverageDir, 'coverage-summary.txt');
    this.thresholds = {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    };
  }

  async generateReport() {
    try {
      const coverageData = await this.loadCoverageData();
      const report = this.createDetailedReport(coverageData);
      
      await this.writeReport(report);
      this.validateThresholds(coverageData);
      
      console.log('✅ Coverage report generated successfully');
      console.log(`📊 Report saved to: ${this.reportFile}`);
      
    } catch (error) {
      console.error('❌ Failed to generate coverage report:', error);
      process.exit(1);
    }
  }

  async loadCoverageData() {
    const coverageSummaryPath = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(coverageSummaryPath)) {
      throw new Error('Coverage summary not found. Run tests with coverage first.');
    }
    
    const data = fs.readFileSync(coverageSummaryPath, 'utf8');
    return JSON.parse(data);
  }

  createDetailedReport(coverageData) {
    const total = coverageData.total;
    
    const report = [
      '# Test Coverage Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Overall Coverage',
      `- **Statements**: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`,
      `- **Branches**: ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`,
      `- **Functions**: ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`,
      `- **Lines**: ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`,
      '',
      '## Quality Gates',
      this.checkThreshold('Statements', total.statements.pct, this.thresholds.statements),
      this.checkThreshold('Branches', total.branches.pct, this.thresholds.branches),
      this.checkThreshold('Functions', total.functions.pct, this.thresholds.functions),
      this.checkThreshold('Lines', total.lines.pct, this.thresholds.lines),
      '',
      '## File Coverage Details',
      ''
    ];

    // Add per-file coverage details
    const files = Object.keys(coverageData).filter(key => key !== 'total');
    const sortedFiles = files.sort((a, b) => {
      const aCoverage = coverageData[a].statements.pct;
      const bCoverage = coverageData[b].statements.pct;
      return aCoverage - bCoverage; // Sort by lowest coverage first
    });

    sortedFiles.forEach(filePath => {
      const fileData = coverageData[filePath];
      const relativePath = path.relative(process.cwd(), filePath);
      
      report.push(`### ${relativePath}`);
      report.push(`- Statements: ${fileData.statements.pct}%`);
      report.push(`- Branches: ${fileData.branches.pct}%`);
      report.push(`- Functions: ${fileData.functions.pct}%`);
      report.push(`- Lines: ${fileData.lines.pct}%`);
      report.push('');
    });

    // Add low coverage files section
    const lowCoverageFiles = sortedFiles.filter(filePath => {
      const fileData = coverageData[filePath];
      return fileData.statements.pct < this.thresholds.statements;
    });

    if (lowCoverageFiles.length > 0) {
      report.push('## ⚠️ Files Below Coverage Threshold');
      report.push('');
      
      lowCoverageFiles.forEach(filePath => {
        const fileData = coverageData[filePath];
        const relativePath = path.relative(process.cwd(), filePath);
        report.push(`- **${relativePath}**: ${fileData.statements.pct}% statements`);
      });
      report.push('');
    }

    // Add recommendations
    report.push('## 📝 Recommendations');
    report.push('');
    
    if (total.statements.pct < this.thresholds.statements) {
      report.push('- 🎯 Focus on increasing statement coverage');
    }
    
    if (total.branches.pct < this.thresholds.branches) {
      report.push('- 🌿 Add tests for conditional branches and edge cases');
    }
    
    if (total.functions.pct < this.thresholds.functions) {
      report.push('- 🔧 Ensure all functions have test coverage');
    }
    
    if (lowCoverageFiles.length > 0) {
      report.push(`- 📁 Priority files for testing: ${lowCoverageFiles.slice(0, 5).map(f => path.basename(f)).join(', ')}`);
    }

    return report.join('\n');
  }

  checkThreshold(metric, actual, threshold) {
    const status = actual >= threshold ? '✅' : '❌';
    return `- ${status} **${metric}**: ${actual}% (threshold: ${threshold}%)`;
  }

  async writeReport(report) {
    // Ensure coverage directory exists
    if (!fs.existsSync(this.coverageDir)) {
      fs.mkdirSync(this.coverageDir, { recursive: true });
    }
    
    fs.writeFileSync(this.reportFile, report);
  }

  validateThresholds(coverageData) {
    const total = coverageData.total;
    const failures = [];

    if (total.statements.pct < this.thresholds.statements) {
      failures.push(`Statements: ${total.statements.pct}% < ${this.thresholds.statements}%`);
    }
    
    if (total.branches.pct < this.thresholds.branches) {
      failures.push(`Branches: ${total.branches.pct}% < ${this.thresholds.branches}%`);
    }
    
    if (total.functions.pct < this.thresholds.functions) {
      failures.push(`Functions: ${total.functions.pct}% < ${this.thresholds.functions}%`);
    }
    
    if (total.lines.pct < this.thresholds.lines) {
      failures.push(`Lines: ${total.lines.pct}% < ${this.thresholds.lines}%`);
    }

    if (failures.length > 0) {
      console.log('\n❌ Coverage thresholds not met:');
      failures.forEach(failure => console.log(`  - ${failure}`));
      
      if (process.env.CI === 'true') {
        console.log('\n💡 In CI environment - failing build due to coverage thresholds');
        process.exit(1);
      } else {
        console.log('\n💡 Run more tests to improve coverage');
      }
    } else {
      console.log('\n✅ All coverage thresholds met!');
    }
  }
}

// Script execution
if (require.main === module) {
  const reporter = new CoverageReporter();
  reporter.generateReport().catch(console.error);
}

module.exports = CoverageReporter;