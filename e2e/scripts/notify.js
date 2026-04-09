import fs from 'fs';
import nodemailer from 'nodemailer';

const RESULTS_FILE = 'playwright-results.json';

// Unified alert address — Gmail filters route by subject tags
const ALERT_EMAIL = process.env.NOTIFY_ALERT_EMAIL;

// Known backend endpoints per test file
const BACKEND_ENDPOINTS = {
  'ai-chat.spec.js': '/api/v1/new-llm-agent/stream',
  'history.spec.js': '/api/v1/new-llm-agent/stream',
  'explore-graph.spec.js': '/api/v1/search/entity-name-search',
  'api-keys.spec.js': '/api/v1/api-keys/create',
};

// Critical test files — failures here escalate to CRITICAL severity
const CRITICAL_FILES = new Set(['ai-chat.spec.js']);

const SEVERITY_COLORS = {
  critical: { bg: '#fde8e8', text: '#c0392b' },
  error:    { bg: '#fef3e2', text: '#d35400' },
  warning:  { bg: '#fefbd8', text: '#b7950b' },
};

const TEAM_LABEL = {
  ops:      'OPS',
  backend:  'BACKEND',
  frontend: 'FRONTEND',
  agent:    'AGENT',
};

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

function classifyFailure(testFile, errorMessage) {
  const isCritical = CRITICAL_FILES.has(testFile);

  if (!errorMessage) return { type: 'unknown', severity: 'warning', recipients: ['ops'] };

  if (errorMessage.includes('/login'))
    return { type: 'auth', severity: 'critical', recipients: ['ops'] };

  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    if (BACKEND_ENDPOINTS[testFile]) {
      if (isCritical)
        return { type: 'backend_timeout', severity: 'critical', recipients: ['backend', 'agent'] };
      return { type: 'backend_timeout', severity: 'error', recipients: ['backend'] };
    }
  }

  if (errorMessage.includes('element(s) not found')) {
    if (isCritical)
      return { type: 'frontend_selector', severity: 'critical', recipients: ['frontend'] };
    return { type: 'frontend_selector', severity: 'error', recipients: ['frontend'] };
  }

  if (errorMessage.includes('Expected') && errorMessage.includes('Received')) {
    if (isCritical)
      return { type: 'frontend_assertion', severity: 'critical', recipients: ['frontend'] };
    return { type: 'frontend_assertion', severity: 'error', recipients: ['frontend'] };
  }

  return { type: 'unknown', severity: 'warning', recipients: ['ops'] };
}

function buildSubject(recipient, severity, failures, runId) {
  const tag = `[${TEAM_LABEL[recipient] || recipient.toUpperCase()}][${severity.toUpperCase()}]`;

  if (recipient === 'ops') {
    const hasAuth = failures.some((f) => f.type === 'auth');
    return hasAuth
      ? `${tag} Auth failure — Playwright tests blocked`
      : `${tag} Playwright test failures — run ${runId}`;
  }
  if (recipient === 'backend') {
    const endpoints = [...new Set(failures.map((f) => BACKEND_ENDPOINTS[f.file]).filter(Boolean))];
    return severity === 'critical'
      ? `${tag} AI Chat backend timeout — ${endpoints.join(', ')}`
      : `${tag} Backend timeout — ${endpoints.join(', ')}`;
  }
  if (recipient === 'agent') {
    return `${tag} AI Chat streaming failure — Playwright`;
  }
  if (recipient === 'frontend') {
    return severity === 'critical'
      ? `${tag} AI Chat frontend regression — Playwright`
      : `${tag} Frontend regression — Playwright tests failed`;
  }
  return `${tag} Playwright test failures — run ${runId}`;
}

function buildEmailHtml(recipient, severity, failures, runId, repo) {
  const logsUrl = `https://github.com/${repo}/actions/runs/${runId}`;
  const sev = SEVERITY_COLORS[severity] || SEVERITY_COLORS.warning;
  const teamLabel = TEAM_LABEL[recipient] || recipient.toUpperCase();
  const now = new Date().toUTCString();

  const rows = failures.map(({ test, file, error, type }) => {
    const firstLine = (error || '').split('\n')[0] || '';
    return `
      <tr>
        <td style="padding:10px;vertical-align:top;color:#333">${escapeHtml(test)}</td>
        <td style="padding:10px;vertical-align:top;color:#555;white-space:nowrap">${escapeHtml(file)}</td>
        <td style="padding:10px;vertical-align:top">
          <span style="font-size:11px;font-weight:bold;color:${sev.text}">${type.toUpperCase()}</span>
          <div style="font-family:monospace;font-size:11px;color:#888;margin-top:3px">${escapeHtml(firstLine)}</div>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:sans-serif">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">

    <div style="padding:24px 28px 18px;border-bottom:1px solid #eee">
      <div>
        <span style="display:inline-block;font-size:11px;font-weight:bold;padding:2px 7px;border-radius:3px;margin-right:4px;background:#e8f0fe;color:#1a56db">${teamLabel}</span>
        <span style="display:inline-block;font-size:11px;font-weight:bold;padding:2px 7px;border-radius:3px;background:${sev.bg};color:${sev.text}">${severity.toUpperCase()}</span>
      </div>
      <div style="font-size:16px;font-weight:600;color:#111;margin:8px 0 0">${escapeHtml(buildSubject(recipient, severity, failures, runId))}</div>
    </div>

    <div style="padding:24px 28px">
      <div style="font-size:13px;color:#555;margin-bottom:20px;line-height:1.6">
        <strong>${failures.length} test${failures.length > 1 ? 's' : ''} failed</strong> in the scheduled Playwright run.<br>
        Time: ${now} &nbsp;·&nbsp; Run: <a href="${logsUrl}" style="color:#1a56db">#${runId}</a>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f7f7f7">
            <th style="text-align:left;padding:8px 10px;color:#666;font-weight:600;border-bottom:2px solid #eee">Test</th>
            <th style="text-align:left;padding:8px 10px;color:#666;font-weight:600;border-bottom:2px solid #eee">File</th>
            <th style="text-align:left;padding:8px 10px;color:#666;font-weight:600;border-bottom:2px solid #eee">Error</th>
          </tr>
        </thead>
        <tbody style="border-bottom:1px solid #f0f0f0">
          ${rows}
        </tbody>
      </table>

      <div style="margin-top:24px;text-align:center">
        <a href="${logsUrl}" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;padding:10px 24px;border-radius:5px;font-size:13px;font-weight:600">View Logs on GitHub Actions</a>
      </div>
    </div>

    <div style="padding:14px 28px;background:#f7f7f7;font-size:11px;color:#aaa;border-top:1px solid #eee">
      GLKB Monitoring · Automated Playwright test run · dev.glkb.org
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(failures, runId, repo) {
  const logsUrl = `https://github.com/${repo}/actions/runs/${runId}`;
  const lines = failures.map(({ test, file, error, type }) =>
    `• [${type.toUpperCase()}] ${file} › ${test}\n  ${(error || '').split('\n')[0]}`
  );
  return `Playwright test failures:\n\n${lines.join('\n\n')}\n\nLogs: ${logsUrl}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendEmail(to, subject, text, html) {
  if (!to) {
    console.log(`Skipping email (no recipient set): ${subject}`);
    return;
  }
  if (process.env.DRY_RUN) {
    const filename = `email-preview-${to.split('@')[0]}-${Date.now()}.html`;
    fs.writeFileSync(filename, html);
    console.log(`[DRY_RUN] Would send to ${to}: ${subject} → ${filename}`);
    return;
  }
  await transporter.sendMail({
    from: `GLKB Monitoring <${process.env.MAIL_USERNAME}>`,
    to,
    subject,
    text,
    html,
  });
  console.log(`Email sent to ${to}: ${subject}`);
}

async function main() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error(`${RESULTS_FILE} not found`);
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const repo = process.env.GITHUB_REPOSITORY || 'unknown/repo';

  // Group failures by recipient:severity
  const groups = {};

  for (const suite of results.suites || []) {
    const file = suite.title.split('/').pop();
    for (const spec of suite.specs || []) {
      const lastResult = spec.tests?.[0]?.results?.at(-1);
      if (!lastResult || lastResult.status === 'passed') continue;

      const errorMessage = lastResult.error?.message || '';
      const { type, severity, recipients } = classifyFailure(file, errorMessage);
      const failure = { test: spec.title, file, error: errorMessage, type, severity };

      for (const recipient of recipients) {
        const key = `${recipient}:${severity}`;
        groups[key] = groups[key] || [];
        groups[key].push(failure);
      }
    }
  }

  // Send one email per (recipient, severity) group
  const promises = Object.entries(groups).map(([key, failures]) => {
    const [recipient, severity] = key.split(':');
    const subject = buildSubject(recipient, severity, failures, runId);
    const text = buildEmailText(failures, runId, repo);
    const html = buildEmailHtml(recipient, severity, failures, runId, repo);
    return sendEmail(ALERT_EMAIL, subject, text, html);
  });

  await Promise.all(promises);
}

main().catch((err) => {
  console.error('notify.js failed:', err);
  process.exit(1);
});
