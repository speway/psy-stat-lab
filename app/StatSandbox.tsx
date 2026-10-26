"use client";

import { useState, useMemo, useId } from "react";
import type { CSSProperties } from "react";

// --- Mathematical helpers ---

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalCdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
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

function normalPdf(x: number, mean = 0, sd = 1): number {
  const z = (x - mean) / sd;
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

// Log-gamma function
function logGamma(value: number): number {
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

// Regularized incomplete beta function via continued fraction
function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 120;
  const epsilon = 3e-10;
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

function regularizedBeta(x: number, a: number, b: number): number {
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

// Student's t two-tailed p-value
function studentTPValue(t: number, df: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return 1;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  return regularizedBeta(x, df / 2, 0.5);
}

// Generate sample with controllable skewness and outliers
function generateSample(
  n: number,
  mean: number,
  sd: number,
  skew: number,
  outliers: number,
  seed: number
): number[] {
  const rand = seededRandom(seed);
  const values: number[] = [];

  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rand(), 0.00001);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Skew polynomial transform
    const shaped = z + skew * ((z * z - 1) / 3.0);
    values.push(mean + shaped * sd);
  }

  // Inject outliers
  for (let i = 0; i < outliers; i++) {
    const targetIdx = Math.floor(rand() * values.length);
    const sign = i % 2 === 0 ? 1 : -1;
    values[targetIdx] = mean + sign * sd * (3.4 + rand() * 1.6);
  }

  return values;
}

function calcStats(data: number[]) {
  const n = data.length;
  if (n === 0) return { mean: 0, median: 0, sd: 0, variance: 0, min: 0, max: 0, q1: 0, q3: 0, iqr: 0, skewness: 0 };
  const sorted = [...data].sort((a, b) => a - b);
  const mean = data.reduce((s, v) => s + v, 0) / n;
  const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1);
  const sd = Math.sqrt(variance);

  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  // Pearson skewness approximation (M - Med)/SD * 3 or sample moment
  const m3 = data.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
  const skewness = sd > 0 ? m3 / (sd ** 3) : 0;

  return {
    mean,
    median,
    sd,
    variance,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1,
    q3,
    iqr,
    skewness,
  };
}

// Format number with comma
function fmt(val: number, digits = 2): string {
  if (!Number.isFinite(val)) return "—";
  return val.toFixed(digits).replace(".", ",");
}

function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0,001";
  return `= ${fmt(p, 3)}`;
}

// Preset psychological scenarios for dual sample testing
interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  n1: number;
  m1: number;
  sd1: number;
  skew1: number;
  outliers1: number;
  n2: number;
  m2: number;
  sd2: number;
  skew2: number;
  outliers2: number;
  notes: string;
}

const scenarioPresets: ScenarioPreset[] = [
  {
    id: "cbt-vs-waitlist",
    name: "КПТ депрессии vs Лист ожидания",
    description: "Шкала BDI-II (0-63). Клиническая группа КПТ показывает снижение баллов, нормальное распределение без выбросов.",
    n1: 35,
    m1: 18.5,
    sd1: 6.2,
    skew1: 0,
    outliers1: 0,
    n2: 35,
    m2: 27.8,
    sd2: 7.1,
    skew2: 0.1,
    outliers2: 0,
    notes: "Идеальные условия для классического t Стьюдента: одинаковые размеры групп, близкие дисперсии, нормальность соблюдена.",
  },
  {
    id: "students-anxiety",
    name: "Тревожность: Очники vs Заочники",
    description: "Шкала STAI. Заочники учатся в цейтноте и имеют выраженную правостороннюю асимметрию и экстремальные выбросы.",
    n1: 60,
    m1: 38.2,
    sd1: 5.8,
    skew1: 0.2,
    outliers1: 0,
    n2: 32,
    m2: 44.7,
    sd2: 12.4,
    skew2: 1.2,
    outliers2: 4,
    notes: "Нарушены гомогенность дисперсий (SD 5.8 vs 12.4) и нормальность. Классический t Стьюдента занижает p; тест Уэлча и U Манна-Уитни надёжнее.",
  },
  {
    id: "reaction-time",
    name: "Время реакции: Молодые vs Пожилые",
    description: "Когнитивный сенсомоторный тест (мс). Логнормальное распределение с длинным правым хвостом у пожилых.",
    n1: 45,
    m1: 290,
    sd1: 35,
    skew1: 0.4,
    outliers1: 1,
    n2: 40,
    m2: 380,
    sd2: 75,
    skew2: 1.4,
    outliers2: 3,
    notes: "Резкая гетерогенность дисперсий. В психофизиологии данные часто логарифмируют или применяют критерий Манна-Уитни.",
  },
  {
    id: "burnout-teachers",
    name: "Выгорание: Начинающие vs Опытные учителя",
    description: "Шкала MBI (редукция личных достижений). У опытных педагогов наблюдается потолочный эффект (ceiling effect).",
    n1: 28,
    m1: 24.1,
    sd1: 8.5,
    skew1: -0.8,
    outliers1: 1,
    n2: 26,
    m2: 31.9,
    sd2: 5.2,
    skew2: -1.3,
    outliers2: 2,
    notes: "Левосторонняя асимметрия из-за потолка шкалы. Сравните медианы и ранговый показатель U Манна-Уитни.",
  },
];

export default function StatSandbox() {
  const [activeTab, setActiveTab] = useState<"dual" | "power" | "correlation" | "psychometrics">("dual");

  // --- TAB 1: DUAL SAMPLE STATE ---
  const [n1, setN1] = useState(35);
  const [m1, setM1] = useState(48);
  const [sd1, setSd1] = useState(8);
  const [skew1, setSkew1] = useState(0);
  const [outliers1, setOutliers1] = useState(0);

  const [n2, setN2] = useState(35);
  const [m2, setM2] = useState(54);
  const [sd2, setSd2] = useState(12);
  const [skew2, setSkew2] = useState(0.4);
  const [outliers2, setOutliers2] = useState(1);

  const [dualSeed, setDualSeed] = useState(42);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Apply preset
  const applyPreset = (preset: ScenarioPreset) => {
    setActivePreset(preset.id);
    setN1(preset.n1);
    setM1(preset.m1);
    setSd1(preset.sd1);
    setSkew1(preset.skew1);
    setOutliers1(preset.outliers1);

    setN2(preset.n2);
    setM2(preset.m2);
    setSd2(preset.sd2);
    setSkew2(preset.skew2);
    setOutliers2(preset.outliers2);
    setDualSeed((s) => s + 1);
  };

  // Generate samples
  const sample1 = useMemo(
    () => generateSample(n1, m1, sd1, skew1, outliers1, dualSeed),
    [n1, m1, sd1, skew1, outliers1, dualSeed]
  );
  const sample2 = useMemo(
    () => generateSample(n2, m2, sd2, skew2, outliers2, dualSeed + 999),
    [n2, m2, sd2, skew2, outliers2, dualSeed]
  );

  const stats1 = useMemo(() => calcStats(sample1), [sample1]);
  const stats2 = useMemo(() => calcStats(sample2), [sample2]);

  // Comparative tests
  const testResults = useMemo(() => {
    const meanDiff = stats1.mean - stats2.mean;

    // Student's t
    const pooledVariance =
      ((n1 - 1) * stats1.variance + (n2 - 1) * stats2.variance) / (n1 + n2 - 2);
    const seStudent = Math.sqrt(pooledVariance * (1 / n1 + 1 / n2));
    const tStudent = meanDiff / (seStudent || 1e-10);
    const dfStudent = n1 + n2 - 2;
    const pStudent = studentTPValue(tStudent, dfStudent);
    const cohenD = meanDiff / (Math.sqrt(pooledVariance) || 1e-10);

    // Welch's t
    const v1 = stats1.variance / n1;
    const v2 = stats2.variance / n2;
    const seWelch = Math.sqrt(v1 + v2);
    const tWelch = meanDiff / (seWelch || 1e-10);
    const dfWelch = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1) || 1);
    const pWelch = studentTPValue(tWelch, dfWelch);
    const hedgesG = cohenD * (1 - 3 / (4 * (n1 + n2) - 9));

    // Mann-Whitney U
    const combined = [
      ...sample1.map((v) => ({ val: v, grp: 1 })),
      ...sample2.map((v) => ({ val: v, grp: 2 })),
    ].sort((a, b) => a.val - b.val);

    // Assign ranks with tie handling
    let rankSum1 = 0;
    let i = 0;
    while (i < combined.length) {
      let j = i;
      while (j < combined.length && combined[j].val === combined[i].val) j++;
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
    const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const zU = (uVal - muU + 0.5) / (sigmaU || 1);
    const pU = 2 * normalCdf(-Math.abs(zU));
    const rankBiserial = 1 - (2 * uVal) / (n1 * n2);

    // Levene test approximation on absolute deviations from mean
    const dev1 = sample1.map((v) => Math.abs(v - stats1.mean));
    const dev2 = sample2.map((v) => Math.abs(v - stats2.mean));
    const meanDev1 = dev1.reduce((s, v) => s + v, 0) / n1;
    const meanDev2 = dev2.reduce((s, v) => s + v, 0) / n2;
    const grandMeanDev = (dev1.reduce((s, v) => s + v, 0) + dev2.reduce((s, v) => s + v, 0)) / (n1 + n2);
    const ssBetweenDev = n1 * (meanDev1 - grandMeanDev) ** 2 + n2 * (meanDev2 - grandMeanDev) ** 2;
    const ssWithinDev =
      dev1.reduce((s, v) => s + (v - meanDev1) ** 2, 0) +
      dev2.reduce((s, v) => s + (v - meanDev2) ** 2, 0);
    const fLevene = (ssBetweenDev / 1) / (ssWithinDev / (n1 + n2 - 2) || 1);
    const pLevene = regularizedBeta((n1 + n2 - 2) / (n1 + n2 - 2 + fLevene), (n1 + n2 - 2) / 2, 0.5);

    // Ratio of variances
    const varRatio = Math.max(stats1.variance, stats2.variance) / (Math.min(stats1.variance, stats2.variance) || 1e-5);

    return {
      meanDiff,
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
      pLevene,
      varRatio,
    };
  }, [sample1, sample2, stats1, stats2, n1, n2]);

  // Export CSV
  const handleExportCsv = () => {
    let csv = "group,subject_id,value\n";
    sample1.forEach((v, idx) => {
      csv += `group_1,G1_${idx + 1},${v.toFixed(3)}\n`;
    });
    sample2.forEach((v, idx) => {
      csv += `group_2,G2_${idx + 1},${v.toFixed(3)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `statlab_samples_${n1}vs${n2}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy SPSS Syntax
  const [spssCopied, setSpssCopied] = useState(false);
  const copySpssSyntax = () => {
    const syntax = `* Анализ двух независимых выборок в SPSS.
* 1. Проверка нормальности и описательные статистики:
EXAMINE VARIABLES=value BY group
  /PLOT BOXPLOT STEMLEAF NPPLOT
  /STATISTICS DESCRIPTIVES
  /CINTERVAL 95.

* 2. t-критерий Стьюдента и тест Ливиня:
T-TEST GROUPS=group(1 2)
  /MISSING=ANALYSIS
  /VARIABLES=value
  /ES DISPLAY(TRUE)
  /CRITERIA=CI(.95).

* 3. Непараметрический U-критерий Манна — Уитни:
NPAR TESTS
  /M-W= value BY group(1 2)
  /MISSING ANALYSIS.`;
    navigator.clipboard.writeText(syntax);
    setSpssCopied(true);
    setTimeout(() => setSpssCopied(false), 2000);
  };

  // --- TAB 2: POWER & EFFECT SIZE STATE ---
  const [cohenDInput, setCohenDInput] = useState(0.5);
  const [powerN, setPowerN] = useState(45);
  const [powerAlpha, setPowerAlpha] = useState(0.05);
  const [isTwoTailed, setIsTwoTailed] = useState(true);

  const powerMetrics = useMemo(() => {
    const d = cohenDInput;
    const n = powerN;
    const zCrit = isTwoTailed
      ? powerAlpha === 0.001
        ? 3.291
        : powerAlpha === 0.01
        ? 2.576
        : 1.96
      : powerAlpha === 0.001
      ? 3.09
      : powerAlpha === 0.01
      ? 2.326
      : 1.645;

    const delta = d * Math.sqrt(n / 2);
    const power = isTwoTailed
      ? normalCdf(delta - zCrit) + normalCdf(-delta - zCrit)
      : normalCdf(delta - zCrit);

    const u3 = normalCdf(d) * 100;
    const overlap = 2 * normalCdf(-d / 2) * 100;
    const cles = normalCdf(d / Math.sqrt(2)) * 100;
    const nnt = d > 0.01 ? 1 / (2 * normalCdf(d / Math.sqrt(2)) - 1) : Infinity;

    // Sample size for 80% power at alpha=0.05
    const zBeta80 = 0.8416;
    const n80 = Math.ceil(2 * ((zCrit + zBeta80) / (d || 0.05)) ** 2);
    const zBeta90 = 1.2816;
    const n90 = Math.ceil(2 * ((zCrit + zBeta90) / (d || 0.05)) ** 2);

    return {
      power: Math.max(0.01, Math.min(0.999, power)),
      u3,
      overlap,
      cles,
      nnt,
      n80,
      n90,
    };
  }, [cohenDInput, powerN, powerAlpha, isTwoTailed]);

  // --- TAB 3: CORRELATION & OUTLIER LAB STATE ---
  const [trueR, setTrueR] = useState(0.65);
  const [corrN, setCorrN] = useState(40);
  const [nonLinearity, setNonLinearity] = useState(0);
  const [hasOutlier, setHasOutlier] = useState(true);
  const [outlierX, setOutlierX] = useState(2.8);
  const [outlierY, setOutlierY] = useState(-2.4);
  const [corrSeed, setCorrSeed] = useState(101);

  const corrPoints = useMemo(() => {
    const rand = seededRandom(corrSeed);
    const pts: { x: number; y: number; isOutlier?: boolean }[] = [];
    const r = trueR;

    for (let i = 0; i < corrN; i++) {
      const u1 = Math.max(rand(), 0.0001);
      const u2 = rand();
      const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      const u3 = Math.max(rand(), 0.0001);
      const u4 = rand();
      const zNoise = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);

      let y = r * z1 + Math.sqrt(Math.max(0, 1 - r * r)) * zNoise;

      // Add non-linear quadratic shape if requested
      if (nonLinearity > 0) {
        y += nonLinearity * (z1 * z1 - 1) * 0.8;
      }

      pts.push({ x: z1, y });
    }

    if (hasOutlier) {
      pts.push({ x: outlierX, y: outlierY, isOutlier: true });
    }

    return pts;
  }, [trueR, corrN, nonLinearity, hasOutlier, outlierX, outlierY, corrSeed]);

  const corrStats = useMemo(() => {
    const n = corrPoints.length;
    const meanX = corrPoints.reduce((s, p) => s + p.x, 0) / n;
    const meanY = corrPoints.reduce((s, p) => s + p.y, 0) / n;

    let sxx = 0,
      syy = 0,
      sxy = 0;
    corrPoints.forEach((p) => {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    });

    const pearsonR = sxy / (Math.sqrt(sxx * syy) || 1e-10);
    const tPearson = (pearsonR * Math.sqrt(n - 2)) / Math.sqrt(Math.max(0.0001, 1 - pearsonR * pearsonR));
    const pPearson = studentTPValue(tPearson, n - 2);

    // Spearman Rho
    const rankX = [...corrPoints].sort((a, b) => a.x - b.x).map((p, idx) => ({ ...p, rx: idx + 1 }));
    const rankXY = [...rankX].sort((a, b) => a.y - b.y).map((p, idx) => ({ ...p, ry: idx + 1 }));
    let dSqSum = 0;
    rankXY.forEach((p) => {
      dSqSum += (p.rx - p.ry) ** 2;
    });
    const spearmanRho = 1 - (6 * dSqSum) / (n * (n * n - 1));
    const tSpearman = (spearmanRho * Math.sqrt(n - 2)) / Math.sqrt(Math.max(0.0001, 1 - spearmanRho * spearmanRho));
    const pSpearman = studentTPValue(tSpearman, n - 2);

    // OLS slope & intercept
    const slope = sxy / (sxx || 1e-10);
    const intercept = meanY - slope * meanX;

    // Cook's distance for outlier if present
    let cookDist = 0;
    if (hasOutlier) {
      const lastPt = corrPoints[corrPoints.length - 1];
      const e = lastPt.y - (intercept + slope * lastPt.x);
      const h = 1 / n + ((lastPt.x - meanX) ** 2) / (sxx || 1e-10);
      const sse = corrPoints.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
      const mse = sse / (n - 2 || 1);
      cookDist = (e ** 2 / (2 * mse)) * (h / ((1 - h) ** 2 || 1));
    }

    return {
      pearsonR,
      pPearson,
      spearmanRho,
      pSpearman,
      slope,
      intercept,
      cookDist,
      rSquared: pearsonR * pearsonR,
    };
  }, [corrPoints, hasOutlier]);

  // --- TAB 4: PSYCHOMETRICS SURGERY STATE ---
  interface ScaleItem {
    id: number;
    text: string;
    loading: number;
    reverse: boolean;
    active: boolean;
  }

  const [scaleItemsList, setScaleItemsList] = useState<ScaleItem[]>([
    { id: 1, text: "Легко справляюсь со сложными задачами", loading: 0.74, reverse: false, active: true },
    { id: 2, text: "Уверен в своей способности учиться новому", loading: 0.78, reverse: false, active: true },
    { id: 3, text: "Теряю мотивацию при первых же ошибках", loading: 0.65, reverse: true, active: true },
    { id: 4, text: "Нахожу выход из нестандартных ситуаций", loading: 0.71, reverse: false, active: true },
    { id: 5, text: "Часто сомневаюсь в своей компетентности", loading: 0.68, reverse: true, active: true },
    { id: 6, text: "Быстро восстанавливаюсь после неудач", loading: 0.62, reverse: false, active: true },
    { id: 7, text: "Склонен откладывать важное из-за тревоги", loading: 0.52, reverse: true, active: true },
    { id: 8, text: "Умею концентрироваться даже в шуме", loading: 0.38, reverse: false, active: true },
  ]);

  const [forgetReverseCode, setForgetReverseCode] = useState(false);
  const [prophecyMultiplier, setProphecyMultiplier] = useState(1.5);
  const [rawScoreNorm, setRawScoreNorm] = useState(58);

  const psychometricsResults = useMemo(() => {
    const active = scaleItemsList.filter((it) => it.active);
    const k = active.length;
    if (k < 2) return { alpha: 0, omega: 0, itemStats: [] };

    // Signs: if item is reverse and we forgot to recode, sign becomes negative
    const signs = active.map((it) => (it.reverse && forgetReverseCode ? -1 : 1));
    const effectiveLoadings = active.map((it, idx) => it.loading * signs[idx]);

    // Synthetic inter-item correlation matrix r_ij = loading_i * loading_j
    const matrix = effectiveLoadings.map((l1) =>
      effectiveLoadings.map((l2) => l1 * l2)
    );
    for (let i = 0; i < k; i++) matrix[i][i] = 1;

    // Total test variance
    const totalVar = matrix.reduce((s, row) => s + row.reduce((ss, v) => ss + v, 0), 0);
    const itemVarSum = k; // each standardized item variance = 1
    const alpha = (k / (k - 1)) * (1 - itemVarSum / (totalVar || 1e-10));

    // McDonald's omega (total)
    const sumLoadings = effectiveLoadings.reduce((s, l) => s + l, 0);
    const omegaNum = sumLoadings ** 2;
    const uniqueVarSum = active.reduce((s, it) => s + (1 - it.loading ** 2), 0);
    const omega = omegaNum / (omegaNum + uniqueVarSum || 1e-10);

    // Item stats: item-total and alpha if deleted
    const itemStats = active.map((item, idx) => {
      const rest = active.filter((_, rIdx) => rIdx !== idx);
      const restSigns = rest.map((it) => (it.reverse && forgetReverseCode ? -1 : 1));
      const restLoadings = rest.map((it, rIdx) => it.loading * restSigns[rIdx]);
      const restK = rest.length;

      let restAlpha = 0;
      if (restK >= 2) {
        const restMatrix = restLoadings.map((l1) => restLoadings.map((l2) => l1 * l2));
        for (let i = 0; i < restK; i++) restMatrix[i][i] = 1;
        const restTotalVar = restMatrix.reduce((s, row) => s + row.reduce((ss, v) => ss + v, 0), 0);
        restAlpha = (restK / (restK - 1)) * (1 - restK / (restTotalVar || 1e-10));
      }

      // item-total correlation approx
      const itCorr = effectiveLoadings[idx] * (sumLoadings - effectiveLoadings[idx]) / Math.sqrt(Math.max(1, totalVar - 1));

      return {
        id: item.id,
        text: item.text,
        loading: item.loading,
        reverse: item.reverse,
        itCorr: Math.max(-0.99, Math.min(0.99, itCorr)),
        alphaIfDeleted: Math.max(-1, Math.min(1, restAlpha)),
      };
    });

    return {
      alpha: Math.max(-1, Math.min(0.999, alpha)),
      omega: Math.max(0, Math.min(0.999, omega)),
      itemStats,
    };
  }, [scaleItemsList, forgetReverseCode]);

  // Spearman-Brown prophecy calculation
  const predictedAlpha = useMemo(() => {
    const r = psychometricsResults.alpha;
    const m = prophecyMultiplier;
    if (r <= 0) return 0;
    return (m * r) / (1 + (m - 1) * r);
  }, [psychometricsResults.alpha, prophecyMultiplier]);

  // Norms conversion
  const normConverted = useMemo(() => {
    const raw = rawScoreNorm; // 0-100 scale, M=50, SD=15
    const normM = 50;
    const normSd = 12;
    const z = (raw - normM) / normSd;
    const tScore = 50 + 10 * z;
    const sten = Math.max(1, Math.min(10, Math.round(5.5 + 2 * z)));
    const stanine = Math.max(1, Math.min(9, Math.round(5 + 2 * z)));
    const iq = 100 + 15 * z;
    const percentile = normalCdf(z) * 100;

    return { z, tScore, sten, stanine, iq, percentile };
  }, [rawScoreNorm]);

  const uniqueId = useId();

  return (
    <section className="stat-sandbox-root" id="sandbox">
      {/* Header */}
      <div className="sandbox-header">
        <div className="sandbox-badge">ИНТЕРАКТИВНЫЙ ПОЛИГОН · СТАТИСТИЧЕСКАЯ ПЕСОЧНИЦА</div>
        <h2>
          СТАТИСТИКА, КОТОРУЮ МОЖНО <span>ДЁРГАТЬ ЗА РЫЧАГИ</span>
        </h2>
        <p className="sandbox-lead">
          Двигай ползунки, ломай нормальность, вводи выбросы и смотри, как на твоих глазах одни критерии
          сохраняют надёжность, а другие начинают врать. Здесь разрешено всё, за что обычно ругают на экзамене.
        </p>

        {/* Tab switcher */}
        <div className="sandbox-tabs" role="tablist" aria-label="Разделы песочницы">
          <button
            type="button"
            className={activeTab === "dual" ? "active" : ""}
            onClick={() => setActiveTab("dual")}
            role="tab"
            aria-selected={activeTab === "dual"}
          >
            <span>01</span> Сравнение 2 выборок и предпосылки
          </button>
          <button
            type="button"
            className={activeTab === "power" ? "active" : ""}
            onClick={() => setActiveTab("power")}
            role="tab"
            aria-selected={activeTab === "power"}
          >
            <span>02</span> Мощность и размер эффекта (d)
          </button>
          <button
            type="button"
            className={activeTab === "correlation" ? "active" : ""}
            onClick={() => setActiveTab("correlation")}
            role="tab"
            aria-selected={activeTab === "correlation"}
          >
            <span>03</span> Корреляции и точка-убийца
          </button>
          <button
            type="button"
            className={activeTab === "psychometrics" ? "active" : ""}
            onClick={() => setActiveTab("psychometrics")}
            role="tab"
            aria-selected={activeTab === "psychometrics"}
          >
            <span>04</span> Психометрическая хирургия опросников
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DUAL SAMPLE & ASSUMPTIONS VIOLATION LAB          */}
      {/* ======================================================== */}
      {activeTab === "dual" && (
        <div className="sandbox-panel">
          {/* Presets row */}
          <div className="presets-bar">
            <span className="presets-label">ПСИХОЛОГИЧЕСКИЕ СЦЕНАРИИ:</span>
            <div className="presets-list">
              {scenarioPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-btn ${activePreset === preset.id ? "active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                className="preset-btn rand-btn"
                onClick={() => {
                  setActivePreset(null);
                  setDualSeed((s) => s + 1);
                }}
              >
                ↻ Случайная генерация
              </button>
            </div>
          </div>

          <div className="sandbox-grid dual-sample-grid">
            {/* Left Column: Sliders for both groups */}
            <div className="controls-column">
              {/* Group 1 */}
              <div className="sample-control-card group-1-card">
                <div className="card-header">
                  <span className="group-badge group-1-badge">ГРУППА 1 (Контроль)</span>
                  <small>M={fmt(stats1.mean)}, s={fmt(stats1.sd)}</small>
                </div>
                <div className="slider-group">
                  <label>
                    <div className="slider-title">
                      <span>Объём выборки (N₁)</span>
                      <strong>{n1}</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={5}
                      value={n1}
                      onChange={(e) => setN1(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Генеральное среднее (μ₁)</span>
                      <strong>{m1}</strong>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={1}
                      value={m1}
                      onChange={(e) => setM1(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Разброс / SD (σ₁)</span>
                      <strong>{sd1}</strong>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={25}
                      step={1}
                      value={sd1}
                      onChange={(e) => setSd1(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Асимметрия (Skew)</span>
                      <strong>{fmt(skew1, 1)}</strong>
                    </div>
                    <input
                      type="range"
                      min={-1.5}
                      max={1.5}
                      step={0.1}
                      value={skew1}
                      onChange={(e) => setSkew1(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Выбросы (Outliers)</span>
                      <strong>{outliers1}</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      step={1}
                      value={outliers1}
                      onChange={(e) => setOutliers1(Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>

              {/* Group 2 */}
              <div className="sample-control-card group-2-card">
                <div className="card-header">
                  <span className="group-badge group-2-badge">ГРУППА 2 (Эксперимент)</span>
                  <small>M={fmt(stats2.mean)}, s={fmt(stats2.sd)}</small>
                </div>
                <div className="slider-group">
                  <label>
                    <div className="slider-title">
                      <span>Объём выборки (N₂)</span>
                      <strong>{n2}</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={5}
                      value={n2}
                      onChange={(e) => setN2(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Генеральное среднее (μ₂)</span>
                      <strong>{m2}</strong>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={1}
                      value={m2}
                      onChange={(e) => setM2(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Разброс / SD (σ₂)</span>
                      <strong>{sd2}</strong>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={25}
                      step={1}
                      value={sd2}
                      onChange={(e) => setSd2(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Асимметрия (Skew)</span>
                      <strong>{fmt(skew2, 1)}</strong>
                    </div>
                    <input
                      type="range"
                      min={-1.5}
                      max={1.5}
                      step={0.1}
                      value={skew2}
                      onChange={(e) => setSkew2(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <div className="slider-title">
                      <span>Выбросы (Outliers)</span>
                      <strong>{outliers2}</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      step={1}
                      value={outliers2}
                      onChange={(e) => setOutliers2(Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="card-actions">
                <button type="button" className="action-btn" onClick={handleExportCsv}>
                  📥 Экспорт данных (CSV)
                </button>
                <button type="button" className="action-btn" onClick={copySpssSyntax}>
                  {spssCopied ? "Синтаксис скопирован ✓" : "📋 Скопировать синтаксис SPSS"}
                </button>
              </div>
            </div>

            {/* Right Column: Visual Charts & Comparative Stats */}
            <div className="visuals-column">
              {/* Density KDE & Distribution Chart */}
              <div className="visual-card">
                <div className="visual-card-title">
                  <span>ФОРМА РАСПРЕДЕЛЕНИЙ И СРАВНЕНИЕ ПЛОТНОСТЕЙ</span>
                  <div className="legend-items">
                    <span className="legend-g1">■ Группа 1</span>
                    <span className="legend-g2">■ Группа 2</span>
                  </div>
                </div>

                <div className="density-chart-container">
                  <svg viewBox="0 0 600 200" className="density-svg" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id={`grad1-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#524ba7" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#524ba7" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id={`grad2-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e9b44c" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#e9b44c" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="0" y1="180" x2="600" y2="180" stroke="#ccc" strokeWidth="1" />
                    <line x1="150" y1="10" x2="150" y2="180" stroke="#eee" strokeDasharray="3 3" />
                    <line x1="300" y1="10" x2="300" y2="180" stroke="#eee" strokeDasharray="3 3" />
                    <line x1="450" y1="10" x2="450" y2="180" stroke="#eee" strokeDasharray="3 3" />

                    {/* Curve 1 */}
                    {(() => {
                      const minX = Math.min(stats1.min, stats2.min) - 10;
                      const maxX = Math.max(stats1.max, stats2.max) + 10;
                      const range = maxX - minX || 1;
                      const steps = 70;
                      let pathD1 = `M 0 180 `;
                      let pathD2 = `M 0 180 `;

                      for (let i = 0; i <= steps; i++) {
                        const curX = minX + (i / steps) * range;
                        const svgX = (i / steps) * 600;
                        const pdf1 = normalPdf(curX, stats1.mean, stats1.sd || 1);
                        const pdf2 = normalPdf(curX, stats2.mean, stats2.sd || 1);
                        const svgY1 = 180 - Math.min(170, pdf1 * 3200);
                        const svgY2 = 180 - Math.min(170, pdf2 * 3200);
                        pathD1 += `L ${svgX.toFixed(1)} ${svgY1.toFixed(1)} `;
                        pathD2 += `L ${svgX.toFixed(1)} ${svgY2.toFixed(1)} `;
                      }
                      pathD1 += `L 600 180 Z`;
                      pathD2 += `L 600 180 Z`;

                      const meanX1 = ((stats1.mean - minX) / range) * 600;
                      const meanX2 = ((stats2.mean - minX) / range) * 600;

                      return (
                        <>
                          <path d={pathD1} fill={`url(#grad1-${uniqueId})`} stroke="#524ba7" strokeWidth="2.5" />
                          <path d={pathD2} fill={`url(#grad2-${uniqueId})`} stroke="#e9b44c" strokeWidth="2.5" />
                          {/* Mean tick lines */}
                          <line x1={meanX1} y1="20" x2={meanX1} y2="180" stroke="#524ba7" strokeWidth="2" strokeDasharray="4 2" />
                          <line x1={meanX2} y1="20" x2={meanX2} y2="180" stroke="#e9b44c" strokeWidth="2" strokeDasharray="4 2" />
                          <text x={meanX1 - 18} y="18" fill="#524ba7" fontSize="10" fontWeight="bold">
                            M₁={fmt(stats1.mean, 1)}
                          </text>
                          <text x={meanX2 - 18} y="18" fill="#e9b44c" fontSize="10" fontWeight="bold">
                            M₂={fmt(stats2.mean, 1)}
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Boxplot & Jitter Row */}
                <div className="boxplot-strip">
                  <div className="boxplot-row">
                    <span className="bp-label">Гр. 1:</span>
                    <div className="bp-track">
                      {/* Whiskers & Box */}
                      <div
                        className="bp-whisker-line"
                        style={{
                          left: `${Math.max(0, Math.min(100, stats1.min))}%`,
                          width: `${Math.max(2, Math.min(100, stats1.max - stats1.min))}%`,
                        }}
                      />
                      <div
                        className="bp-box bp-box-1"
                        style={{
                          left: `${Math.max(0, Math.min(100, stats1.q1))}%`,
                          width: `${Math.max(3, Math.min(100, stats1.iqr))}%`,
                        }}
                      >
                        <span
                          className="bp-median"
                          style={{
                            left: `${stats1.iqr > 0 ? ((stats1.median - stats1.q1) / stats1.iqr) * 100 : 50}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="boxplot-row">
                    <span className="bp-label">Гр. 2:</span>
                    <div className="bp-track">
                      <div
                        className="bp-whisker-line"
                        style={{
                          left: `${Math.max(0, Math.min(100, stats2.min))}%`,
                          width: `${Math.max(2, Math.min(100, stats2.max - stats2.min))}%`,
                        }}
                      />
                      <div
                        className="bp-box bp-box-2"
                        style={{
                          left: `${Math.max(0, Math.min(100, stats2.q1))}%`,
                          width: `${Math.max(3, Math.min(100, stats2.iqr))}%`,
                        }}
                      >
                        <span
                          className="bp-median"
                          style={{
                            left: `${stats2.iqr > 0 ? ((stats2.median - stats2.q1) / stats2.iqr) * 100 : 50}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparative Statistical Battle Table */}
              <div className="battle-table-card">
                <div className="battle-header">
                  <span>БИТВА КРИТЕРИЕВ ДЛЯ ЭТИХ ДАННЫХ</span>
                  <small>Разность средних ΔM = {fmt(testResults.meanDiff)}</small>
                </div>

                <div className="battle-table-wrapper">
                  <table className="battle-table">
                    <thead>
                      <tr>
                        <th>Метод анализа</th>
                        <th>Статистика</th>
                        <th>df</th>
                        <th>p-значение</th>
                        <th>Размер эффекта</th>
                        <th>Статус надёжности</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Student's t */}
                      <tr className={testResults.varRatio > 2.5 || outliers1 > 0 || outliers2 > 0 ? "risky-row" : "safe-row"}>
                        <td>
                          <strong>t Стьюдента</strong>
                          <small>предполагает σ₁² = σ₂² и нормальность</small>
                        </td>
                        <td>t = {fmt(testResults.tStudent)}</td>
                        <td>{testResults.dfStudent}</td>
                        <td className={testResults.pStudent < 0.05 ? "sig-cell" : ""}>
                          {fmtP(testResults.pStudent)}
                        </td>
                        <td>Cohen’s d = {fmt(testResults.cohenD)}</td>
                        <td>
                          {testResults.varRatio > 2.5 || outliers1 + outliers2 > 1 ? (
                            <span className="badge badge-warning">⚠ Риск ложного вывода</span>
                          ) : (
                            <span className="badge badge-ok">✓ Корректен</span>
                          )}
                        </td>
                      </tr>

                      {/* Welch's t */}
                      <tr className="highlight-row">
                        <td>
                          <strong>t Уэлча (Welch’s t)</strong>
                          <small>робастен к неравенству дисперсий</small>
                        </td>
                        <td>tᵂ = {fmt(testResults.tWelch)}</td>
                        <td>{fmt(testResults.dfWelch, 1)}</td>
                        <td className={testResults.pWelch < 0.05 ? "sig-cell" : ""}>
                          {fmtP(testResults.pWelch)}
                        </td>
                        <td>Hedges’ g = {fmt(testResults.hedgesG)}</td>
                        <td>
                          <span className="badge badge-recommended">★ Золотой стандарт APA</span>
                        </td>
                      </tr>

                      {/* Mann-Whitney U */}
                      <tr className={outliers1 + outliers2 > 0 || Math.abs(skew1) > 0.8 || Math.abs(skew2) > 0.8 ? "safe-row" : ""}>
                        <td>
                          <strong>U Манна — Уитни</strong>
                          <small>непараметрический ранговый критерий</small>
                        </td>
                        <td>U = {fmt(testResults.uVal, 0)} (Z = {fmt(testResults.zU)})</td>
                        <td>—</td>
                        <td className={testResults.pU < 0.05 ? "sig-cell" : ""}>
                          {fmtP(testResults.pU)}
                        </td>
                        <td>rᵣᵦ = {fmt(testResults.rankBiserial)}</td>
                        <td>
                          {outliers1 + outliers2 > 0 || Math.abs(skew1) > 0.8 || Math.abs(skew2) > 0.8 ? (
                            <span className="badge badge-recommended">★ Устойчив к выбросам</span>
                          ) : (
                            <span className="badge badge-ok">✓ Применим</span>
                          )}
                        </td>
                      </tr>

                      {/* Levene Test */}
                      <tr className="info-row">
                        <td>
                          <strong>Тест Ливиня</strong>
                          <small>проверка равенства дисперсий (H₀: σ₁² = σ₂²)</small>
                        </td>
                        <td>F = {fmt(testResults.fLevene)}</td>
                        <td>1; {n1 + n2 - 2}</td>
                        <td className={testResults.pLevene < 0.05 ? "sig-cell" : ""}>
                          {fmtP(testResults.pLevene)}
                        </td>
                        <td>Отношение s² = {fmt(testResults.varRatio, 1)}x</td>
                        <td>
                          {testResults.pLevene < 0.05 ? (
                            <span className="badge badge-danger">Дисперсии НЕ равны</span>
                          ) : (
                            <span className="badge badge-ok">Дисперсии однородны</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Educational Verdict Alert */}
                <div className={`dynamic-verdict ${testResults.pLevene < 0.05 ? "alert-viol" : "alert-ok"}`}>
                  <div className="verdict-icon">💡</div>
                  <div className="verdict-text">
                    <strong>
                      {testResults.pLevene < 0.05
                        ? "Обнаружено нарушение равенства дисперсий (гетероскедастичность)!"
                        : "Предпосылка об однородности дисперсий не нарушена."}
                    </strong>
                    <p>
                      {testResults.pLevene < 0.05
                        ? `Отношение дисперсий составляет ${fmt(testResults.varRatio, 1)}:1 (p Ливиня ${fmtP(testResults.pLevene)}). Классический t Стьюдента даёт p ${fmtP(testResults.pStudent)}, в то время как скорректированный t Уэлча даёт p ${fmtP(testResults.pWelch)}. Используйте в отчёте t Уэлча или U Манна-Уитни, чтобы избежать ложноположительной ошибки.`
                        : `Разница дисперсий невелика, критерий Ливиня незначим (p ${fmtP(testResults.pLevene)}). Результаты t Стьюдента и t Уэлча практически совпадают. Если распределение не имеет грубых выбросов, можно приводить стандартный t-тест.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: POWER & EFFECT SIZE PLAYGROUND                   */}
      {/* ======================================================== */}
      {activeTab === "power" && (
        <div className="sandbox-panel">
          <div className="sandbox-grid power-grid">
            {/* Sliders */}
            <div className="controls-column">
              <div className="sample-control-card">
                <div className="card-header">
                  <span className="group-badge">ПАРАМЕТРЫ ПЛАНИРОВАНИЯ ЭКСПЕРИМЕНТА</span>
                </div>

                <div className="slider-group">
                  <label>
                    <div className="slider-title">
                      <span>Величина эффекта (Cohen’s d)</span>
                      <strong>{fmt(cohenDInput, 2)}</strong>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={2.0}
                      step={0.05}
                      value={cohenDInput}
                      onChange={(e) => setCohenDInput(Number(e.target.value))}
                    />
                    <div className="slider-ticks">
                      <span>0.2 (малый)</span>
                      <span>0.5 (средний)</span>
                      <span>0.8 (большой)</span>
                      <span>1.2+</span>
                    </div>
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Размер выборки в группе (n)</span>
                      <strong>{powerN} чел.</strong>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={200}
                      step={5}
                      value={powerN}
                      onChange={(e) => setPowerN(Number(e.target.value))}
                    />
                    <small>Всего участников в исследовании: {powerN * 2} чел.</small>
                  </label>

                  <div className="segmented-control">
                    <span>Уровень значимости (α):</span>
                    <div className="segmented-buttons">
                      {[0.05, 0.01, 0.001].map((alphaVal) => (
                        <button
                          key={alphaVal}
                          type="button"
                          className={powerAlpha === alphaVal ? "active" : ""}
                          onClick={() => setPowerAlpha(alphaVal)}
                        >
                          {alphaVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="segmented-control">
                    <span>Направление гипотезы:</span>
                    <div className="segmented-buttons">
                      <button
                        type="button"
                        className={isTwoTailed ? "active" : ""}
                        onClick={() => setIsTwoTailed(true)}
                      >
                        Двусторонняя (≠)
                      </button>
                      <button
                        type="button"
                        className={!isTwoTailed ? "active" : ""}
                        onClick={() => setIsTwoTailed(false)}
                      >
                        Односторонняя (&gt;)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="n-recommendation-box">
                  <span className="rec-title">ТРЕБУЕМЫЙ ОБЪЁМ ВЫБОРКИ ПРИ d = {fmt(cohenDInput)}:</span>
                  <div className="rec-stats">
                    <div>
                      <strong>n = {powerMetrics.n80}</strong>
                      <small>для 80% мощности (стандарт)</small>
                    </div>
                    <div>
                      <strong>n = {powerMetrics.n90}</strong>
                      <small>для 90% мощности (высокая надёжность)</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visuals & Gauge */}
            <div className="visuals-column">
              {/* Distribution Overlap Graph */}
              <div className="visual-card">
                <div className="visual-card-title">
                  <span>ВИЗУАЛЬНОЕ ПЕРЕКРЫТИЕ ДВУХ ПОПУЛЯЦИЙ (OVERLAP)</span>
                  <small>Пересечение площадей: {fmt(powerMetrics.overlap, 1)}%</small>
                </div>

                <div className="overlap-svg-container">
                  <svg viewBox="0 0 600 220" className="overlap-svg">
                    <defs>
                      <linearGradient id={`powerGrad1-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#524ba7" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#524ba7" stopOpacity="0.1" />
                      </linearGradient>
                      <linearGradient id={`powerGrad2-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7bc5c0" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#7bc5c0" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>

                    {/* Ground line */}
                    <line x1="0" y1="200" x2="600" y2="200" stroke="#bbb" strokeWidth="1.5" />

                    {/* Distributions */}
                    {(() => {
                      const d = cohenDInput;
                      const steps = 90;
                      let d1 = "M 0 200 ";
                      let d2 = "M 0 200 ";
                      const center1 = 220;
                      const center2 = 220 + d * 70; // 70px per 1 SD

                      for (let i = 0; i <= steps; i++) {
                        const px = (i / steps) * 600;
                        const z1 = (px - center1) / 70;
                        const z2 = (px - center2) / 70;
                        const y1 = 200 - Math.exp(-0.5 * z1 * z1) * 160;
                        const y2 = 200 - Math.exp(-0.5 * z2 * z2) * 160;
                        d1 += `L ${px.toFixed(1)} ${y1.toFixed(1)} `;
                        d2 += `L ${px.toFixed(1)} ${y2.toFixed(1)} `;
                      }
                      d1 += "L 600 200 Z";
                      d2 += "L 600 200 Z";

                      return (
                        <>
                          <path d={d1} fill={`url(#powerGrad1-${uniqueId})`} stroke="#524ba7" strokeWidth="2.5" />
                          <path d={d2} fill={`url(#powerGrad2-${uniqueId})`} stroke="#38a9a0" strokeWidth="2.5" />
                          <line x1={center1} y1="40" x2={center1} y2="200" stroke="#524ba7" strokeDasharray="3 3" />
                          <line x1={center2} y1="40" x2={center2} y2="200" stroke="#38a9a0" strokeDasharray="3 3" />
                          <text x={center1 - 25} y="34" fill="#524ba7" fontSize="11" fontWeight="bold">
                            Контроль
                          </text>
                          <text x={center2 - 32} y="34" fill="#38a9a0" fontSize="11" fontWeight="bold">
                            Воздействие
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Metrics 4-grid */}
                <div className="power-metrics-grid">
                  <div className="metric-box">
                    <span>МОЩНОСТЬ (1 − β)</span>
                    <strong className={powerMetrics.power >= 0.8 ? "text-ok" : "text-warn"}>
                      {(powerMetrics.power * 100).toFixed(1)}%
                    </strong>
                    <small>
                      {powerMetrics.power >= 0.8
                        ? "Достаточная мощность (≥ 80%)"
                        : "Опасность ошибки II рода (пропуск реального эффекта!)"}
                    </small>
                  </div>

                  <div className="metric-box">
                    <span>COHEN’S U₃</span>
                    <strong>{fmt(powerMetrics.u3, 1)}%</strong>
                    <small>доля группы воздействия выше медианы контроля</small>
                  </div>

                  <div className="metric-box">
                    <span>ПРЕВОСХОДСТВО (CLES)</span>
                    <strong>{fmt(powerMetrics.cles, 1)}%</strong>
                    <small>вероятность, что случайный пациент из гр.2 лучше гр.1</small>
                  </div>

                  <div className="metric-box">
                    <span>NNT (ЧИСЛО ЛЕЧИМЫХ)</span>
                    <strong>{Number.isFinite(powerMetrics.nnt) ? fmt(powerMetrics.nnt, 1) : "∞"}</strong>
                    <small>пациентов нужно пролечить для 1 доп. успеха</small>
                  </div>
                </div>

                <div className="psychology-trap-card">
                  <strong>⚠️ Ловушка слабых выборок в психологии («Проклятие победителя»):</strong>
                  <p>
                    Если исследование проводится на малой выборке (например, n = 15 в группе), а реальный эффект мал
                    (d = 0.3), то мощность теста составляет всего ~13%. Если такой тест случайно станет «значимым»
                    (p &lt; .05), размер эффекта d в публикации окажется завышен в 2–3 раза! Именно это явление
                    породило «кризис воспроизводимости» в психологической науке.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CORRELATION, NON-LINEARITY & THE EVIL OUTLIER     */}
      {/* ======================================================== */}
      {activeTab === "correlation" && (
        <div className="sandbox-panel">
          <div className="sandbox-grid correlation-grid">
            {/* Sliders */}
            <div className="controls-column">
              <div className="sample-control-card">
                <div className="card-header">
                  <span className="group-badge">ПАРАМЕТРЫ СВЯЗИ И ВЫБРОСА</span>
                  <button type="button" className="mini-btn" onClick={() => setCorrSeed((s) => s + 1)}>
                    ↻ Сгенерировать
                  </button>
                </div>

                <div className="slider-group">
                  <label>
                    <div className="slider-title">
                      <span>Истинная линейная связь (ρ)</span>
                      <strong>{fmt(trueR)}</strong>
                    </div>
                    <input
                      type="range"
                      min={-0.95}
                      max={0.95}
                      step={0.05}
                      value={trueR}
                      onChange={(e) => setTrueR(Number(e.target.value))}
                    />
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Число наблюдений (N)</span>
                      <strong>{corrN}</strong>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      step={5}
                      value={corrN}
                      onChange={(e) => setCorrN(Number(e.target.value))}
                    />
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Нелинейность / U-изгиб (Закон Йеркса-Додсона)</span>
                      <strong>{fmt(nonLinearity, 1)}</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.1}
                      value={nonLinearity}
                      onChange={(e) => setNonLinearity(Number(e.target.value))}
                    />
                    <small>0 — строго прямая · &gt;0 — дуга (оптимум мотивации)</small>
                  </label>

                  {/* Outlier switch & sliders */}
                  <div className="outlier-box-toggle">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={hasOutlier}
                        onChange={(e) => setHasOutlier(e.target.checked)}
                      />
                      <span>Внедрить влиятельный выброс (Точка-убийца)</span>
                    </label>

                    {hasOutlier && (
                      <div className="outlier-coords-sliders">
                        <label>
                          <div className="slider-title">
                            <span>Координата X выброса:</span>
                            <strong>{fmt(outlierX, 1)}</strong>
                          </div>
                          <input
                            type="range"
                            min={-3.5}
                            max={3.5}
                            step={0.1}
                            value={outlierX}
                            onChange={(e) => setOutlierX(Number(e.target.value))}
                          />
                        </label>
                        <label>
                          <div className="slider-title">
                            <span>Координата Y выброса:</span>
                            <strong>{fmt(outlierY, 1)}</strong>
                          </div>
                          <input
                            type="range"
                            min={-3.5}
                            max={3.5}
                            step={0.1}
                            value={outlierY}
                            onChange={(e) => setOutlierY(Number(e.target.value))}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Scatter & Comparison */}
            <div className="visuals-column">
              <div className="visual-card">
                <div className="visual-card-title">
                  <span>ДИАГРАММА РАССЕЯНИЯ С ЛИНИЕЙ РЕГРЕССИИ OLS</span>
                  <div className="legend-items">
                    <span className="legend-norm">● Наблюдения ({corrN})</span>
                    {hasOutlier && <span className="legend-outlier">★ Точка-убийца</span>}
                  </div>
                </div>

                <div className="scatter-container">
                  <svg viewBox="0 0 500 320" className="scatter-svg">
                    {/* Axes */}
                    <line x1="40" y1="160" x2="480" y2="160" stroke="#ddd" strokeWidth="1" />
                    <line x1="260" y1="20" x2="260" y2="300" stroke="#ddd" strokeWidth="1" />

                    {/* Scale: X from -4 to 4 -> 40 to 480 (55px per unit)
                               Y from -4 to 4 -> 300 to 20 (35px per unit) */}
                    {(() => {
                      const toSvgX = (x: number) => 260 + x * 55;
                      const toSvgY = (y: number) => 160 - y * 35;

                      // Regression line
                      const xStart = -3.8;
                      const xEnd = 3.8;
                      const yStart = corrStats.intercept + corrStats.slope * xStart;
                      const yEnd = corrStats.intercept + corrStats.slope * xEnd;

                      return (
                        <>
                          <line
                            x1={toSvgX(xStart)}
                            y1={toSvgY(yStart)}
                            x2={toSvgX(xEnd)}
                            y2={toSvgY(yEnd)}
                            stroke="#524ba7"
                            strokeWidth="2.5"
                          />

                          {/* Dots */}
                          {corrPoints.map((pt, idx) => {
                            const sx = toSvgX(pt.x);
                            const sy = toSvgY(pt.y);
                            if (pt.isOutlier) {
                              return (
                                <g key={idx}>
                                  <circle cx={sx} cy={sy} r="9" fill="#c74b35" opacity="0.3" />
                                  <circle cx={sx} cy={sy} r="6" fill="#c74b35" stroke="#fff" strokeWidth="2" />
                                  <text x={sx + 10} y={sy + 4} fill="#c74b35" fontSize="11" fontWeight="bold">
                                    Выброс
                                  </text>
                                </g>
                              );
                            }
                            return (
                              <circle
                                key={idx}
                                cx={sx}
                                cy={sy}
                                r="4"
                                fill="#524ba7"
                                opacity="0.75"
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Live Coefficients Comparison */}
                <div className="coefficients-row">
                  <div className="coeff-item">
                    <span>ПИРСОН (r)</span>
                    <strong className={corrStats.pPearson < 0.05 ? "sig-val" : ""}>
                      {fmt(corrStats.pearsonR)}
                    </strong>
                    <small>p {fmtP(corrStats.pPearson)} · R² = {fmt(corrStats.rSquared)}</small>
                  </div>

                  <div className="coeff-item">
                    <span>СПИРМЕН (ρₛ)</span>
                    <strong className={corrStats.pSpearman < 0.05 ? "sig-val" : ""}>
                      {fmt(corrStats.spearmanRho)}
                    </strong>
                    <small>p {fmtP(corrStats.pSpearman)} (ранговый)</small>
                  </div>

                  <div className="coeff-item">
                    <span>РАССТОЯНИЕ КУКА (D)</span>
                    <strong>{hasOutlier ? fmt(corrStats.cookDist) : "—"}</strong>
                    <small>{corrStats.cookDist > 1 ? "Критическое влияние (D > 1)!" : "Умеренное влияние"}</small>
                  </div>
                </div>

                <div className="lesson-box">
                  <strong>💡 Чему учит этот эксперимент:</strong>
                  <p>
                    Подвигайте точку-выброс в правый нижний угол: вы увидите, как один единственный человек
                    может уронить коэффициент линейной корреляции Пирсона с r = 0.70 до r = 0.15 или даже обратить
                    его в отрицательный! При этом непараметрический Спирмен (ρ) устойчиво сохраняет связь,
                    потому что работает с номерами рангов, а не с метрическими метрами.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PSYCHOMETRICS & TEST SURGERY                      */}
      {/* ======================================================== */}
      {activeTab === "psychometrics" && (
        <div className="sandbox-panel">
          <div className="sandbox-grid psychometrics-grid">
            {/* Items Surgery Table */}
            <div className="controls-column">
              <div className="sample-control-card">
                <div className="card-header">
                  <span className="group-badge">КОНСТРУКТОР ПУНКТОВ МЕТОДИКИ</span>
                  <small>{scaleItemsList.filter((i) => i.active).length} пунктов активно</small>
                </div>

                <div className="blunder-button-row">
                  <label className="checkbox-label danger-checkbox">
                    <input
                      type="checkbox"
                      checked={forgetReverseCode}
                      onChange={(e) => setForgetReverseCode(e.target.checked)}
                    />
                    <span>💥 Симулятор ошибки: забыть перевернуть обратные пункты!</span>
                  </label>
                </div>

                <div className="items-table-scroll">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Вкл</th>
                        <th>Текст утверждения</th>
                        <th>Нагрузка (λ)</th>
                        <th>Тип</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scaleItemsList.map((item) => (
                        <tr key={item.id} className={!item.active ? "item-disabled" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={item.active}
                              onChange={(e) =>
                                setScaleItemsList((list) =>
                                  list.map((it) => (it.id === item.id ? { ...it, active: e.target.checked } : it))
                                )
                              }
                            />
                          </td>
                          <td>
                            <span>{item.text}</span>
                          </td>
                          <td>
                            <input
                              type="range"
                              min={0.1}
                              max={0.9}
                              step={0.05}
                              value={item.loading}
                              disabled={!item.active}
                              onChange={(e) =>
                                setScaleItemsList((list) =>
                                  list.map((it) =>
                                    it.id === item.id ? { ...it, loading: Number(e.target.value) } : it
                                  )
                                )
                              }
                            />
                            <small>{fmt(item.loading)}</small>
                          </td>
                          <td>
                            {item.reverse ? (
                              <span className="badge badge-warning">Обратный</span>
                            ) : (
                              <span className="badge badge-ok">Прямой</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Spearman-Brown Prophecy Card */}
              <div className="sample-control-card">
                <div className="card-header">
                  <span className="group-badge">ФОРМУЛА СПИРМЕНА — БРАУНА</span>
                </div>
                <div className="slider-group">
                  <label>
                    <div className="slider-title">
                      <span>Изменение длины опросника (в k раз):</span>
                      <strong>{prophecyMultiplier}x</strong>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.25}
                      value={prophecyMultiplier}
                      onChange={(e) => setProphecyMultiplier(Number(e.target.value))}
                    />
                    <small>
                      Если увеличить тест с {scaleItemsList.filter((i) => i.active).length} до{" "}
                      {Math.round(scaleItemsList.filter((i) => i.active).length * prophecyMultiplier)} вопросов:
                    </small>
                  </label>
                  <div className="prophecy-result">
                    <span>ПРОГНОЗ НАДЁЖНОСТИ α:</span>
                    <strong>{fmt(predictedAlpha)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Column */}
            <div className="visuals-column">
              {/* Alpha Gauge */}
              <div className="visual-card">
                <div className="visual-card-title">
                  <span>СОГЛАСОВАННОСТЬ ШКАЛЫ: α КРОНБАХА И ω МАКДОНАЛЬДА</span>
                </div>

                <div className="alpha-display-strip">
                  <div className="gauge-item">
                    <span>α КРОНБАХА</span>
                    <strong className={psychometricsResults.alpha >= 0.7 ? "text-ok" : "text-warn"}>
                      {fmt(psychometricsResults.alpha)}
                    </strong>
                    <small>
                      {psychometricsResults.alpha >= 0.9
                        ? "Превосходная (проверьте тавтологичность пунктов!)"
                        : psychometricsResults.alpha >= 0.8
                        ? "Хорошая надёжность для психометрии"
                        : psychometricsResults.alpha >= 0.7
                        ? "Приемлемая для исследовательских шкал"
                        : psychometricsResults.alpha < 0
                        ? "ОТРИЦАТЕЛЬНАЯ АЛЬФА: обратные пункты не перекодированы!"
                        : "Слабая согласованность"}
                    </small>
                  </div>

                  <div className="gauge-item">
                    <span>ω МАКДОНАЛЬДА (TOTAL)</span>
                    <strong className="text-ok">{fmt(psychometricsResults.omega)}</strong>
                    <small>Не требует тау-эквивалентности пунктов (точный стандарт)</small>
                  </div>
                </div>

                {/* Item-Total Statistics Table */}
                <div className="item-analysis-table-wrapper">
                  <span className="table-subtitle">ТАБЛИЦА АНАЛИЗА ПУНКТОВ (ITEM ANALYSIS):</span>
                  <table className="battle-table">
                    <thead>
                      <tr>
                        <th>Пункт</th>
                        <th>Корреляция пункт-тест (rᵢₜ)</th>
                        <th>α при удалении пункта</th>
                        <th>Рекомендация</th>
                      </tr>
                    </thead>
                    <tbody>
                      {psychometricsResults.itemStats.map((st) => {
                        const improves = st.alphaIfDeleted > psychometricsResults.alpha + 0.02;
                        return (
                          <tr key={st.id} className={improves ? "bad-item-row" : ""}>
                            <td>
                              <strong>Пункт {st.id}</strong> {st.reverse ? "(обр.)" : ""}
                            </td>
                            <td>{fmt(st.itCorr)}</td>
                            <td>{fmt(st.alphaIfDeleted)}</td>
                            <td>
                              {st.itCorr < 0 ? (
                                <span className="badge badge-danger">Перевернуть ключ!</span>
                              ) : improves ? (
                                <span className="badge badge-warning">Удаление повысит α</span>
                              ) : (
                                <span className="badge badge-ok">Работает на тест</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Norms Standardizer */}
                <div className="norms-calculator-block">
                  <span className="table-subtitle">ИНТЕРАКТИВНЫЙ КОНВЕРТЕР СТАНДАРТНЫХ ШКАЛ:</span>
                  <div className="norms-slider-row">
                    <label>
                      <span>Сырой балл по шкале: <strong>{rawScoreNorm}</strong></span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={1}
                        value={rawScoreNorm}
                        onChange={(e) => setRawScoreNorm(Number(e.target.value))}
                      />
                    </label>
                  </div>

                  <div className="norms-chips-grid">
                    <div className="norm-chip">
                      <span>z-оценка</span>
                      <strong>{fmt(normConverted.z)}</strong>
                      <small>M=0, SD=1</small>
                    </div>
                    <div className="norm-chip">
                      <span>T-балл</span>
                      <strong>{fmt(normConverted.tScore, 0)}</strong>
                      <small>M=50, SD=10 (MMPI)</small>
                    </div>
                    <div className="norm-chip">
                      <span>Стэн (16PF)</span>
                      <strong>{normConverted.sten}</strong>
                      <small>M=5.5, SD=2</small>
                    </div>
                    <div className="norm-chip">
                      <span>IQ Векслера</span>
                      <strong>{fmt(normConverted.iq, 0)}</strong>
                      <small>M=100, SD=15</small>
                    </div>
                    <div className="norm-chip">
                      <span>Процентиль</span>
                      <strong>{fmt(normConverted.percentile, 1)}%</strong>
                      <small>% популяции ниже этого балла</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
