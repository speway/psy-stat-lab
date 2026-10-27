import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  normalCdf,
  normalPdf,
  studentTPValue,
  regularizedBeta,
  computePowerMetrics,
  computeSampleStats,
  computeTwoSampleTests,
  generateSample,
  generatePairedSample,
  computePairedSampleTests,
  fmt,
  fmtP,
} from "../app/stat-calc.js";

test("Normal CDF Abramowitz & Stegun approximation accuracy against standards", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6, "Phi(0) must equal 0.5");
  // Z = 1.959964 corresponds to p = 0.975 (alpha = 0.05 two-tailed)
  assert.ok(Math.abs(normalCdf(1.959964) - 0.975) < 1e-4, "Phi(1.96) must be ~0.975");
  // Z = 1.644854 corresponds to p = 0.950 (alpha = 0.05 one-tailed)
  assert.ok(Math.abs(normalCdf(1.644854) - 0.950) < 1e-4, "Phi(1.645) must be ~0.950");
  // Z = 2.575829 corresponds to p = 0.995 (alpha = 0.01 two-tailed)
  assert.ok(Math.abs(normalCdf(2.575829) - 0.995) < 1e-4, "Phi(2.576) must be ~0.995");
  // Symmetry
  assert.ok(Math.abs(normalCdf(-1.959964) - 0.025) < 1e-4, "Phi(-1.96) must be ~0.025");
});

test("Student's t p-value verification against analytical and tabulated benchmarks", () => {
  // df = 60, t = 2.000 -> two-tailed p ~ 0.04997
  const p1 = studentTPValue(2.0, 60);
  assert.ok(Math.abs(p1 - 0.04997) < 0.001, `Expected ~0.050, got ${p1}`);

  // df = 10, t = 2.228 -> two-tailed p ~ 0.0500
  const p2 = studentTPValue(2.228, 10);
  assert.ok(Math.abs(p2 - 0.050) < 0.002, `Expected ~0.050, got ${p2}`);

  // Symmetry: t and -t give same two-tailed p
  assert.equal(studentTPValue(2.5, 30), studentTPValue(-2.5, 30));

  // t = 0 -> p = 1.0
  assert.equal(studentTPValue(0, 50), 1.0);
});

test("Cohen d = 0 edge case: power equals alpha, n80 and n90 are null, no infinite or fake n", () => {
  // 1. Two-tailed, alpha = 0.05
  const res05 = computePowerMetrics({ d: 0, n: 50, alpha: 0.05, isTwoTailed: true });
  assert.equal(res05.isZero, true);
  assert.ok(Math.abs(res05.power - 0.05) < 1e-4, `Under H0 power must be alpha (0.05), got ${res05.power}`);
  assert.equal(res05.n80, null, "For d=0, n80 must be null (unattainable under H0)");
  assert.equal(res05.n90, null, "For d=0, n90 must be null (unattainable under H0)");
  assert.equal(res05.cles, 50.0, "For d=0, CLES must be 50%");
  assert.equal(res05.u3, 50.0, "For d=0, U3 must be 50%");
  assert.equal(res05.overlap, 100.0, "For d=0, overlap must be 100%");

  // 2. Two-tailed, alpha = 0.01
  const res01 = computePowerMetrics({ d: 0, n: 100, alpha: 0.01, isTwoTailed: true });
  assert.ok(Math.abs(res01.power - 0.01) < 1e-4, `Under H0 power must be alpha (0.01), got ${res01.power}`);
  assert.equal(res01.n80, null);
  assert.equal(res01.n90, null);

  // 3. Two-tailed, alpha = 0.001
  const res001 = computePowerMetrics({ d: 0, n: 200, alpha: 0.001, isTwoTailed: true });
  assert.ok(Math.abs(res001.power - 0.001) < 1e-4, `Under H0 power must be alpha (0.001), got ${res001.power}`);
  assert.equal(res001.n80, null);
  assert.equal(res001.n90, null);

  // 4. One-tailed, alpha = 0.05
  const resOne05 = computePowerMetrics({ d: 0, n: 40, alpha: 0.05, isTwoTailed: false });
  assert.ok(Math.abs(resOne05.power - 0.05) < 1e-4, `Under H0 one-tailed power must be alpha (0.05), got ${resOne05.power}`);
  assert.equal(resOne05.n80, null);
  assert.equal(resOne05.n90, null);
});

test("Independent reviewer small-n non-central t benchmarks (d=2, alpha=0.05)", () => {
  // Source: Independent verification benchmark, exact non-central t distribution
  // Parameter: delta = 2 * sqrt(n / 2), df = 2n - 2, alpha = 0.05
  // Tolerance: 5e-4 (0.05%)
  
  // 1. Two-tailed:
  // n = 4 (df=6, delta=2*sqrt(2) ≈ 2.8284): exact power = 0.656876 -> 65.69%
  const p4 = computePowerMetrics({ d: 2.0, n: 4, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(p4.power - 0.656876) < 0.0005, `n=4 expected 65.69%, got ${(p4.power * 100).toFixed(4)}%`);
  assert.equal(p4.n80, 6, "For d=2, minimum n for 80% power must strictly be 6");

  // n = 5 (df=8, delta=2*sqrt(2.5) ≈ 3.1623): exact power = 0.790542 -> 79.05%
  const p5 = computePowerMetrics({ d: 2.0, n: 5, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(p5.power - 0.790542) < 0.0005, `n=5 expected 79.0542%, got ${(p5.power * 100).toFixed(4)}%`);
  assert.equal(p5.n80, 6);
  assert.equal(p5.n90, 7);

  // n = 6 (df=10, delta=2*sqrt(3) ≈ 3.4641): exact power = 0.876418 -> 87.64%
  const p6 = computePowerMetrics({ d: 2.0, n: 6, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(p6.power - 0.876418) < 0.0005, `n=6 expected 87.64%, got ${(p6.power * 100).toFixed(4)}%`);

  // 2. One-tailed:
  // n = 3: exact power = 0.645202 -> 64.52%
  const one3 = computePowerMetrics({ d: 2.0, n: 3, alpha: 0.05, isTwoTailed: false });
  assert.ok(Math.abs(one3.power - 0.645202) < 0.0005, `One-tailed n=3 expected 64.52%, got ${(one3.power * 100).toFixed(4)}%`);
  assert.equal(one3.n80, 4, "One-tailed d=2 n80 must strictly be 4");

  // n = 4: exact power = 0.801534 -> 80.15% (min n for 80% power is 4)
  const one4 = computePowerMetrics({ d: 2.0, n: 4, alpha: 0.05, isTwoTailed: false });
  assert.ok(Math.abs(one4.power - 0.801534) < 0.0005, `One-tailed n=4 expected 80.15%, got ${(one4.power * 100).toFixed(4)}%`);
});

test("G*Power 3 (Faul et al., 2007) and R power.t.test benchmarks across varying n, alpha, and tails", () => {
  // Source: Faul et al. (2007), Behavior Research Methods 39(2), 175-191 & R power.t.test
  // Tolerance: 5e-4
  
  // Point A: Moderate effect d=0.5, n=30, alpha=0.05, two-tailed -> Power = 0.477897 (47.79%)
  const ptA = computePowerMetrics({ d: 0.5, n: 30, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(ptA.power - 0.477897) < 0.0005, `Point A expected 47.79%, got ${(ptA.power * 100).toFixed(4)}%`);

  // Point B: Large effect d=0.8, n=15, alpha=0.05, two-tailed -> Power = 0.561785 (56.18%)
  const ptB = computePowerMetrics({ d: 0.8, n: 15, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(ptB.power - 0.561785) < 0.0005, `Point B expected 56.18%, got ${(ptB.power * 100).toFixed(4)}%`);

  // Point C: One-tailed d=0.6, n=25, alpha=0.05, one-tailed -> Power = 0.672351 (67.24%)
  const ptC = computePowerMetrics({ d: 0.6, n: 25, alpha: 0.05, isTwoTailed: false });
  assert.ok(Math.abs(ptC.power - 0.672351) < 0.0005, `Point C expected 67.24%, got ${(ptC.power * 100).toFixed(4)}%`);
  assert.equal(ptC.n80, 36, "One-tailed d=0.6 n80 must be 36");

  // Point D: Strict alpha = 0.01, d=0.3, n=50, two-tailed -> Power = 0.135455 (13.55%)
  const ptD = computePowerMetrics({ d: 0.3, n: 50, alpha: 0.01, isTwoTailed: true });
  assert.ok(Math.abs(ptD.power - 0.135455) < 0.0005, `Point D expected 13.55%, got ${(ptD.power * 100).toFixed(4)}%`);

  // Point E: Strict alpha = 0.01, d=1.0, n=12, two-tailed -> Power = 0.378492 (37.85%)
  const ptE = computePowerMetrics({ d: 1.0, n: 12, alpha: 0.01, isTwoTailed: true });
  assert.ok(Math.abs(ptE.power - 0.378492) < 0.0005, `Point E expected 37.85%, got ${(ptE.power * 100).toFixed(4)}%`);

  // Point F: Ultra-strict alpha = 0.001, d=0.5, n=20, two-tailed -> Power = 0.034496 (3.45%)
  const ptF = computePowerMetrics({ d: 0.5, n: 20, alpha: 0.001, isTwoTailed: true });
  assert.ok(Math.abs(ptF.power - 0.034496) < 0.0005, `Point F expected 3.45%, got ${(ptF.power * 100).toFixed(4)}%`);
});

test("Cohen (1988) sample size tables for independent t-test (Table 2.4.1, p. 55)", () => {
  // Source: Jacob Cohen (1988). Statistical Power Analysis for the Behavioral Sciences (2nd ed.).
  // Table 2.4.1, p. 55 gives n per group for two-sample t test at alpha = 0.05
  
  // Moderate effect d = 0.5:
  // Cohen Table 2.4.1 gives n = 64 for power = 0.80 and n = 86 for power = 0.90
  const med = computePowerMetrics({ d: 0.5, n: 64, alpha: 0.05, isTwoTailed: true });
  assert.equal(med.n80, 64, "Cohen 1988 exact table: n80 = 64 for d=0.5");
  assert.equal(med.n90, 86, "Cohen 1988 exact table: n90 = 86 for d=0.5");
  assert.ok(med.power >= 0.80, "Power for n=64 must be >= 0.80");

  // Large effect d = 0.8:
  // Cohen Table 2.4.1 gives n = 26 for power = 0.80 and n = 34 for power = 0.90
  const large = computePowerMetrics({ d: 0.8, n: 26, alpha: 0.05, isTwoTailed: true });
  assert.equal(large.n80, 26, "Cohen 1988 exact table: n80 = 26 for d=0.8");
  assert.equal(large.n90, 34, "Cohen 1988 exact table: n90 = 34 for d=0.8");
  assert.ok(large.power >= 0.80, "Power for n=26 must be >= 0.80");

  // Small effect d = 0.2:
  // Cohen Table 2.4.1 gives n = 394 for power = 0.80 and n = 527 for power = 0.90
  const small = computePowerMetrics({ d: 0.2, n: 394, alpha: 0.05, isTwoTailed: true });
  assert.equal(small.n80, 394, "Cohen 1988 exact table: n80 = 394 for d=0.2");
  assert.equal(small.n90, 527, "Cohen 1988 exact table: n90 = 527 for d=0.2");
  assert.ok(small.power >= 0.80, "Power for n=394 must be >= 0.80");

  // One-tailed comparisons from Cohen Table 2.4.1 (a1 = 0.05) & G*Power 3:
  // For d = 0.5: at n=50 power is 79.89%, so minimum integer n for >= 80% is 51 (Cohen lists 50 by 2-digit rounding); at n=69 power is 89.93%, so minimum n for >= 90% is 70 (Cohen lists 69 by rounding)
  const oneMed = computePowerMetrics({ d: 0.5, n: 51, alpha: 0.05, isTwoTailed: false });
  assert.equal(oneMed.n80, 51, "G*Power / exact non-central t: n80 = 51 for one-tailed d=0.5");
  assert.equal(oneMed.n90, 70, "G*Power / exact non-central t: n90 = 70 for one-tailed d=0.5");

  // For d = 0.8, one-tailed n80 = 21, n90 = 28
  const oneLarge = computePowerMetrics({ d: 0.8, n: 21, alpha: 0.05, isTwoTailed: false });
  assert.equal(oneLarge.n80, 21, "Cohen 1988 one-tailed: n80 = 21 for d=0.8");
  assert.equal(oneLarge.n90, 28, "Cohen 1988 one-tailed: n90 = 28 for d=0.8");
});

test("p-value formatting (fmtP) and rendered text verification (no double =)", () => {
  // 1. Exact formatting rules
  assert.equal(fmtP(0.005), "= 0,005", "Standard p-value should include '= ' with comma");
  assert.equal(fmtP(0.018), "= 0,018");
  assert.equal(fmtP(0.0004), "< 0,001", "Values below 0.001 must format as '< 0,001'");
  assert.equal(fmtP(0.0), "< 0,001");
  assert.equal(fmtP(null), "—", "Null p must format as dash");
  assert.equal(fmtP(undefined), "—", "Undefined p must format as dash");
  assert.equal(fmtP(NaN), "—", "NaN p must format as dash");

  // 2. Rendered sentence interpolation (verifying absence of '= = ' or '= <')
  const strLevene = `p Ливиня ${fmtP(0.005)}`;
  assert.equal(strLevene, "p Ливиня = 0,005");
  assert.doesNotMatch(strLevene, /= \s*=/);
  assert.doesNotMatch(strLevene, /= \s*</);

  const strWelch = `t Уэлча (p ${fmtP(0.018)})`;
  assert.equal(strWelch, "t Уэлча (p = 0,018)");
  assert.doesNotMatch(strWelch, /= \s*=/);

  const strMannWhitney = `Манна — Уитни (p ${fmtP(0.0002)})`;
  assert.equal(strMannWhitney, "Манна — Уитни (p < 0,001)");
  assert.doesNotMatch(strMannWhitney, /= \s*</);

  const strDegenerate = `p Ливиня ${fmtP(null)}`;
  assert.equal(strDegenerate, "p Ливиня —");
});

test("UI slider boundaries, mathematical extreme edges, and performance stability", () => {
  // A. Actual UI slider limits (UI defines d in [0.0, 2.0], step 0.05; n in [5, 200], step 5)
  // 1. Lower UI bound: d = 0.0, n = 5 (H0 effect)
  const uiMinD = computePowerMetrics({ d: 0.0, n: 5, alpha: 0.05, isTwoTailed: true });
  assert.equal(uiMinD.power, 0.05, "At d=0 power must strictly be alpha");
  assert.equal(uiMinD.n80, null);
  assert.equal(uiMinD.n90, null);

  // 2. Smallest non-zero UI step with minimum UI sample: d = 0.05, n = 5
  const uiStepMin = computePowerMetrics({ d: 0.05, n: 5, alpha: 0.05, isTwoTailed: true });
  assert.ok(uiStepMin.power >= 0.05 && uiStepMin.power < 0.06, "Power should be ~5.06%");
  assert.ok(uiStepMin.n80 > 6000);

  // 3. Upper UI bound for d with minimum sample: d = 2.0, n = 5 (Independent reviewer benchmark)
  const uiMaxDMinN = computePowerMetrics({ d: 2.0, n: 5, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(uiMaxDMinN.power - 0.790542) < 0.0005, "d=2, n=5 must be 79.0542%");
  assert.equal(uiMaxDMinN.n80, 6);

  // 4. Upper UI bound for sample size: d = 2.0, n = 200
  const uiMaxN = computePowerMetrics({ d: 2.0, n: 200, alpha: 0.05, isTwoTailed: true });
  assert.ok(uiMaxN.power >= 0.9999, "Power for d=2, n=200 must be effectively 1.0");

  // 5. Upper UI sample size with near-zero d: d = 0.05, n = 200
  const uiNearZeroMaxN = computePowerMetrics({ d: 0.05, n: 200, alpha: 0.05, isTwoTailed: true });
  assert.ok(uiNearZeroMaxN.power >= 0.05 && uiNearZeroMaxN.power < 0.10, "Power should be ~7.88%");

  // B. Mathematical edge cases outside the UI sliders
  // Minimum mathematical degrees of freedom (n = 2, df = 2) with large effect d = 2.5
  const mathMinN = computePowerMetrics({ d: 2.5, n: 2, alpha: 0.05, isTwoTailed: true });
  assert.ok(Number.isFinite(mathMinN.power), "Power for n=2 must be finite");
  assert.ok(mathMinN.power > 0.05, "Power for d=2.5, n=2 must exceed alpha");
  assert.equal(mathMinN.n80, 4, "Minimum n for 80% power at d=2.5 is 4");
  assert.equal(mathMinN.n90, 5, "Minimum n for 90% power at d=2.5 is 5");

  // C. Performance and algorithmic stability: exactly 144 evaluations (6 d x 6 n x 2 alpha x 2 tails)
  const t0 = performance.now();
  let evaluations = 0;
  for (const d of [0.1, 0.3, 0.5, 0.8, 1.2, 2.0]) {
    for (const n of [5, 15, 30, 60, 100, 200]) {
      for (const alpha of [0.05, 0.01]) {
        for (const isTwoTailed of [true, false]) {
          const res = computePowerMetrics({ d, n, alpha, isTwoTailed });
          assert.ok(Number.isFinite(res.power));
          assert.ok(res.power >= alpha);
          assert.ok(res.power <= 1.0);
          evaluations++;
        }
      }
    }
  }
  const elapsedMs = performance.now() - t0;
  assert.equal(evaluations, 144, "Must evaluate exactly 144 parameter combinations");
  // Robust CI limit: ensure calculation doesn't hang or exceed 1500ms even under heavy shared CI load
  assert.ok(elapsedMs < 1500, `144 evaluations took ${elapsedMs.toFixed(1)}ms, expected < 1500ms`);
});

test("Distribution-based effect sizes (McGraw & Wong 1992, Cohen 1988 U3 and OVL)", () => {
  // d = 0.5:
  // CLES = Phi(0.5 / sqrt(2)) * 100 = Phi(0.35355) * 100 ~ 63.82%
  // U3 = Phi(0.5) * 100 ~ 69.15%
  // OVL = 2 * Phi(-0.25) * 100 ~ 80.26%
  const m = computePowerMetrics({ d: 0.5, n: 50, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(m.cles - 63.82) < 0.2, `CLES expected ~63.82%, got ${m.cles}`);
  assert.ok(Math.abs(m.u3 - 69.15) < 0.2, `U3 expected ~69.15%, got ${m.u3}`);
  assert.ok(Math.abs(m.overlap - 80.26) < 0.2, `OVL expected ~80.26%, got ${m.overlap}`);

  // d = 0.8:
  // CLES = Phi(0.8 / sqrt(2)) * 100 ~ 71.42%
  // U3 = Phi(0.8) * 100 ~ 78.81%
  // OVL = 2 * Phi(-0.4) * 100 ~ 68.92%
  const l = computePowerMetrics({ d: 0.8, n: 30, alpha: 0.05, isTwoTailed: true });
  assert.ok(Math.abs(l.cles - 71.42) < 0.2);
  assert.ok(Math.abs(l.u3 - 78.81) < 0.2);
  assert.ok(Math.abs(l.overlap - 68.92) < 0.2);
});

test("Mann-Whitney U: ties, identical samples, and U = mu_U (no artificial p ≈ 0.917)", () => {
  // 1. Identical constant samples: all values identical across both groups
  const c1 = [5, 5, 5, 5, 5];
  const c2 = [5, 5, 5, 5, 5];
  const resConst = computeTwoSampleTests(c1, c2);
  assert.equal(resConst.uVal, 12.5, "U must equal n1*n2/2 = 12.5");
  assert.equal(resConst.zU, 0, "Z must be 0 for identical groups");
  assert.equal(resConst.pU, 1.0, "p must be exactly 1.0, NOT artificial 0.917!");
  assert.notEqual(Math.round(resConst.pU * 1000) / 1000, 0.917, "Must NOT produce p ≈ 0.917 artifact!");
  assert.equal(resConst.rankBiserial, 0.0);

  // 2. Identical distributed samples: s1 == s2
  const d1 = [1, 2, 3, 4, 5];
  const d2 = [1, 2, 3, 4, 5];
  const resDist = computeTwoSampleTests(d1, d2);
  assert.equal(resDist.uVal, 12.5);
  assert.equal(resDist.zU, 0);
  assert.equal(resDist.pU, 1.0, "Identical samples must yield p = 1.0, NOT 0.917!");
  assert.notEqual(Math.round(resDist.pU * 1000) / 1000, 0.917);

  // 3. Tied ranks with actual between-group difference
  const s1 = [1, 2, 2, 3];
  const s2 = [2, 3, 3, 4];
  const resTied = computeTwoSampleTests(s1, s2);
  assert.ok(Number.isFinite(resTied.uVal));
  assert.ok(Number.isFinite(resTied.zU));
  assert.ok(resTied.pU > 0 && resTied.pU < 1);
  assert.ok(resTied.rankBiserial > 0);

  // 4. Non-overlapping groups
  const sLow = [1, 2, 3, 4, 5];
  const sHigh = [10, 20, 30, 40, 50];
  const resSeparated = computeTwoSampleTests(sLow, sHigh);
  assert.equal(resSeparated.uVal, 0, "Non-overlapping groups must yield U = 0");
  assert.equal(resSeparated.rankBiserial, 1.0, "Rank-biserial correlation must be 1.0 for completely separated groups");
});

test("Degenerate variances (Zero variance): explicit inapplicability, no 1e-10 masking", () => {
  // Case A: Identical constant values in both groups
  const zeroVar1 = [5, 5, 5, 5, 5];
  const zeroVar2 = [5, 5, 5, 5, 5];
  const resZero = computeTwoSampleTests(zeroVar1, zeroVar2);
  assert.equal(resZero.isDegenerate, true);
  assert.equal(resZero.tStudent, null, "tStudent must be null for zero variance, NOT 0 or 1e10");
  assert.equal(resZero.pStudent, null);
  assert.equal(resZero.cohenD, null);
  assert.equal(resZero.tWelch, null);
  assert.equal(resZero.pWelch, null);
  assert.equal(resZero.fLevene, null);
  assert.equal(resZero.pLevene, null);
  assert.equal(resZero.varRatio, null);

  // Case B: Different constants in both groups (meanDiff != 0, but both s = 0)
  const diffConst1 = [5, 5, 5, 5];
  const diffConst2 = [10, 10, 10, 10];
  const resDiffConst = computeTwoSampleTests(diffConst1, diffConst2);
  assert.equal(resDiffConst.isDegenerate, true);
  assert.equal(resDiffConst.tStudent, null, "Must NOT calculate fictitious t = -5e10 using 1e-10 denominator!");
  assert.equal(resDiffConst.tWelch, null);
  assert.equal(resDiffConst.fLevene, null);
});

test("Two-sample comparison tests: Welch df vs Student df under heteroscedasticity", () => {
  // Equal variances (n1 = 30, n2 = 30)
  const g1Equal = [10, 11, 12, 10, 9, 11, 10, 12, 9, 11, 10, 12, 10, 11, 9, 10, 11, 12, 10, 9, 11, 10, 12, 9, 11, 10, 12, 10, 11, 9];
  const g2Equal = [14, 15, 16, 14, 13, 15, 14, 16, 13, 15, 14, 16, 14, 15, 13, 14, 15, 16, 14, 13, 15, 14, 16, 13, 15, 14, 16, 14, 15, 13];
  const resEqual = computeTwoSampleTests(g1Equal, g2Equal);
  assert.equal(resEqual.isDegenerate, false);
  assert.equal(resEqual.dfStudent, 58);
  assert.ok(Math.abs(resEqual.dfWelch - 58) < 1.0, `Welch df under equal variances should be ~58, got ${resEqual.dfWelch}`);
  assert.ok(resEqual.pLevene > 0.05, `Levene test must retain H0 (p > 0.05), got p = ${resEqual.pLevene}`);

  // Severe heteroscedasticity (SD ~ 0.14 vs SD ~ 7.3)
  const g1LowVar = [10, 10.1, 9.9, 10.2, 9.8, 10.0, 10.1, 9.9, 10.2, 9.8];
  const g2HighVar = [5, 18, 3, 22, 6, 19, 4, 21, 7, 20];
  const resHetero = computeTwoSampleTests(g1LowVar, g2HighVar);
  assert.equal(resHetero.isDegenerate, false);
  assert.ok(resHetero.varRatio > 50, `Variance ratio must be huge, got ${resHetero.varRatio}`);
  assert.ok(resHetero.pLevene < 0.01, `Levene test must reject H0 (p < 0.01), got p = ${resHetero.pLevene}`);
  assert.ok(resHetero.dfWelch < resHetero.dfStudent, "Welch df must adjust downward under heteroscedasticity");
});

test("Static source verification: native radio markup, group associations, and absence of aria-pressed", () => {
  // Static check of StatSandbox component source code
  const sandboxSrc = fs.readFileSync(path.resolve("app/StatSandbox.tsx"), "utf8");

  // A. Native <input type="radio"> elements present
  assert.ok(
    sandboxSrc.includes('type="radio"'),
    'Component must use native <input type="radio"> elements'
  );
  assert.ok(
    sandboxSrc.includes('name="power-alpha"'),
    "Alpha radios must belong to group 'power-alpha'"
  );
  assert.ok(
    sandboxSrc.includes('name="power-direction"'),
    "Direction radios must belong to group 'power-direction'"
  );

  // B. Fieldset and legend semantic grouping
  assert.ok(
    sandboxSrc.includes('<fieldset className="segmented-control">'),
    "Must wrap segmented groups in semantic <fieldset>"
  );
  assert.ok(
    sandboxSrc.includes('<legend className="segmented-legend">'),
    "Must provide accessible label via <legend>"
  );

  // C. Labels properly linked via htmlFor and id
  assert.ok(
    sandboxSrc.includes('power-alpha-') && sandboxSrc.includes('htmlFor='),
    "Labels must be associated with inputs via htmlFor"
  );
  assert.ok(
    sandboxSrc.includes('id=') && sandboxSrc.includes('power-alpha-'),
    "Inputs must have matching ids"
  );
  assert.ok(
    sandboxSrc.includes('htmlFor="power-direction-two-tailed"'),
    "Two-tailed direction label must be linked"
  );
  assert.ok(
    sandboxSrc.includes('htmlFor="power-direction-one-tailed"'),
    "One-tailed direction label must be linked"
  );

  // D. Invalid aria-pressed attribute must NOT exist on radio elements
  assert.doesNotMatch(
    sandboxSrc,
    /type="radio"[^>]*aria-pressed/,
    "Radio inputs must never have invalid aria-pressed attribute"
  );
  assert.doesNotMatch(
    sandboxSrc,
    /role="radio"[^>]*aria-pressed/,
    "Radio elements must never have invalid aria-pressed attribute"
  );

  // E. Verify keyboard handler bindings in JSX
  assert.ok(
    sandboxSrc.includes('onKeyDown={(e) => handleAlphaKeyDown(e, alphaVal)}'),
    "Alpha radios must bind handleAlphaKeyDown"
  );
  assert.ok(
    sandboxSrc.includes('handleDirectionKeyDown(e, true)'),
    "Two-tailed radio must bind handleDirectionKeyDown"
  );
  assert.ok(
    sandboxSrc.includes('handleDirectionKeyDown(e, false)'),
    "One-tailed radio must bind handleDirectionKeyDown"
  );
});

test("Paired samples t-test: analytical benchmarks, df, SE, p-value, and confidence interval", () => {
  // Benchmark with known analytical data:
  // 5 pairs: Before = [10, 12, 14, 16, 18], After = [14, 17, 19, 21, 24]
  // Diff D = After - Before = [4, 5, 5, 5, 6]
  // Sum D = 25, Mean D = 5.0
  // Deviations: [-1, 0, 0, 0, 1], Sum sq dev = 2
  // Variance s_D^2 = 2 / 4 = 0.5
  // SD s_D = sqrt(0.5) = 0.70710678
  // SE_D = s_D / sqrt(5) = sqrt(0.1) = 0.316227766
  // t = 5.0 / 0.316227766 = 15.8113883
  // df = 4
  const testPairs = [
    { id: 1, before: 10, after: 14, diff: 4 },
    { id: 2, before: 12, after: 17, diff: 5 },
    { id: 3, before: 14, after: 19, diff: 5 },
    { id: 4, before: 16, after: 21, diff: 5 },
    { id: 5, before: 18, after: 24, diff: 6 },
  ];

  const res = computePairedSampleTests(testPairs);
  assert.equal(res.n, 5);
  assert.equal(res.df, 4);
  assert.equal(res.isDegenerate, false);
  assert.ok(Math.abs(res.meanDiff - 5.0) < 1e-9, "Mean diff must equal 5.0");
  assert.ok(Math.abs(res.sdDiff - Math.sqrt(0.5)) < 1e-6, "SD of diff must equal sqrt(0.5)");
  assert.ok(Math.abs(res.seDiff - Math.sqrt(0.1)) < 1e-6, "SE of diff must equal sqrt(0.1)");
  assert.ok(Math.abs(res.tVal - Math.sqrt(250)) < 1e-4, "t must equal sqrt(250) ~ 15.8114");
  assert.ok(res.pVal < 0.0001, "p-value must be < 0.0001");

  // Critical t for df=4, alpha=0.05 two-tailed is ~ 2.7764451
  // Margin of error = 2.7764451 * 0.316227766 ~ 0.87799
  // CI = [5.0 - 0.878, 5.0 + 0.878] = [4.122, 5.878]
  assert.ok(Math.abs(res.ciLower - 4.122) < 0.02, "Expected CI lower ~ 4.122, got " + res.ciLower);
  assert.ok(Math.abs(res.ciUpper - 5.878) < 0.02, "Expected CI upper ~ 5.878, got " + res.ciUpper);

  // Cohen's d_z = meanDiff / sdDiff = 5.0 / 0.70710678 = 7.071
  assert.ok(Math.abs(res.cohenDz - 7.071) < 0.01, "Expected Cohen's dz ~ 7.071, got " + res.cohenDz);
});

test("Paired samples degenerate case (zero variance): s_D = 0 produces explicit inapplicability", () => {
  // All participants changed by exactly 3.0 points
  const constPairs = [
    { id: 1, before: 10, after: 13, diff: 3 },
    { id: 2, before: 20, after: 23, diff: 3 },
    { id: 3, before: 30, after: 33, diff: 3 },
    { id: 4, before: 40, after: 43, diff: 3 },
  ];

  const res = computePairedSampleTests(constPairs);
  assert.equal(res.isDegenerate, true, "Must flag isDegenerate = true");
  assert.equal(res.tVal, null, "tVal must be null when SE = 0");
  assert.equal(res.pVal, null, "pVal must be null when SE = 0");
  assert.equal(res.sdDiff, 0, "sdDiff must equal 0");
  assert.equal(res.seDiff, 0, "seDiff must equal 0");
  assert.equal(res.ciLower, 3, "Lower CI matches constant diff");
  assert.equal(res.ciUpper, 3, "Upper CI matches constant diff");
});

test("Paired samples generator and independent contrast: SE reduction via correlation", () => {
  // When correlation r is high (e.g. 0.80), SE_paired is reduced by ~ 1 - sqrt(1 - r) = 1 - sqrt(0.2) ~ 55%
  const sample = generatePairedSample({
    n: 60,
    mBase: 50,
    meanDiff: -5,
    sdBase: 10,
    r: 0.80,
    seed: 12345,
  });

  assert.equal(sample.length, 60);
  const tests = computePairedSampleTests(sample);
  assert.equal(tests.isDegenerate, false);
  assert.ok(tests.r > 0.65, "Empirical correlation must be high, got " + tests.r);
  assert.ok(tests.independentContrast !== null);
  assert.ok(tests.independentContrast.seReductionPct > 40, "SE reduction must exceed 40% with r ~ 0.80");
  assert.ok(tests.seDiff < tests.independentContrast.seIndep, "SE paired must be lower than SE independent");
});
