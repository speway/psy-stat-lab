/**
 * Pure statistical calculation functions for Psy-Stat-Lab.
 *
 * References:
 * - Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences (2nd ed.). Lawrence Erlbaum Associates.
 * - Delacre, M., Lakens, D., & Leys, C. (2017). Why psychologists should by default use Welch's t-test instead of Student's t-test. Frontiers in Psychology, 8, 846.
 * - Faul, F., Erdfelder, E., Lang, A. G., & Buchner, A. (2007). G*Power 3: A flexible statistical power analysis program. Behavior Research Methods, 39(2), 175-191.
 * - Furukawa, T. A., & Leucht, S. (2011). How to obtain NNT from Cohen's d: comparison of two methods. PLoS ONE, 6(4), e19070.
 * - Kraemer, H. C., & Kupfer, D. J. (2006). Size of treatment effects and number needed to treat. Biological Psychiatry, 59(11), 990-996.
 * - Levene, H. (1960). Robust tests for equality of variances. Contributions to Probability and Statistics.
 * - McGraw, K. O., & Wong, S. P. (1992). A common language effect size statistic. Psychological Bulletin, 111(2), 361-365.
 */

/**
 * Deterministic pseudo-random number generator (LCG).
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Standard normal cumulative distribution function (Abramowitz & Stegun 7.1.26 approximation).
 * Max absolute error < 1.5e-7.
 * @param {number} z
 * @returns {number}
 */
export function normalCdf(z) {
  if (z === 0) return 0.5;
  if (z < -8) return 0;
  if (z > 8) return 1;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    sign *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

/**
 * Normal probability density function.
 * @param {number} x
 * @param {number} [mean=0]
 * @param {number} [sd=1]
 * @returns {number}
 */
export function normalPdf(x, mean = 0, sd = 1) {
  if (sd <= 0) return 0;
  const z = (x - mean) / sd;
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

/**
 * Natural log of Gamma function via Lanczos approximation.
 * @param {number} value
 * @returns {number}
 */
export function logGamma(value) {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  let x = 0.9999999999998099;
  const shifted = value - 1;
  for (let i = 0; i < coefficients.length; i++) {
    x += coefficients[i] / (shifted + i + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Continued fraction evaluation for regularized incomplete beta function.
 * @param {number} a
 * @param {number} b
 * @param {number} x
 * @returns {number}
 */
export function betaContinuedFraction(a, b, x) {
  const maxIterations = 140;
  const epsilon = 3e-11;
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

/**
 * Regularized incomplete beta function I_x(a, b).
 * @param {number} x
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/**
 * Student's t two-tailed p-value.
 * @param {number} t
 * @param {number} df
 * @returns {number}
 */
export function studentTPValue(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return 1;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  return regularizedBeta(x, df / 2, 0.5);
}

/**
 * Inverts the Student's t two-tailed p-value to find the critical t value.
 * Uses bounded bisection search with regularized incomplete beta evaluation.
 * @param {number} pTwoTailed - Two-tailed probability (e.g. 0.05)
 * @param {number} df - Degrees of freedom
 * @returns {number} Critical t value >= 0
 */
export function studentTQuantile(pTwoTailed, df) {
  if (!Number.isFinite(df) || df <= 0) return NaN;
  if (pTwoTailed >= 1) return 0;
  if (pTwoTailed <= 0) return Infinity;

  let low = 0;
  let high = 60;
  for (let i = 0; i < 42; i++) {
    const mid = (low + high) / 2;
    const p = studentTPValue(mid, df);
    if (p > pTwoTailed) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/**
 * Computes exact statistical power for the two-sample independent Student's t-test
 * using the non-central t-distribution (integrating over the chi distribution via Simpson's rule).
 *
 * Degrees of freedom: nu = 2 * n - 2
 * Non-centrality parameter: delta = |d| * sqrt(n / 2)
 *
 * @param {number} d - Cohen's d effect size
 * @param {number} n - Sample size per group
 * @param {number} [alpha=0.05] - Significance level
 * @param {boolean} [isTwoTailed=true] - Whether test is two-tailed
 * @returns {number} Exact power in range [alpha, 1.0]
 */
export function computeExactStudentTPower(d, n, alpha = 0.05, isTwoTailed = true) {
  if (!Number.isFinite(n) || n < 2) return alpha;
  if (!Number.isFinite(d) || Math.abs(d) < 1e-4) return alpha;

  const nu = 2 * n - 2;
  const delta = Math.abs(d) * Math.sqrt(n / 2.0);
  const pTarget = isTwoTailed ? alpha : alpha * 2;
  const tCrit = studentTQuantile(pTarget, nu);

  // Integrate over u = sqrt(V / nu), where V ~ chi^2(nu)
  // u has mean ~ 1, sd ~ 1 / sqrt(2 * nu)
  const sdU = 1 / Math.sqrt(2 * nu);
  const uMin = Math.max(0.001, 1 - 5.5 * sdU);
  const uMax = 1 + 5.5 * sdU;

  const N = 120; // 120 Simpson intervals
  const h = (uMax - uMin) / N;

  const logConst =
    Math.log(2) +
    (nu / 2) * Math.log(nu) -
    (nu / 2) * Math.log(2) -
    logGamma(nu / 2);

  let sum = 0;
  for (let i = 0; i <= N; i++) {
    const u = uMin + i * h;
    const w = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;

    const logFu = logConst + (nu - 1) * Math.log(u) - (nu * u * u) / 2;
    const fU = Math.exp(logFu);

    let condPower;
    if (isTwoTailed) {
      condPower = normalCdf(delta - tCrit * u) + normalCdf(-delta - tCrit * u);
    } else {
      condPower = normalCdf(delta - tCrit * u);
    }

    sum += w * condPower * fU;
  }

  const power = sum * (h / 3);
  return Math.min(1.0, Math.max(alpha, power));
}

/**
 * Finds the minimum sample size n per group to achieve the target power
 * under the non-central t-distribution for independent two-sample t-test.
 *
 * @param {number} d - Cohen's d effect size
 * @param {number} targetPower - Target power (e.g. 0.80 or 0.90)
 * @param {number} [alpha=0.05] - Significance level
 * @param {boolean} [isTwoTailed=true] - Whether test is two-tailed
 * @returns {number|null} Minimum sample size per group, or null if d == 0
 */
export function findExactSampleSize(d, targetPower, alpha = 0.05, isTwoTailed = true) {
  if (!Number.isFinite(d) || Math.abs(d) < 1e-4) return null;

  // Use normal approximation for initial lower bound
  const zAlpha = isTwoTailed
    ? alpha <= 0.001 ? 3.2905 : alpha <= 0.01 ? 2.5758 : 1.9600
    : alpha <= 0.001 ? 3.0902 : alpha <= 0.01 ? 2.3263 : 1.6449;
  const zBeta = targetPower >= 0.9 ? 1.2816 : 0.8416;
  const nApprox = Math.max(2, Math.floor(2 * Math.pow((zAlpha + zBeta) / Math.abs(d), 2)));

  // Start slightly below nApprox to guarantee finding the exact minimum integer n
  let n = Math.max(2, nApprox - 10);
  while (computeExactStudentTPower(d, n, alpha, isTwoTailed) < targetPower) {
    n++;
    if (n > 100000) break;
  }
  return n;
}

/**
 * Computes statistical power and required sample size with rigorous non-central t model.
 *
 * Methodological notes:
 * 1. Under H0 (d = 0), true effect is zero. Power is identically equal to alpha (Type I error rate).
 *    Achieving 80% or 90% power is mathematically impossible under H0, so n80 and n90 return null.
 * 2. Power and sample size are computed exactly via non-central t distribution with df = 2n - 2
 *    and non-centrality parameter delta = |d| * sqrt(n / 2) (Cohen, 1988; Faul et al., 2007).
 * 3. NNT is deliberately omitted from continuous effect size playground because converting continuous d
 *    into clinical NNT without specifying the Control Event Rate (CER) is statistically flawed (Furukawa & Leucht, 2011).
 *    Instead, standard distribution-based effect sizes are reported: Cohen's U3, CLES, and Overlap (OVL).
 *
 * @param {{ d: number, n: number, alpha: number, isTwoTailed: boolean }} params
 */
export function computePowerMetrics(params) {
  const { d, n, alpha, isTwoTailed } = params;
  const isZero = Math.abs(d) < 1e-4;

  const nu = Math.max(2, 2 * n - 2);
  const delta = isZero ? 0 : Math.abs(d) * Math.sqrt(n / 2);
  const pTarget = isTwoTailed ? alpha : alpha * 2;
  const tCrit = studentTQuantile(pTarget, nu);

  // Exact power via non-central t distribution
  const power = isZero
    ? alpha
    : computeExactStudentTPower(d, n, alpha, isTwoTailed);

  // Distribution overlap and superiority metrics (Cohen, 1988; McGraw & Wong, 1992)
  const u3 = isZero ? 50.0 : normalCdf(d) * 100;
  const overlap = isZero ? 100.0 : 2 * normalCdf(-Math.abs(d) / 2) * 100;
  const cles = isZero ? 50.0 : normalCdf(d / Math.SQRT2) * 100;

  // Exact sample size required for 80% and 90% power
  const n80 = isZero ? null : findExactSampleSize(d, 0.8, alpha, isTwoTailed);
  const n90 = isZero ? null : findExactSampleSize(d, 0.9, alpha, isTwoTailed);

  return {
    isZero,
    power,
    u3,
    overlap,
    cles,
    n80,
    n90,
    tCrit,
    delta,
    df: nu,
  };
}

/**
 * Computes descriptive statistics for a numeric sample.
 * @param {number[]} sample
 */
export function computeSampleStats(sample) {
  const n = sample.length;
  if (n === 0) {
    return {
      mean: 0,
      variance: 0,
      sd: 0,
      median: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      skewness: 0,
      kurtosis: 0,
      min: 0,
      max: 0,
    };
  }
  const sorted = [...sample].sort((a, b) => a - b);
  const mean = sample.reduce((s, v) => s + v, 0) / n;
  const variance =
    n > 1 ? sample.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  const m3 = sample.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
  const m4 = sample.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
  const skewness = sd > 1e-9 ? m3 / sd ** 3 : 0;
  const kurtosis = sd > 1e-9 ? m4 / sd ** 4 - 3 : 0;

  return {
    mean,
    variance,
    sd,
    median,
    q1,
    q3,
    iqr,
    skewness,
    kurtosis,
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Computes comparative tests between two independent groups.
 * Handles degenerate cases (zero variance) without masking by arbitrary 1e-10 constants.
 * Correctly computes Mann-Whitney U with tie-corrected variance and proper continuity correction.
 *
 * @param {number[]} sample1
 * @param {number[]} sample2
 */
export function computeTwoSampleTests(sample1, sample2) {
  const n1 = sample1.length;
  const n2 = sample2.length;
  const stats1 = computeSampleStats(sample1);
  const stats2 = computeSampleStats(sample2);

  const meanDiff = stats1.mean - stats2.mean;

  // Degrees of freedom
  const dfStudent = Math.max(1, n1 + n2 - 2);

  // Check for zero variance degeneracy
  const bothZeroVariance = stats1.variance <= 1e-12 && stats2.variance <= 1e-12;

  let tStudent = null;
  let pStudent = null;
  let cohenD = null;
  let tWelch = null;
  let dfWelch = null;
  let pWelch = null;
  let hedgesG = null;
  let fLevene = null;
  let df1Levene = 1;
  let df2Levene = dfStudent;
  let pLevene = null;
  let varRatio = null;
  let isDegenerate = false;

  if (bothZeroVariance) {
    // Both groups have zero variance: test is mathematically undefined (0/0 or nonzero/0).
    // Do NOT mask with artificial 1e-10!
    isDegenerate = true;
    tStudent = null;
    pStudent = null;
    cohenD = null;
    tWelch = null;
    dfWelch = null;
    pWelch = null;
    hedgesG = null;
    fLevene = null;
    pLevene = null;
    varRatio = null;
  } else {
    // Student's t
    const pooledVariance =
      dfStudent > 0
        ? ((n1 - 1) * stats1.variance + (n2 - 1) * stats2.variance) / dfStudent
        : 0;
    const seStudent = Math.sqrt(pooledVariance * (1 / n1 + 1 / n2));

    if (seStudent > 1e-12) {
      tStudent = meanDiff / seStudent;
      pStudent = studentTPValue(tStudent, dfStudent);
      const pooledSd = Math.sqrt(pooledVariance);
      cohenD = pooledSd > 1e-12 ? meanDiff / pooledSd : null;
      hedgesG = cohenD !== null ? cohenD * (1 - 3 / (4 * (n1 + n2) - 9)) : null;
    }

    // Welch's t
    const v1 = stats1.variance / n1;
    const v2 = stats2.variance / n2;
    const seWelch = Math.sqrt(v1 + v2);

    if (seWelch > 1e-12) {
      tWelch = meanDiff / seWelch;
      const denomDf =
        (v1 ** 2) / Math.max(1, n1 - 1) + (v2 ** 2) / Math.max(1, n2 - 1);
      dfWelch = denomDf > 1e-12 ? (v1 + v2) ** 2 / denomDf : 1;
      pWelch = studentTPValue(tWelch, dfWelch);
    }

    // Levene's test based on absolute deviations from group means (Levene, 1960)
    const dev1 = sample1.map((v) => Math.abs(v - stats1.mean));
    const dev2 = sample2.map((v) => Math.abs(v - stats2.mean));
    const meanDev1 = dev1.reduce((s, v) => s + v, 0) / n1;
    const meanDev2 = dev2.reduce((s, v) => s + v, 0) / n2;
    const grandMeanDev =
      (dev1.reduce((s, v) => s + v, 0) + dev2.reduce((s, v) => s + v, 0)) / (n1 + n2);
    const ssBetweenDev =
      n1 * (meanDev1 - grandMeanDev) ** 2 + n2 * (meanDev2 - grandMeanDev) ** 2;
    const ssWithinDev =
      dev1.reduce((s, v) => s + (v - meanDev1) ** 2, 0) +
      dev2.reduce((s, v) => s + (v - meanDev2) ** 2, 0);

    const msWithin = ssWithinDev / df2Levene;
    if (msWithin > 1e-12) {
      fLevene = (ssBetweenDev / df1Levene) / msWithin;
      pLevene = regularizedBeta(
        df2Levene / (df2Levene + fLevene),
        df2Levene / 2,
        0.5
      );
    }

    const minVar = Math.min(stats1.variance, stats2.variance);
    const maxVar = Math.max(stats1.variance, stats2.variance);
    varRatio = minVar > 1e-12 ? maxVar / minVar : Infinity;
  }

  // Mann-Whitney U with tie-corrected variance and rigorous continuity correction
  const N = n1 + n2;
  const combined = [
    ...sample1.map((v) => ({ val: v, grp: 1 })),
    ...sample2.map((v) => ({ val: v, grp: 2 })),
  ].sort((a, b) => a.val - b.val);

  let rankSum1 = 0;
  let i = 0;
  const tieCounts = [];
  while (i < N) {
    let j = i;
    while (j < N && combined[j].val === combined[i].val) j++;
    const count = j - i;
    if (count > 1) {
      tieCounts.push(count);
    }
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (combined[k].grp === 1) rankSum1 += avgRank;
    }
    i = j;
  }

  const u1 = rankSum1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const uVal = Math.min(u1, u2);
  const muU = (n1 * n2) / 2;

  // Tie-corrected variance of U
  const tieTerm = tieCounts.reduce((s, t) => s + (t ** 3 - t), 0);
  const denomTie = N * (N - 1);
  const tieCorrection = denomTie > 0 ? tieTerm / denomTie : 0;
  const varU = ((n1 * n2) / 12) * (N + 1 - tieCorrection);
  const sigmaU = Math.sqrt(Math.max(0, varU));

  let zU = 0;
  let pU = 1;
  if (sigmaU <= 1e-12) {
    // All values across both samples are identical (or no rank variability)
    zU = 0;
    pU = 1;
  } else {
    // Standard continuity correction:
    // If uVal < muU, shift towards mean by +0.5
    // If uVal > muU, shift towards mean by -0.5
    // If uVal === muU, deviation is 0, DO NOT artificially shift!
    const diff = uVal - muU;
    let zNum = 0;
    if (diff < -0.5) {
      zNum = diff + 0.5;
    } else if (diff > 0.5) {
      zNum = diff - 0.5;
    } else {
      zNum = 0;
    }
    zU = zNum / sigmaU;
    pU = Math.abs(zU) < 1e-12 ? 1 : Math.min(1, 2 * normalCdf(-Math.abs(zU)));
  }

  const rankBiserial = n1 * n2 > 0 ? 1 - (2 * uVal) / (n1 * n2) : 0;

  return {
    meanDiff,
    isDegenerate,
    tStudent,
    dfStudent,
    pStudent,
    cohenD,
    tWelch,
    dfWelch,
    pWelch,
    hedgesG,
    uVal,
    zU,
    pU,
    rankBiserial,
    fLevene,
    df1Levene,
    df2Levene,
    pLevene,
    varRatio,
  };
}

/**
 * Synthetic sample generator with controllable skewness and outlier injection.
 * @param {number} n
 * @param {number} mean
 * @param {number} sd
 * @param {number} skew
 * @param {number} outliers
 * @param {number} seed
 * @returns {number[]}
 */
export function generateSample(n, mean, sd, skew, outliers, seed) {
  const rand = seededRandom(seed);
  const values = [];

  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rand(), 0.00001);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const shaped = z + skew * ((z * z - 1) / 3.0);
    values.push(mean + shaped * sd);
  }

  for (let i = 0; i < outliers; i++) {
    const targetIdx = Math.floor(rand() * values.length);
    const sign = i % 2 === 0 ? 1 : -1;
    values[targetIdx] = mean + sign * sd * (3.4 + rand() * 1.6);
  }

  return values;
}

/**
 * Formats a numeric value with comma decimal separator.
 * @param {number|null|undefined} val
 * @param {number} [digits=2]
 * @returns {string}
 */
export function fmt(val, digits = 2) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  return val.toFixed(digits).replace('.', ',');
}

/**
 * Formats a p-value:
 * - if p < 0.001 returns '< 0,001'
 * - if p >= 0.001 returns '= X,XXX'
 * - if non-finite/null returns '—'
 * @param {number|null|undefined} p
 * @param {number} [digits=3]
 * @returns {string}
 */
export function fmtP(p, digits = 3) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return '—';
  if (p < 0.001) return '< 0,001';
  return `= ${fmt(p, digits)}`;
}
