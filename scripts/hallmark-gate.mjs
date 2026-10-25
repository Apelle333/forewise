// Validation is deliberately independent of browser/process execution for fault-injection tests.
export const CRITICAL_GATES = new Set([
  '10a',
  '15',
  '26a',
  '27',
  '34',
  '40',
  '41',
  '62',
  '73',
  'kept',
  'render',
]);
export const SHOTS = [
  { tag: '375', width: 375 },
  { tag: '1280x800', width: 1280, height: 800 },
  { tag: '1440x900', width: 1440, height: 900 },
  { tag: '1920x1080', width: 1920, height: 1080 },
  { tag: '1440-full', width: 1440 },
];

export function parseReport(stdout, status) {
  if (![0, 1].includes(status)) throw new Error(`Hallmark process failed (${status}).`);
  const report = JSON.parse(stdout);
  if (!report || !report.summary || !Array.isArray(report.findings))
    throw new Error('Missing or malformed Hallmark report.');
  for (const key of ['fails', 'reflex', 'warns', 'files'])
    if (!Number.isInteger(report.summary[key]) || report.summary[key] < 0)
      throw new Error(`Invalid report summary: ${key}.`);
  for (const f of report.findings)
    if (
      !f ||
      !['gate', 'grade', 'file', 'evidence'].every(
        (k) => typeof f[k] === 'string' && f[k].length > 0,
      ) ||
      !['FAIL', 'REFLEX', 'WARN', 'NOTE', 'WAIVED', 'ANSWERED', 'DISMISSED', 'WAIVER'].includes(
        f.grade,
      )
    )
      throw new Error('Malformed Hallmark finding.');
  for (const [key, grade] of [
    ['fails', 'FAIL'],
    ['reflex', 'REFLEX'],
    ['warns', 'WARN'],
  ])
    if (report.summary[key] !== report.findings.filter((f) => f.grade === grade).length)
      throw new Error(`Incomplete report findings: ${key}.`);
  return report;
}

export function validateRenderedTarget(report, screenshots) {
  if (report.summary.render !== 'ran')
    throw new Error(`Required rendering did not execute: ${report.summary.render ?? 'missing'}`);
  if (!report.summary.files) throw new Error('Rendered audit has no source files.');
  const broken = report.findings.filter(
    (f) =>
      (f.grade === 'FAIL' && CRITICAL_GATES.has(f.gate)) ||
      (f.gate === 'render' && f.grade === 'WARN'),
  );
  if (broken.length) throw new Error(`Critical Hallmark findings: ${JSON.stringify(broken)}`);
  for (const required of SHOTS) {
    const shot = screenshots.find((s) => s.tag === required.tag);
    if (
      !shot ||
      shot.width !== required.width ||
      !Number.isInteger(shot.height) ||
      shot.height < (required.height ?? 800) ||
      (required.height && shot.height !== required.height) ||
      !shot.sha256
    )
      throw new Error(`Missing, malformed or incomplete screenshot: ${required.tag}`);
  }
}

export function requireTargetCoverage(required, results) {
  if (!required.length || new Set(required).size !== required.length)
    throw new Error('Required rendered targets cannot be empty or duplicated.');
  if (
    results.length !== required.length ||
    new Set(results.map((r) => r.target)).size !== required.length
  )
    throw new Error('Incomplete or duplicate rendered target coverage.');
  for (const target of required)
    if (!results.some((r) => r.target === target && r.success === true))
      throw new Error(`Required target did not pass: ${target}`);
}

export function pngDimensions(bytes) {
  if (
    bytes.length < 45 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.toString('ascii', 12, 16) !== 'IHDR' ||
    bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND'
  )
    throw new Error('Missing or malformed PNG screenshot.');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
