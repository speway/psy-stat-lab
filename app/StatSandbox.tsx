"use client";

import { useState, useMemo, useId } from "react";
import type { CSSProperties } from "react";
import {
  seededRandom,
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
} from "./stat-calc";

const calcStats = computeSampleStats;

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

interface PairedScenarioPreset {
  id: string;
  name: string;
  description: string;
  n: number;
  mBase: number;
  meanDiff: number;
  sdBase: number;
  r: number;
  constantDiff?: boolean;
  variableName: string;
  unit: string;
}

const PAIRED_SCENARIO_PRESETS: PairedScenarioPreset[] = [
  {
    id: "anxiety",
    name: "Тренинг тревожности (STAI)",
    description: "Уровень тревожности одних и тех же клиентов до и после 8-недельного курса КПТ. За счёт вычитания индивидуальных различий парный тест обнаруживает выраженную динамику.",
    n: 30,
    mBase: 52,
    meanDiff: -8.5,
    sdBase: 10,
    r: 0.70,
    variableName: "Реактивная тревожность",
    unit: "баллы",
  },
  {
    id: "reaction",
    name: "Когнитивная тренировка (мс)",
    description: "Время сенсомоторной реакции до и после тренинга внимания. Базовый разброс между людьми велик (SD = 55 мс), но внутрииндивидуальный сдвиг согласован: парный тест снижает ошибку более чем на 60%.",
    n: 35,
    mBase: 450,
    meanDiff: -32,
    sdBase: 55,
    r: 0.85,
    variableName: "Время простой реакции",
    unit: "мс",
  },
  {
    id: "burnout",
    name: "Выгорание учителей (MBI)",
    description: "Динамика эмоционального истощения педагогов после цикла интервизий. Умеренная корреляция замеров (r = 0.42) иллюстрирует случай, когда индивидуальные траектории менее однородны.",
    n: 25,
    mBase: 36,
    meanDiff: -4.5,
    sdBase: 11,
    r: 0.42,
    variableName: "Эмоциональное истощение",
    unit: "баллы",
  },
  {
    id: "placebo",
    name: "Плацебо / Спонтанная динамика (H₀)",
    description: "Истинный популяционный сдвиг равен 0. Индивидуальные колебания участников обусловлены стохастическим шумом. Доверительный интервал включает 0, p > .05.",
    n: 35,
    mBase: 50,
    meanDiff: 0,
    sdBase: 10,
    r: 0.75,
    variableName: "Шкала самочувствия",
    unit: "баллы",
  },
  {
    id: "zero-diff",
    name: "Константный сдвиг (s_D = 0)",
    description: "Математический вырожденный случай: каждый участник улучшился строго на -5,0 баллов. Разброс разностей s_D = 0, критерий Стьюдента даёт деление на ноль и неприменим.",
    n: 20,
    mBase: 50,
    meanDiff: -5.0,
    sdBase: 10,
    r: 0.70,
    constantDiff: true,
    variableName: "Учебный модельный балл",
    unit: "баллы",
  },
];

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

export default function StatSandbox({
  initialTab = "dual",
}: {
  initialTab?: "dual" | "paired" | "power" | "correlation" | "psychometrics";
} = {}) {
  const [activeTab, setActiveTab] = useState<"dual" | "paired" | "power" | "correlation" | "psychometrics">(initialTab);

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
    return computeTwoSampleTests(sample1, sample2);
  }, [sample1, sample2]);

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


  // --- TAB: PAIRED SAMPLES LAB STATE ---
  const [pairedN, setPairedN] = useState(30);
  const [pairedMBase, setPairedMBase] = useState(52);
  const [pairedMeanDiff, setPairedMeanDiff] = useState(-8.5);
  const [pairedSdBase, setPairedSdBase] = useState(10);
  const [pairedR, setPairedR] = useState(0.70);
  const [pairedConstantDiff, setPairedConstantDiff] = useState(false);
  const [pairedSeed, setPairedSeed] = useState(77);
  const [activePairedPreset, setActivePairedPreset] = useState<string>("anxiety");
  const [pairedSpssCopied, setPairedSpssCopied] = useState(false);

  const applyPairedPreset = (preset: PairedScenarioPreset) => {
    setActivePairedPreset(preset.id);
    setPairedN(preset.n);
    setPairedMBase(preset.mBase);
    setPairedMeanDiff(preset.meanDiff);
    setPairedSdBase(preset.sdBase);
    setPairedR(preset.r);
    setPairedConstantDiff(!!preset.constantDiff);
    setPairedSeed((s) => s + 1);
  };

  const pairedData = useMemo(() => {
    return generatePairedSample({
      n: pairedN,
      mBase: pairedMBase,
      meanDiff: pairedMeanDiff,
      sdBase: pairedSdBase,
      r: pairedR,
      constantDiff: pairedConstantDiff,
      seed: pairedSeed,
    });
  }, [pairedN, pairedMBase, pairedMeanDiff, pairedSdBase, pairedR, pairedConstantDiff, pairedSeed]);

  const pairedResults = useMemo(() => {
    return computePairedSampleTests(pairedData);
  }, [pairedData]);

  const handleExportPairedCsv = () => {
    let csv = "participant_id,before,after,difference\n";
    pairedData.forEach((p) => {
      csv += `P_${String(p.id).padStart(2, "0")},${p.before.toFixed(2)},${p.after.toFixed(2)},${p.diff.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `paired_samples_before_after_n${pairedN}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPairedSpss = () => {
    const syntax = `* Анализ связанных выборок (парный t-критерий) в SPSS.
* 1. Описательные статистики, парная корреляция и парный t-тест:
T-TEST PAIRS=Before WITH After (PAIRED)
  /CRITERIA=CI(.95)
  /MISSING=ANALYSIS.

* 2. Непараметрический Т-критерий Вилкоксона для связанных выборок:
NPAR TESTS
  /WILCOXON=Before WITH After (PAIRED)
  /MISSING ANALYSIS.`;
    navigator.clipboard.writeText(syntax);
    setPairedSpssCopied(true);
    setTimeout(() => setPairedSpssCopied(false), 2000);
  };

  // --- TAB 2: POWER & EFFECT SIZE STATE ---
  const [cohenDInput, setCohenDInput] = useState(0.5);
  const [powerN, setPowerN] = useState(45);
  const [powerAlpha, setPowerAlpha] = useState(0.05);
  const [isTwoTailed, setIsTwoTailed] = useState(true);

  const powerMetrics = useMemo(() => {
    return computePowerMetrics({
      d: cohenDInput,
      n: powerN,
      alpha: powerAlpha,
      isTwoTailed,
    });
  }, [cohenDInput, powerN, powerAlpha, isTwoTailed]);

  const handleAlphaKeyDown = (e: React.KeyboardEvent, currentVal: number) => {
    const alphas = [0.05, 0.01, 0.001];
    const idx = alphas.indexOf(currentVal);
    if (idx === -1) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextVal = alphas[(idx + 1) % alphas.length];
      setPowerAlpha(nextVal);
      document.getElementById(`power-alpha-${nextVal}`)?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevVal = alphas[(idx - 1 + alphas.length) % alphas.length];
      setPowerAlpha(prevVal);
      document.getElementById(`power-alpha-${prevVal}`)?.focus();
    }
  };

  const handleDirectionKeyDown = (e: React.KeyboardEvent, currentIsTwoTailed: boolean) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextState = !currentIsTwoTailed;
      setIsTwoTailed(nextState);
      const targetId = nextState ? "power-direction-two-tailed" : "power-direction-one-tailed";
      document.getElementById(targetId)?.focus();
    }
  };

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
            <span>01</span> Сравнение 2 независимых выборок
          </button>
          <button
            type="button"
            className={activeTab === "paired" ? "active" : ""}
            onClick={() => setActiveTab("paired")}
            role="tab"
            aria-selected={activeTab === "paired"}
          >
            <span>02</span> Парные измерения «до / после»
          </button>
          <button
            type="button"
            className={activeTab === "power" ? "active" : ""}
            onClick={() => setActiveTab("power")}
            role="tab"
            aria-selected={activeTab === "power"}
          >
            <span>03</span> Мощность и размер эффекта (d)
          </button>
          <button
            type="button"
            className={activeTab === "correlation" ? "active" : ""}
            onClick={() => setActiveTab("correlation")}
            role="tab"
            aria-selected={activeTab === "correlation"}
          >
            <span>04</span> Корреляции и точка-убийца
          </button>
          <button
            type="button"
            className={activeTab === "psychometrics" ? "active" : ""}
            onClick={() => setActiveTab("psychometrics")}
            role="tab"
            aria-selected={activeTab === "psychometrics"}
          >
            <span>05</span> Психометрическая хирургия опросников
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
                      <tr className={testResults.isDegenerate || (testResults.varRatio !== null && testResults.varRatio > 2.5) || outliers1 > 0 || outliers2 > 0 ? "risky-row" : "safe-row"}>
                        <td>
                          <strong>t Стьюдента</strong>
                          <small>предполагает σ₁² = σ₂² и нормальность</small>
                        </td>
                        <td>t = {testResults.isDegenerate ? "—" : fmt(testResults.tStudent)}</td>
                        <td>{testResults.dfStudent}</td>
                        <td className={testResults.pStudent !== null && testResults.pStudent < 0.05 ? "sig-cell" : ""}>
                          {testResults.isDegenerate ? "—" : fmtP(testResults.pStudent)}
                        </td>
                        <td>Cohen’s d = {testResults.isDegenerate ? "—" : fmt(testResults.cohenD)}</td>
                        <td>
                          {testResults.isDegenerate ? (
                            <span className="badge badge-warning">Выборка константна (s² = 0)</span>
                          ) : (testResults.varRatio !== null && testResults.varRatio > 2.5) || outliers1 + outliers2 > 1 ? (
                            <span className="badge badge-warning">Выраженная разница s² / выбросы</span>
                          ) : (
                            <span className="badge badge-ok">Умеренная разница s²</span>
                          )}
                        </td>
                      </tr>

                      {/* Welch's t */}
                      <tr className="highlight-row">
                        <td>
                          <strong>t Уэлча (Welch’s t)</strong>
                          <small>робастен к неравенству дисперсий</small>
                        </td>
                        <td>tᵂ = {testResults.isDegenerate ? "—" : fmt(testResults.tWelch)}</td>
                        <td>{testResults.isDegenerate ? "—" : fmt(testResults.dfWelch, 1)}</td>
                        <td className={testResults.pWelch !== null && testResults.pWelch < 0.05 ? "sig-cell" : ""}>
                          {testResults.isDegenerate ? "—" : fmtP(testResults.pWelch)}
                        </td>
                        <td>Hedges’ g = {testResults.isDegenerate ? "—" : fmt(testResults.hedgesG)}</td>
                        <td>
                          {testResults.isDegenerate ? (
                            <span className="badge badge-warning">Не применимо (s² = 0)</span>
                          ) : (
                            <span className="badge badge-recommended">Робастен к σ₁² ≠ σ₂² (Delacre et al., 2017)</span>
                          )}
                        </td>
                      </tr>

                      {/* Mann-Whitney U */}
                      <tr className={outliers1 + outliers2 > 0 || Math.abs(skew1) > 0.8 || Math.abs(skew2) > 0.8 ? "safe-row" : ""}>
                        <td>
                          <strong>U Манна — Уитни</strong>
                          <small>непараметрический ранговый критерий</small>
                        </td>
                        <td>U = {fmt(testResults.uVal, 1)} (Z = {fmt(testResults.zU)})</td>
                        <td>—</td>
                        <td className={testResults.pU < 0.05 ? "sig-cell" : ""}>
                          {fmtP(testResults.pU)}
                        </td>
                        <td>rᵣᵦ = {fmt(testResults.rankBiserial)}</td>
                        <td>
                          {outliers1 + outliers2 > 0 || Math.abs(skew1) > 0.8 || Math.abs(skew2) > 0.8 ? (
                            <span className="badge badge-recommended">Ранговый (робастен к выбросам)</span>
                          ) : (
                            <span className="badge badge-ok">Ранговый критерий</span>
                          )}
                        </td>
                      </tr>

                      {/* Levene Test */}
                      <tr className="info-row">
                        <td>
                          <strong>Критерий Ливиня</strong>
                          <small>проверка гипотезы о равенстве дисперсий (H₀: σ₁² = σ₂²)</small>
                        </td>
                        <td>F = {testResults.isDegenerate ? "—" : fmt(testResults.fLevene)}</td>
                        <td>1; {n1 + n2 - 2}</td>
                        <td className={testResults.pLevene !== null && testResults.pLevene < 0.05 ? "sig-cell" : ""}>
                          {testResults.isDegenerate ? "—" : fmtP(testResults.pLevene)}
                        </td>
                        <td>Отношение s² = {testResults.isDegenerate ? "—" : Number.isFinite(testResults.varRatio) ? `${fmt(testResults.varRatio, 1)}x` : "∞"}</td>
                        <td>
                          {testResults.isDegenerate || testResults.pLevene === null ? (
                            <span className="badge badge-warning">Дисперсии отсутствуют</span>
                          ) : testResults.pLevene < 0.05 ? (
                            <span className="badge badge-danger">Гетерогенность (p &lt; .05)</span>
                          ) : (
                            <span className="badge badge-ok">H₀ не отвергнута (p ≥ .05)</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Educational Verdict Alert */}
                <div className={`dynamic-verdict ${testResults.isDegenerate ? "alert-viol" : testResults.pLevene !== null && testResults.pLevene < 0.05 ? "alert-viol" : "alert-ok"}`}>
                  <div className="verdict-icon">💡</div>
                  <div className="verdict-text">
                    <strong>
                      {testResults.isDegenerate
                        ? "Критерии Стьюдента, Уэлча и Ливиня не применимы: обе выборки константны (s² = 0)"
                        : testResults.pLevene !== null && testResults.pLevene < 0.05
                        ? "Обнаружены статистически значимые различия выборочных дисперсий (p < 0.05)"
                        : "Критерий Ливиня незначим (p ≥ 0.05): нет оснований отвергать H₀"}
                    </strong>
                    <p>
                      {testResults.isDegenerate
                        ? "В обеих группах все наблюдения имеют одинаковые значения, поэтому выборочная дисперсия и стандартная ошибка равны нулю. Деление на нулевую ошибку математически не определено. Для параметрического анализа данных необходима изменчивость признака в выборках."
                        : testResults.pLevene !== null && testResults.pLevene < 0.05
                        ? `Отношение выборочных дисперсий составляет ${Number.isFinite(testResults.varRatio) ? fmt(testResults.varRatio, 1) + ":1" : "∞"} (F = ${fmt(testResults.fLevene)}, p Ливиня ${fmtP(testResults.pLevene)}). Классический t Стьюдента чувствителен к нарушению гомогенности дисперсий, особенно при разных объемах групп. Рекомендуется опираться на t Уэлча (p ${fmtP(testResults.pWelch)}) или ранговый критерий Манна — Уитни (p ${fmtP(testResults.pU)}).`
                        : `Разница выборочных дисперсий не достигла статистической значимости (p Ливиня ${fmtP(testResults.pLevene)}). Методологическое примечание: сохранение H₀ не доказывает строгое равенство дисперсий (при малых n критерий Ливиня имеет низкую мощность). Согласно современным методологическим публикациям (Delacre et al., 2017), t-критерий Уэлча безопасен для применения по умолчанию: при равенстве дисперсий он практически не уступает по мощности Стьюденту, а при скрытом неравенстве защищает от ложноположительных выводов.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* TAB: PAIRED SAMPLES LAB (BEFORE / AFTER WITHIN-SUBJECT) */}
      {/* ======================================================== */}
      {activeTab === "paired" && (
        <div className="sandbox-panel">
          {/* Presets row */}
          <div className="presets-bar">
            <span className="presets-label">УЧЕБНЫЕ СЦЕНАРИИ «ДО / ПОСЛЕ»:</span>
            <div className="presets-list">
              {PAIRED_SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-btn ${activePairedPreset === preset.id ? "active" : ""}`}
                  onClick={() => applyPairedPreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                className="preset-btn rand-btn"
                onClick={() => setPairedSeed((s) => s + 1)}
              >
                ↻ Случайная генерация
              </button>
            </div>
          </div>

          <div className="sandbox-grid paired-sample-grid">
            {/* Left Controls column */}
            <div className="controls-column">
              <div className="sample-control-card">
                <div className="card-header">
                  <span className="group-badge">МОДЕЛИРОВАНИЕ ПОВТОРНЫХ ИЗМЕРЕНИЙ</span>
                  <small>n = {pairedN} пар участников</small>
                </div>

                <div className="slider-group">
                  <label>
                    <div className="slider-title">
                      <span>Число участников / пар (n)</span>
                      <strong>{pairedN}</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={pairedN}
                      onChange={(e) => {
                        setPairedN(Number(e.target.value));
                        setActivePairedPreset("custom");
                      }}
                    />
                    <small>Каждый участник измеряется дважды: «До» и «После»</small>
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Среднее изменение (ΔM = После − До)</span>
                      <strong>{fmt(pairedMeanDiff, 1)}</strong>
                    </div>
                    <input
                      type="range"
                      min={-25}
                      max={25}
                      step={0.5}
                      value={pairedMeanDiff}
                      onChange={(e) => {
                        setPairedMeanDiff(Number(e.target.value));
                        setActivePairedPreset("custom");
                      }}
                    />
                    <small>Отрицательный сдвиг — снижение (напр., симптомов), положительный — прирост</small>
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Базовый средний уровень (До)</span>
                      <strong>{fmt(pairedMBase, 0)}</strong>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={500}
                      step={5}
                      value={pairedMBase}
                      onChange={(e) => {
                        setPairedMBase(Number(e.target.value));
                        setActivePairedPreset("custom");
                      }}
                    />
                    <small>Исходный уровень шкалы до воздействия</small>
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Базовый разброс участников (SD)</span>
                      <strong>{fmt(pairedSdBase, 0)}</strong>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={60}
                      step={1}
                      value={pairedSdBase}
                      onChange={(e) => {
                        setPairedSdBase(Number(e.target.value));
                        setActivePairedPreset("custom");
                      }}
                    />
                    <small>Межиндивидуальные различия в генеральной совокупности</small>
                  </label>

                  <label>
                    <div className="slider-title">
                      <span>Связь измерений (корреляция r)</span>
                      <strong>{fmt(pairedR, 2)}</strong>
                    </div>
                    <input
                      type="range"
                      min={-0.5}
                      max={0.95}
                      step={0.05}
                      value={pairedR}
                      onChange={(e) => {
                        setPairedR(Number(e.target.value));
                        setActivePairedPreset("custom");
                      }}
                    />
                    <small>Высокий r устраняет индивидуальный шум и снижает SE разностей</small>
                  </label>

                  <label className="checkbox-control">
                    <input
                      type="checkbox"
                      checked={pairedConstantDiff}
                      onChange={(e) => {
                        setPairedConstantDiff(e.target.checked);
                        setActivePairedPreset("custom");
                      }}
                    />
                    <span>Нулевой разброс разностей (s_D = 0, все сдвинулись строго одинаково)</span>
                  </label>
                </div>
              </div>

              {/* Actions card */}
              <div className="card-actions">
                <button type="button" className="action-btn" onClick={handleExportPairedCsv}>
                  📥 Экспорт парной выборки (CSV)
                </button>
                <button type="button" className="action-btn" onClick={handleCopyPairedSpss}>
                  {pairedSpssCopied ? "✓ Синтаксис SPSS скопирован!" : "📋 Скопировать синтаксис SPSS для парного t"}
                </button>
                <a href="/guides#paired-t" className="action-btn spss-guide-btn">
                  📖 Перейти к гайду SPSS: парный t-тест →
                </a>
              </div>
            </div>

            {/* Right Analytics and Charts column */}
            <div className="analytics-column">
              {/* Spaghetti Plot Card */}
              <div className="chart-card spaghetti-chart-card">
                <div className="chart-header">
                  <div>
                    <span className="chart-title">ИНДИВИДУАЛЬНЫЕ ТРАЕКТОРИИ УЧАСТНИКОВ (SPAGHETTI PLOT)</span>
                    <small>Соединение точек одного и того же человека «До» и «После»</small>
                  </div>
                  <span className="badge badge-simulated">МОДЕЛИРОВАННЫЕ ДАННЫЕ</span>
                </div>

                <div className="chart-wrapper">
                  {(() => {
                    const allVals = pairedData.flatMap((p) => [p.before, p.after]);
                    const minV = Math.min(...allVals);
                    const maxV = Math.max(...allVals);
                    const span = (maxV - minV) || 1;
                    const yScale = (v: number) => 240 - ((v - minV) / span) * 190;
                    const xBefore = 120;
                    const xAfter = 480;

                    return (
                      <svg
                        viewBox="0 0 600 280"
                        className="paired-svg"
                        role="img"
                        aria-label="График индивидуальных траекторий участников до и после экспериментального воздействия"
                      >
                        {/* Axes and Grid */}
                        <line x1={xBefore} y1={25} x2={xBefore} y2={255} stroke="var(--line)" strokeWidth={2} />
                        <line x1={xAfter} y1={25} x2={xAfter} y2={255} stroke="var(--line)" strokeWidth={2} />

                        {/* Axis Labels */}
                        <text x={xBefore} y={18} textAnchor="middle" fill="var(--ink)" fontSize={11} fontWeight="bold">
                          ДО ЗАМЕРА
                        </text>
                        <text x={xAfter} y={18} textAnchor="middle" fill="var(--ink)" fontSize={11} fontWeight="bold">
                          ПОСЛЕ ЗАМЕРА
                        </text>

                        {/* Individual Participant Lines */}
                        {pairedData.map((p) => {
                          const y1 = yScale(p.before);
                          const y2 = yScale(p.after);
                          const color = p.diff < -0.1 ? "#524ba7" : p.diff > 0.1 ? "#e9b44c" : "#94a3b8";
                          return (
                            <g key={p.id} className="participant-trajectory">
                              <line
                                x1={xBefore}
                                y1={y1}
                                x2={xAfter}
                                y2={y2}
                                stroke={color}
                                strokeWidth={1.4}
                                strokeOpacity={0.4}
                              />
                              <circle cx={xBefore} cy={y1} r={3} fill={color} opacity={0.6} />
                              <circle cx={xAfter} cy={y2} r={3} fill={color} opacity={0.6} />
                            </g>
                          );
                        })}

                        {/* Mean Trajectory Bold Line */}
                        <line
                          x1={xBefore}
                          y1={yScale(pairedResults.meanBefore)}
                          x2={xAfter}
                          y2={yScale(pairedResults.meanAfter)}
                          stroke="#b23a48"
                          strokeWidth={4.5}
                        />
                        <circle
                          cx={xBefore}
                          cy={yScale(pairedResults.meanBefore)}
                          r={6.5}
                          fill="#b23a48"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                        <circle
                          cx={xAfter}
                          cy={yScale(pairedResults.meanAfter)}
                          r={6.5}
                          fill="#b23a48"
                          stroke="#fff"
                          strokeWidth={2}
                        />

                        {/* Mean labels */}
                        <text
                          x={xBefore - 12}
                          y={yScale(pairedResults.meanBefore) + 4}
                          textAnchor="end"
                          fill="#b23a48"
                          fontSize={11}
                          fontWeight="bold"
                        >
                          M₁ = {fmt(pairedResults.meanBefore, 1)}
                        </text>
                        <text
                          x={xAfter + 12}
                          y={yScale(pairedResults.meanAfter) + 4}
                          textAnchor="start"
                          fill="#b23a48"
                          fontSize={11}
                          fontWeight="bold"
                        >
                          M₂ = {fmt(pairedResults.meanAfter, 1)}
                        </text>

                        {/* Delta indicator */}
                        <g transform={`translate(300, ${yScale((pairedResults.meanBefore + pairedResults.meanAfter) / 2) - 14})`}>
                          <rect x={-45} y={-10} width={90} height={20} rx={10} fill="#b23a48" />
                          <text x={0} y={4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold">
                            Δ = {fmt(pairedResults.meanDiff, 1)}
                          </text>
                        </g>
                      </svg>
                    );
                  })()}
                </div>

                <div className="paired-chart-legend">
                  <div className="legend-item">
                    <span className="legend-line line-decreased"></span>
                    <span>Снижение ({pairedData.filter((p) => p.diff < -0.1).length} чел.)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-line line-increased"></span>
                    <span>Прирост ({pairedData.filter((p) => p.diff > 0.1).length} чел.)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-line line-mean"></span>
                    <span>Средний тренд выборки (ΔM = {fmt(pairedResults.meanDiff, 2)})</span>
                  </div>
                </div>
              </div>

              {/* Differences Distribution & 95% CI Card */}
              <div className="chart-card diff-chart-card">
                <div className="chart-header">
                  <div>
                    <span className="chart-title">РАСПРЕДЕЛЕНИЕ РАЗНОСТЕЙ (D = ПОСЛЕ − ДО) И 95% ДОВЕРИТЕЛЬНЫЙ ИНТЕРВАЛ</span>
                    <small>Основа парного критерия: анализ одной выборки внутрииндивидуальных сдвигов</small>
                  </div>
                </div>

                <div className="chart-wrapper">
                  {(() => {
                    const diffs = pairedData.map((p) => p.diff);
                    const ciLow = pairedResults.ciLower ?? 0;
                    const ciHigh = pairedResults.ciUpper ?? 0;
                    const minD = Math.min(0, ...diffs, ciLow) - 2;
                    const maxD = Math.max(0, ...diffs, ciHigh) + 2;
                    const spanD = (maxD - minD) || 1;
                    const yScaleD = (d: number) => 180 - ((d - minD) / spanD) * 150;
                    const zeroY = yScaleD(0);

                    return (
                      <svg
                        viewBox="0 0 600 210"
                        className="diff-svg"
                        role="img"
                        aria-label="Распределение индивидуальных разностей и 95% доверительный интервал среднего изменения"
                      >
                        {/* H0 Zero Reference Line */}
                        <line x1={40} y1={zeroY} x2={560} y2={zeroY} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} />
                        <text x={45} y={zeroY - 6} fill="#dc2626" fontSize={10} fontWeight="bold">
                          H₀: Δ = 0 (нулевой эффект)
                        </text>

                        {/* Individual Difference Points with horizontal jitter */}
                        {pairedData.map((p) => {
                          const y = yScaleD(p.diff);
                          const x = 160 + Math.sin(p.id * 4.3) * 70;
                          const color = p.diff < -0.1 ? "#524ba7" : p.diff > 0.1 ? "#e9b44c" : "#94a3b8";
                          return <circle key={p.id} cx={x} cy={y} r={3.5} fill={color} opacity={0.65} />;
                        })}
                        <text x={160} y={202} textAnchor="middle" fill="var(--muted)" fontSize={10}>
                          Индивидуальные разности Dᵢ (n = {pairedN})
                        </text>

                        {/* 95% CI Whiskers and Mean Dot */}
                        {pairedResults.ciLower !== null && pairedResults.ciUpper !== null && (
                          <g className="ci-block">
                            <line
                              x1={440}
                              y1={yScaleD(pairedResults.ciLower)}
                              x2={440}
                              y2={yScaleD(pairedResults.ciUpper)}
                              stroke="#524ba7"
                              strokeWidth={3}
                            />
                            <line
                              x1={425}
                              y1={yScaleD(pairedResults.ciUpper)}
                              x2={455}
                              y2={yScaleD(pairedResults.ciUpper)}
                              stroke="#524ba7"
                              strokeWidth={2}
                            />
                            <line
                              x1={425}
                              y1={yScaleD(pairedResults.ciLower)}
                              x2={455}
                              y2={yScaleD(pairedResults.ciLower)}
                              stroke="#524ba7"
                              strokeWidth={2}
                            />
                            <circle
                              cx={440}
                              cy={yScaleD(pairedResults.meanDiff)}
                              r={6}
                              fill="#524ba7"
                              stroke="#fff"
                              strokeWidth={2}
                            />

                            <text
                              x={465}
                              y={yScaleD(pairedResults.meanDiff) + 4}
                              fill="#524ba7"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              ΔM = {fmt(pairedResults.meanDiff, 2)}
                            </text>
                            <text
                              x={465}
                              y={yScaleD(pairedResults.ciUpper) + 4}
                              fill="var(--ink)"
                              fontSize={9}
                            >
                              ВГ: {fmt(pairedResults.ciUpper, 2)}
                            </text>
                            <text
                              x={465}
                              y={yScaleD(pairedResults.ciLower) + 4}
                              fill="var(--ink)"
                              fontSize={9}
                            >
                              НГ: {fmt(pairedResults.ciLower, 2)}
                            </text>
                            <text x={440} y={202} textAnchor="middle" fill="var(--muted)" fontSize={10}>
                              95% ДИ среднего изменения
                            </text>
                          </g>
                        )}
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* Battle Table: Paired vs Mistaken Independent */}
              <div className="battle-table-card">
                <div className="battle-header">
                  <span>БИТВА МОДЕЛЕЙ: ПАРНЫЙ КРИТЕРИЙ VS ОШИБОЧНЫЙ НЕЗАВИСИМЫЙ</span>
                  <small>Выигрыш мощности за счёт контроля межиндивидуальной вариативности</small>
                </div>

                <div className="battle-table-wrapper">
                  <table className="battle-table">
                    <thead>
                      <tr>
                        <th>Модель анализа</th>
                        <th>Статистика t</th>
                        <th>df</th>
                        <th>p-значение</th>
                        <th>95% ДИ изменения</th>
                        <th>Размер эффекта</th>
                        <th>Статус надёжности</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="highlight-row">
                        <td>
                          <strong>Парный t-критерий</strong>
                          <small>вычитает индивидуальные уровни участников</small>
                        </td>
                        <td>{pairedResults.isDegenerate ? "—" : `t = ${fmt(pairedResults.tVal, 2)}`}</td>
                        <td>{pairedResults.df}</td>
                        <td className="sig-cell">{fmtP(pairedResults.pVal)}</td>
                        <td>
                          {pairedResults.isDegenerate
                            ? `[${fmt(pairedResults.meanDiff)}; ${fmt(pairedResults.meanDiff)}]`
                            : `[${fmt(pairedResults.ciLower, 2)}; ${fmt(pairedResults.ciUpper, 2)}]`}
                        </td>
                        <td>{pairedResults.isDegenerate ? "—" : `d_z = ${fmt(pairedResults.cohenDz, 2)}`}</td>
                        <td>
                          {pairedResults.isDegenerate ? (
                            <span className="badge badge-warning">Разброс равен 0</span>
                          ) : (
                            <span className="badge badge-recommended">Рекомендуемый (парный дизайн)</span>
                          )}
                        </td>
                      </tr>
                      <tr className="risky-row">
                        <td>
                          <strong>Ошибочный независимый t</strong>
                          <small>если забыть, что это одни и те же люди</small>
                        </td>
                        <td>
                          {pairedResults.independentContrast?.tIndep !== null
                            ? `t = ${fmt(pairedResults.independentContrast?.tIndep, 2)}`
                            : "—"}
                        </td>
                        <td>{pairedResults.independentContrast?.dfIndep ?? "—"}</td>
                        <td>{fmtP(pairedResults.independentContrast?.pIndep)}</td>
                        <td>—</td>
                        <td>d_av = {fmt(pairedResults.cohenDav, 2)}</td>
                        <td>
                          <span className="badge badge-warning">
                            {pairedResults.independentContrast
                              ? `SE завышен на +${fmt(pairedResults.independentContrast.seReductionPct, 0)}%`
                              : "Неприменимо"}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Verdict note */}
                <div
                  className={`dynamic-verdict ${
                    pairedResults.isDegenerate
                      ? "alert-viol"
                      : pairedResults.pVal !== null && pairedResults.pVal < 0.05
                      ? "alert-ok"
                      : "alert-viol"
                  }`}
                >
                  <div className="verdict-icon">💡</div>
                  <div className="verdict-text">
                    <strong>
                      {pairedResults.isDegenerate
                        ? "Разброс разностей равен нулю (s_D = 0): все участники изменились на абсолютно одинаковую величину"
                        : pairedResults.pVal !== null && pairedResults.pVal < 0.05
                        ? `Обнаружен статистически значимый внутрииндивидуальный сдвиг (p ${fmtP(pairedResults.pVal)})`
                        : "Нет статистически значимых оснований отвергать H₀ об отсутствии сдвига"}
                    </strong>
                    <p>
                      {pairedResults.isDegenerate
                        ? "В этой ситуации деление на стандартную ошибку SE_D = 0 математически неопределено. Классический t-критерий Стьюдента неприменим, так как стохастическая неопределенность разностей отсутствует."
                        : `Парная корреляция между замерами r = ${fmt(pairedResults.r, 2)}. ` +
                          (pairedResults.r !== null && pairedResults.r > 0
                            ? `Положительная корреляция позволила устранить стабильные межиндивидуальные различия и снизить стандартную ошибку разностей на ${fmt(pairedResults.independentContrast?.seReductionPct, 0)}% по сравнению с независимым анализом!`
                            : "При низкой или отрицательной корреляции парный дизайн теряет преимущество в мощности.")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Methodological Causality Warning Card */}
              <div className="methodological-notes-card">
                <div className="method-note-item">
                  <strong>⚠️ Методологическое ограничение: дизайн «До / После» в одной группе не доказывает причинно-следственную связь</strong>
                  <p>
                    Статистическая значимость изменения в парном t-тесте констатирует наличие внутрииндивидуального сдвига,
                    но <strong>не позволяет утверждать, что причиной изменения было именно ваше воздействие</strong> (тренинг, терапия, диета).
                    Наблюдаемый эффект может объясняться альтернативными факторами:
                  </p>
                  <ul className="method-notes-list">
                    <li>
                      <strong>Регрессия к среднему (Regression to the mean):</strong> участники, отобранные по крайним высоким
                      баллам тревожности/депрессии, при повторном замере статистически неизбежно демонстрируют более умеренные
                      баллы даже без какого-либо лечения (Galton, 1886; Campbell &amp; Stanley, 1963).
                    </li>
                    <li>
                      <strong>Эффект тестирования (Testing effect):</strong> повторное прохождение того же опросника или теста
                      вызывает научение, привыкание или эффект социальной желательности.
                    </li>
                    <li>
                      <strong>Спонтанная ремиссия и естественное созревание:</strong> многие психологические трудности
                      сглаживаются со временем в силу адаптационных ресурсов психики.
                    </li>
                    <li>
                      <strong>Плацебо и эффект Хоторна:</strong> факт включения в исследование и внимание психолога сами по себе
                      улучшают эмоциональное состояние.
                    </li>
                  </ul>
                  <p className="method-notes-conclusion">
                    🔬 <em>Для доказательства каузальности необходим рандомизированный контролируемый эксперимент (РКИ / RCT) с отдельной
                    контрольной группой (например, лист ожидания) и анализ межгруппового взаимодействия «Группа × Время» через смешанный ANOVA.</em>
                  </p>
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

                                    <fieldset className="segmented-control">
                    <legend className="segmented-legend">Уровень значимости (α):</legend>
                    <div className="segmented-buttons" role="radiogroup" aria-label="Выбор уровня значимости альфа">
                      {[0.05, 0.01, 0.001].map((alphaVal) => (
                        <label
                          key={alphaVal}
                          htmlFor={`power-alpha-${alphaVal}`}
                          className={`segmented-label ${powerAlpha === alphaVal ? "active" : ""}`}
                        >
                          <input
                            type="radio"
                            id={`power-alpha-${alphaVal}`}
                            name="power-alpha"
                            value={alphaVal}
                            checked={powerAlpha === alphaVal}
                            onChange={() => setPowerAlpha(alphaVal)}
                            onKeyDown={(e) => handleAlphaKeyDown(e, alphaVal)}
                            className="sr-only"
                          />
                          <span>{alphaVal}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="segmented-control">
                    <legend className="segmented-legend">Направление гипотезы:</legend>
                    <div className="segmented-buttons" role="radiogroup" aria-label="Выбор направления гипотезы">
                      <label
                        htmlFor="power-direction-two-tailed"
                        className={`segmented-label ${isTwoTailed ? "active" : ""}`}
                      >
                        <input
                          type="radio"
                          id="power-direction-two-tailed"
                          name="power-direction"
                          value="two-tailed"
                          checked={isTwoTailed}
                          onChange={() => setIsTwoTailed(true)}
                          onKeyDown={(e) => handleDirectionKeyDown(e, true)}
                          className="sr-only"
                        />
                        <span>Двусторонняя (≠)</span>
                      </label>
                      <label
                        htmlFor="power-direction-one-tailed"
                        className={`segmented-label ${!isTwoTailed ? "active" : ""}`}
                      >
                        <input
                          type="radio"
                          id="power-direction-one-tailed"
                          name="power-direction"
                          value="one-tailed"
                          checked={!isTwoTailed}
                          onChange={() => setIsTwoTailed(false)}
                          onKeyDown={(e) => handleDirectionKeyDown(e, false)}
                          className="sr-only"
                        />
                        <span>Односторонняя (&gt;)</span>
                      </label>
                    </div>
                  </fieldset>
                </div>

                <div className="n-recommendation-box">
                  <span className="rec-title">ТРЕБУЕМЫЙ ОБЪЁМ ВЫБОРКИ ПРИ d = {fmt(cohenDInput)}:</span>
                  {powerMetrics.n80 !== null && powerMetrics.n90 !== null ? (
                    <div className="rec-stats">
                      <div>
                        <strong>n = {powerMetrics.n80}</strong>
                        <small>для 80% мощности (N={powerMetrics.n80 * 2})</small>
                      </div>
                      <div>
                        <strong>n = {powerMetrics.n90}</strong>
                        <small>для 90% мощности (N={powerMetrics.n90 * 2})</small>
                      </div>
                    </div>
                  ) : (
                    <div className="rec-stats-zero">
                      <strong>— (Расчёт n не применим при d = 0)</strong>
                      <small>
                        При d = 0 истинный эффект равен нулю (H₀ верна). Мощность строго равна уровню ошибки I рода (α = {(powerAlpha * 100).toFixed(1)}%).
                        Достижение 80% или 90% мощности теоретически невозможно при любом объёме выборки.
                      </small>
                    </div>
                  )}
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
                      {powerMetrics.isZero
                        ? `При d = 0 мощность равна α (${(powerAlpha * 100).toFixed(1)}%)`
                        : powerMetrics.power >= 0.8
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
                    <small>вероятность случайного превосходства (McGraw & Wong, 1992)</small>
                  </div>

                  <div className="metric-box">
                    <span>ПЕРЕКРЫТИЕ (OVL)</span>
                    <strong>{fmt(powerMetrics.overlap, 1)}%</strong>
                    <small>доля общей площади двух распределений (Cohen, 1988)</small>
                  </div>
                </div>

                <div className="psychology-trap-card">
                  <strong>⚠️ Проблема низкой мощности и переоценка эффекта («Проклятие победителя» / Winner’s Curse):</strong>
                  <p>
                    При исследовании маломощных эффектов на малых выборках (например, n = 15 в группе при истинном d = 0,3 мощность составляет ~13%)
                    статистически значимыми оказываются преимущественно те редкие испытания, где выборочная оценка оказалась случайно завышенной из-за стохастического шума.
                    Публикация преимущественно таких завышенных оценок в совокупности с публикационным смещением и практиками исследовательской гибкости
                    (p-hacking, HARKing) рассматривается как один из существенных факторов проблем воспроизводимости в науке (Button et al., 2013; Ioannidis, 2005).
                  </p>
                </div>

                <div className="methodological-notes-card">
                  <div className="method-note-item">
                    <strong>📐 Допущения и расчёт мощности по нецентральному t-распределению (Cohen, 1988; Faul et al., 2007):</strong>
                    <p>
                      Расчёт мощности и минимального объёма выборки n для двухвыборочного критерия Стьюдента основан на
                      численном интегрировании нецентрального t-распределения с числом степеней свободы ν = 2n − 2 и параметром нецентральности
                      δ = |d| √(n / 2) (модель двух сбалансированных независимых групп n₁ = n₂). Метод не полагается на грубую нормальную
                      аппроксимацию и сохраняет математическую строгость при малых n (например, при d = 2 и n = 5 мощность составляет 79,05%,
                      а минимальный объём для достижения 80% мощности равен n = 6).
                      Предпосылки модели: нормальность распределения признака в генеральных совокупностях и гомогенность дисперсий (σ₁² = σ₂²).
                      Расчёт представляет теоретическую мощность при строгом соблюдении этих предпосылок; при наличии асимметрии, выбросов
                      или гетероскедастичности фактическая эмпирическая мощность может существенно снижаться.
                    </p>
                  </div>
                  <div className="method-note-item">
                    <strong>📊 Вероятностные метрики величины эффекта (Cohen, 1988; McGraw &amp; Wong, 1992):</strong>
                    <p>
                      Показатели Cohen’s U₃, CLES (вероятность превосходства) и OVL (коэффициент перекрытия) описывают
                      различия непрерывных распределений на вероятностном языке. Показатель NNT (число лечимых пациентов)
                      в данной непрерывной песочнице исключён: прямой перевод непрерывного d в клинический NNT
                      без эмпирической модели дихотомизации и известного исходного риска контрольной группы (CER)
                      методологически некорректен (Furukawa &amp; Leucht, 2011; Kraemer &amp; Kupfer, 2006).
                    </p>
                  </div>
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
