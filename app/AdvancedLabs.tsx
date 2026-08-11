"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type MethodFamily = "assumptions" | "means" | "ranks" | "relations" | "many" | "models";

type MethodCard = {
  id: string;
  short: string;
  title: string;
  family: MethodFamily;
  use: string;
  h0: string;
  h1: string;
  checks: string;
  trap: string;
  report: string;
  spss: string;
  jamovi: string;
};

const methodCards: MethodCard[] = [
  {
    id: "ks",
    short: "K–S",
    title: "Колмогоров — Смирнов",
    family: "assumptions",
    use: "Сопоставить эмпирическую функцию распределения с полностью заданным непрерывным теоретическим распределением.",
    h0: "Эмпирическое распределение согласуется с заданным теоретическим распределением F₀(x).",
    h1: "Эмпирическое распределение не согласуется с заданным теоретическим распределением F₀(x).",
    checks: "Независимые наблюдения; непрерывное распределение; параметры F₀ заданы заранее или используется подходящая поправка.",
    trap: "Если среднее и SD нормального распределения оценены на этой же выборке, классические критические значения K–S неприменимы напрямую. Для малых выборок часто информативнее Shapiro–Wilk + Q–Q график.",
    report: "D = …; p = …; дополнить Q–Q графиком и описанием формы распределения.",
    spss: "Анализ → Непараметрические критерии → Устаревшие диалоговые окна → 1-выборочный K–S",
    jamovi: "Exploration → Descriptives → Shapiro–Wilk; K–S доступен через дополнительный модуль moretests",
  },
  {
    id: "shapiro",
    short: "W",
    title: "Шапиро — Уилка",
    family: "assumptions",
    use: "Проверить совместимость количественных данных с нормальным распределением.",
    h0: "Данные получены из нормально распределённой совокупности.",
    h1: "Распределение данных отличается от нормального.",
    checks: "Независимые наблюдения; интерпретация вместе с Q–Q графиком, выбросами и объёмом выборки.",
    trap: "При большом n тест замечает микроскопические отклонения, а при малом может не иметь мощности. p > 0,05 не доказывает идеальную нормальность.",
    report: "W = …; p = …; визуальная оценка Q–Q графика: …",
    spss: "Анализ → Описательные статистики → Разведочный анализ → Графики → Проверка нормальности",
    jamovi: "Exploration → Descriptives → Statistics → Shapiro–Wilk; Plots → Q–Q",
  },
  {
    id: "levene",
    short: "Fₗ",
    title: "Ливиня",
    family: "assumptions",
    use: "Проверить гомогенность дисперсий в двух или нескольких независимых группах.",
    h0: "Дисперсии сравниваемых генеральных совокупностей равны: σ₁² = … = σₖ².",
    h1: "Не все генеральные дисперсии равны.",
    checks: "Независимость наблюдений; осмысленные группы; при ненормальности предпочтительна робастная версия на медианах.",
    trap: "Незначимый тест не гарантирует равенство дисперсий. При нарушении не обязательно убегать в ранги: для средних часто подходит тест Уэлча.",
    report: "Fₗ(df₁, df₂) = …; p = …",
    spss: "В независимом t-тесте или One-Way ANOVA → Homogeneity of variance test",
    jamovi: "T-Tests / ANOVA → Assumption Checks → Homogeneity test",
  },
  {
    id: "one-t",
    short: "t₁",
    title: "Одновыборочный t Стьюдента",
    family: "means",
    use: "Сравнить среднее одной выборки с заранее заданным теоретическим или нормативным значением μ₀.",
    h0: "Среднее генеральной совокупности равно заданному значению: μ = μ₀.",
    h1: "Среднее генеральной совокупности не равно заданному значению: μ ≠ μ₀.",
    checks: "Количественная переменная; независимые наблюдения; отсутствие критических выбросов; приблизительная нормальность при малом n.",
    trap: "Норматив μ₀ должен существовать до взгляда на данные. Нельзя выбрать удобное число после анализа.",
    report: "t(df) = …; p = …; M = …; SD = …; d = …; 95% ДИ […; …]",
    spss: "Анализ → Сравнение средних → Одновыборочный t-критерий",
    jamovi: "T-Tests → One Sample T-Test",
  },
  {
    id: "independent-t",
    short: "tᵢ",
    title: "t Стьюдента для независимых",
    family: "means",
    use: "Сравнить средние количественного показателя у двух разных групп людей.",
    h0: "Средние генеральных совокупностей равны: μ₁ = μ₂.",
    h1: "Средние генеральных совокупностей различаются: μ₁ ≠ μ₂.",
    checks: "Независимость групп; выбросы; форма распределений/остатков; гомогенность дисперсий или версия Уэлча.",
    trap: "При неравных дисперсиях и размерах групп используй строку Уэлча, а не механически ранговый тест.",
    report: "t(df) = …; p = …; ΔM = …; d/Hedges g = …; 95% ДИ […; …]",
    spss: "Анализ → Сравнение средних → t-критерий для независимых выборок",
    jamovi: "T-Tests → Independent Samples T-Test",
  },
  {
    id: "welch-t",
    short: "tᵂ",
    title: "t-критерий Уэлча",
    family: "means",
    use: "Сравнить средние двух независимых групп, не предполагая равенство генеральных дисперсий.",
    h0: "Средние генеральных совокупностей равны: μ₁ = μ₂.",
    h1: "Средние генеральных совокупностей различаются: μ₁ ≠ μ₂.",
    checks: "Независимость групп; количественный показатель; выбросы; форма распределений. Степени свободы оцениваются по Уэлчу — Саттертуэйту.",
    trap: "Значимый Ливинь не означает, что сравнение средних запрещено. Часто достаточно использовать Уэлча и корректный доверительный интервал.",
    report: "tᵂ(df) = …; p = …; ΔM = …; Hedges g = …; 95% ДИ […; …]",
    spss: "Independent-Samples T Test → строка Equal variances not assumed",
    jamovi: "T-Tests → Independent Samples T-Test → Welch’s",
  },
  {
    id: "paired-t",
    short: "tₚ",
    title: "Парный t Стьюдента",
    family: "means",
    use: "Сравнить два измерения у тех же людей или у естественно сопоставленных пар.",
    h0: "Среднее парных разностей равно нулю: μΔ = 0.",
    h1: "Среднее парных разностей не равно нулю: μΔ ≠ 0.",
    checks: "Корректное сопоставление пар; количественный показатель; распределение именно разностей; выбросы разностей.",
    trap: "Проверяют нормальность столбца разностей, а не каждого измерения по отдельности.",
    report: "t(df) = …; p = …; MΔ = …; dᶻ = …; 95% ДИ […; …]",
    spss: "Анализ → Сравнение средних → Парный t-критерий",
    jamovi: "T-Tests → Paired Samples T-Test",
  },
  {
    id: "mann-whitney",
    short: "U",
    title: "Манна — Уитни",
    family: "ranks",
    use: "Сравнить две независимые группы по порядковому или количественному показателю без параметрической модели средних.",
    h0: "Распределения показателя в двух генеральных совокупностях одинаковы: P(X > Y) = 0,5 при непрерывных данных.",
    h1: "Распределения различаются; вероятность превосходства отличается от 0,5.",
    checks: "Независимость; минимум порядковая шкала; форма распределений, если вывод формулируется как сдвиг положения.",
    trap: "U не является универсальным «тестом медиан». Медианный вывод требует сопоставимой формы распределений.",
    report: "U = …; z = …; p = …; r или rank-biserial r = …",
    spss: "Анализ → Непараметрические критерии → Независимые выборки",
    jamovi: "T-Tests → Independent Samples T-Test → Mann–Whitney U",
  },
  {
    id: "wilcoxon",
    short: "W",
    title: "Уилкоксона",
    family: "ranks",
    use: "Сравнить два связанных измерения по порядковому или проблемному количественному показателю.",
    h0: "Распределение парных разностей симметрично относительно нуля.",
    h1: "Распределение парных разностей смещено относительно нуля.",
    checks: "Связанные пары; минимум порядковая шкала; независимость пар; для обычной интерпретации — симметрия разностей.",
    trap: "Фраза «сдвиги не отличаются в группах» слишком расплывчата: здесь одна система парных разностей.",
    report: "W/V = …; z = …; p = …; rank-biserial r = …",
    spss: "Анализ → Непараметрические критерии → Связанные выборки",
    jamovi: "T-Tests → Paired Samples T-Test → Wilcoxon rank",
  },
  {
    id: "pearson",
    short: "r",
    title: "Корреляция Пирсона",
    family: "relations",
    use: "Оценить направление и силу линейной связи двух количественных переменных.",
    h0: "Линейная корреляция в генеральной совокупности равна нулю: ρ = 0.",
    h1: "Линейная корреляция в генеральной совокупности не равна нулю: ρ ≠ 0.",
    checks: "Линейность; выбросы и влиятельные точки; независимость; для p и ДИ — бивариатная нормальность/робастность.",
    trap: "r = 0 не означает отсутствия любой связи: она может быть сильной, но нелинейной. Корреляция не доказывает причинность.",
    report: "r(df) = …; p = …; 95% ДИ […; …]",
    spss: "Анализ → Корреляции → Парные → Pearson",
    jamovi: "Regression → Correlation Matrix → Pearson",
  },
  {
    id: "spearman",
    short: "ρₛ",
    title: "Корреляция Спирмена",
    family: "relations",
    use: "Оценить монотонную связь порядковых или количественных переменных по рангам.",
    h0: "Ранговая/монотонная ассоциация в генеральной совокупности равна нулю: ρₛ = 0.",
    h1: "Монотонная ассоциация в генеральной совокупности не равна нулю: ρₛ ≠ 0.",
    checks: "Минимум порядковые данные; монотонная форма связи; выбросы и множество совпадающих рангов.",
    trap: "Спирмен не чинит немонотонную зависимость. Сначала диаграмма рассеяния, потом коэффициент.",
    report: "ρₛ = …; p = …; 95% ДИ […; …] при наличии",
    spss: "Анализ → Корреляции → Парные → Spearman",
    jamovi: "Regression → Correlation Matrix → Spearman",
  },
  {
    id: "kendall",
    short: "τ",
    title: "Корреляция Кендалла",
    family: "relations",
    use: "Оценить порядковую согласованность через долю согласованных и несогласованных пар; полезно при малом n и совпадающих рангах.",
    h0: "Порядковая ассоциация в генеральной совокупности равна нулю: τ = 0.",
    h1: "Порядковая ассоциация в генеральной совокупности не равна нулю: τ ≠ 0.",
    checks: "Порядковые данные; независимость наблюдений; учитывать ties и выбранный вариант τ.",
    trap: "Числа τ и ρₛ нельзя сравнивать как две версии одной шкалы силы: у них разная метрическая интерпретация.",
    report: "τᵦ = …; p = …; 95% ДИ […; …] при наличии",
    spss: "Анализ → Корреляции → Парные → Kendall’s tau-b",
    jamovi: "Regression → Correlation Matrix → Kendall’s tau-b",
  },
  {
    id: "anova",
    short: "F",
    title: "Однофакторный ANOVA",
    family: "many",
    use: "Сравнить средние количественного отклика в трёх и более независимых группах.",
    h0: "Все генеральные средние равны: μ₁ = μ₂ = … = μₖ.",
    h1: "Хотя бы одно генеральное среднее отличается от другого.",
    checks: "Независимость; остатки; выбросы; гомогенность дисперсий или ANOVA Уэлча; план пост-хок сравнений.",
    trap: "Значимый F не говорит, какие именно группы различаются. Нужны post hoc/контрасты и поправка за множественность.",
    report: "F(df₁, df₂) = …; p = …; η²/ω² = …; post hoc: …",
    spss: "Анализ → Сравнение средних → Однофакторный дисперсионный анализ",
    jamovi: "ANOVA → One-Way ANOVA",
  },
  {
    id: "kruskal",
    short: "H",
    title: "Краскела — Уоллиса",
    family: "many",
    use: "Сравнить три и более независимые группы по порядковому или количественному показателю с ранговой моделью.",
    h0: "Распределения показателя во всех генеральных совокупностях одинаковы.",
    h1: "Хотя бы одно распределение отличается.",
    checks: "Независимые группы; минимум порядковая шкала; форма распределений для интерпретации различий положения.",
    trap: "Значимый H не показывает, где различие. Нужны попарные сравнения Данна с корректировкой p.",
    report: "H(df) = …; p = …; ε² = …; Dunn–Holm/Bonferroni: …",
    spss: "Анализ → Непараметрические критерии → Независимые выборки",
    jamovi: "ANOVA → Non-Parametric → One-Way ANOVA (Kruskal–Wallis)",
  },
  {
    id: "friedman",
    short: "χ²ᶠ",
    title: "Фридмана",
    family: "many",
    use: "Сравнить три и более связанных измерения по порядковой или проблемной количественной шкале.",
    h0: "Распределения/средние ранги связанных условий одинаковы.",
    h1: "Хотя бы одно условие отличается.",
    checks: "Те же участники во всех условиях; минимум порядковая шкала; корректная структура пропусков.",
    trap: "После общего теста нужны парные Уилкоксоны с поправкой и размер согласованности Kendall’s W.",
    report: "χ²ᶠ(df) = …; p = …; Kendall’s W = …",
    spss: "Анализ → Непараметрические критерии → Связанные выборки",
    jamovi: "ANOVA → Non-Parametric → Repeated Measures ANOVA (Friedman)",
  },
  {
    id: "welch-anova",
    short: "Fᵂ",
    title: "ANOVA Уэлча",
    family: "many",
    use: "Сравнить средние трёх и более независимых групп при неодинаковых дисперсиях и/или несбалансированных размерах групп.",
    h0: "Все генеральные средние равны: μ₁ = μ₂ = … = μₖ.",
    h1: "Хотя бы одно генеральное среднее отличается.",
    checks: "Независимость; количественный отклик; выбросы и форма распределений. После значимого теста — Games–Howell.",
    trap: "Уэлч решает проблему неодинаковых дисперсий, но не превращает зависимые наблюдения в независимые и не лечит грубые выбросы.",
    report: "Fᵂ(df₁, df₂) = …; p = …; ω² = …; Games–Howell: …",
    spss: "One-Way ANOVA → Options → Welch; Post Hoc → Games–Howell",
    jamovi: "ANOVA → One-Way ANOVA → Don’t assume equal variances",
  },
  {
    id: "chi-square",
    short: "χ²",
    title: "χ² Пирсона",
    family: "relations",
    use: "Проверить связь двух категориальных переменных в таблице сопряжённости.",
    h0: "Категориальные переменные статистически независимы в генеральной совокупности.",
    h1: "Категориальные переменные связаны в генеральной совокупности.",
    checks: "Независимые наблюдения; взаимоисключающие категории; ожидаемые частоты. Для 2×2 при малых частотах — точный тест Фишера.",
    trap: "Значимый χ² не показывает, какие ячейки создали связь и насколько она сильна. Смотри стандартизированные остатки и V Крамера.",
    report: "χ²(df, N = …) = …; p = …; V Крамера = …; значимые ячейки: …",
    spss: "Анализ → Описательные статистики → Таблицы сопряжённости → Statistics / Cells",
    jamovi: "Frequencies → Contingency Tables → Independent Samples",
  },
  {
    id: "two-way-anova",
    short: "F×F",
    title: "Двухфакторный ANOVA",
    family: "models",
    use: "Оценить два главных эффекта и их взаимодействие для количественного отклика.",
    h0: "Отдельно формулируются H₀ для фактора A, фактора B и взаимодействия A×B: соответствующие эффекты равны нулю.",
    h1: "Хотя бы один уровень фактора различается и/или эффект одного фактора зависит от уровня другого.",
    checks: "Независимость; остатки; гомогенность дисперсий; достаточное число наблюдений в каждой ячейке; баланс дизайна.",
    trap: "При значимом взаимодействии главные эффекты без анализа простых эффектов могут вводить в заблуждение.",
    report: "A: F(df₁, df₂) = …; p = …; ηp² = …; B: …; A×B: …; простые эффекты: …",
    spss: "Анализ → Общая линейная модель → Одномерная",
    jamovi: "ANOVA → ANOVA → Fixed Factors / Model Terms",
  },
  {
    id: "linear-regression",
    short: "R²",
    title: "Линейная регрессия",
    family: "models",
    use: "Оценить связь количественного отклика с одним или несколькими предикторами и построить модель предсказания.",
    h0: "Для конкретного предиктора: его генеральный коэффициент равен нулю, βⱼ = 0. Для модели: все slope-коэффициенты равны нулю.",
    h1: "Хотя бы один проверяемый коэффициент отличается от нуля.",
    checks: "Линейность; независимость ошибок; гомоскедастичность; остатки; влиятельные наблюдения; мультиколлинеарность.",
    trap: "Нормальность требуется не от каждого предиктора, а рассматривается для ошибок модели при выводе. Высокий R² не доказывает причинность.",
    report: "F(df₁, df₂) = …; p = …; R²adj = …; b = …; β = …; 95% ДИ […; …]",
    spss: "Анализ → Регрессия → Линейная",
    jamovi: "Regression → Linear Regression",
  },
];

const familyLabels: Array<["all" | MethodFamily, string]> = [
  ["all", "Все"],
  ["assumptions", "Предпосылки"],
  ["means", "Средние"],
  ["ranks", "Ранги"],
  ["relations", "Связи"],
  ["many", "3+ условий"],
  ["models", "Модели"],
];

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function standardizedNormalSeries(n: number, seed: number) {
  const random = seededRandom(seed);
  const values: number[] = [];
  while (values.length < n) {
    const u1 = Math.max(random(), 0.00001);
    const u2 = random();
    values.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
  return values.map((value) => (value - mean) / sd);
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099;
  const shifted = value - 1;
  coefficients.forEach((coefficient, index) => {
    x += coefficient / (shifted + index + 1);
  });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a: number, b: number, x: number) {
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
  for (let m = 1; m <= maxIterations; m += 1) {
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

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a;
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

function fSurvival(f: number, df1: number, df2: number) {
  if (!Number.isFinite(f) || f < 0) return 1;
  const x = (df1 * f) / (df1 * f + df2);
  return Math.max(0, Math.min(1, 1 - regularizedBeta(x, df1 / 2, df2 / 2)));
}

function buildAnova(means: number[], spread: number, n: number) {
  const groups = means.map((targetMean, index) =>
    standardizedNormalSeries(n, 101 + index * 19).map((z) => targetMean + z * spread),
  );
  const all = groups.flat();
  const grandMean = all.reduce((sum, value) => sum + value, 0) / all.length;
  const groupMeans = groups.map((group) => group.reduce((sum, value) => sum + value, 0) / group.length);
  const variances = groups.map((group, index) =>
    group.reduce((sum, value) => sum + (value - groupMeans[index]) ** 2, 0) / (group.length - 1),
  );
  const ssBetween = groups.reduce((sum, group, index) => sum + group.length * (groupMeans[index] - grandMean) ** 2, 0);
  const ssWithin = groups.reduce(
    (outer, group, index) => outer + group.reduce((sum, value) => sum + (value - groupMeans[index]) ** 2, 0),
    0,
  );
  const dfBetween = groups.length - 1;
  const dfWithin = all.length - groups.length;
  const f = (ssBetween / dfBetween) / (ssWithin / dfWithin);
  const p = fSurvival(f, dfBetween, dfWithin);
  const etaSquared = ssBetween / (ssBetween + ssWithin);
  const omegaSquared = Math.max(0, (ssBetween - dfBetween * (ssWithin / dfWithin)) / (ssBetween + ssWithin + ssWithin / dfWithin));
  return { groups, groupMeans, variances, grandMean, ssBetween, ssWithin, dfBetween, dfWithin, f, p, etaSquared, omegaSquared };
}

function normalCdf(z: number) {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

type Point = { x: number; y: number; id: number };

const clusterPoints: Point[] = (() => {
  const random = seededRandom(3341);
  const centers = [
    [22, 25],
    [41, 31],
    [28, 74],
    [47, 78],
  ];
  return centers.flatMap(([cx, cy], group) =>
    Array.from({ length: 10 }, (_, index) => ({
      id: group * 10 + index,
      x: cx + (random() - 0.5) * 11,
      y: cy + (random() - 0.5) * 24,
    })),
  );
})();

function standardizePoints(points: Point[]) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sdX = Math.sqrt(points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) / (points.length - 1));
  const sdY = Math.sqrt(points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0) / (points.length - 1));
  return points.map((point) => ({ ...point, x: (point.x - meanX) / sdX, y: (point.y - meanY) / sdY }));
}

function distance(a: Pick<Point, "x" | "y">, b: Pick<Point, "x" | "y">) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function kMeans(source: Point[], k: number) {
  const initialIndexes = [0, 10, 20, 30, 6, 16];
  let centroids = initialIndexes.slice(0, k).map((index) => ({ x: source[index].x, y: source[index].y }));
  let assignments = source.map(() => 0);
  for (let iteration = 0; iteration < 18; iteration += 1) {
    assignments = source.map((point) => {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, index) => {
        const candidate = distance(point, centroid);
        if (candidate < bestDistance) {
          best = index;
          bestDistance = candidate;
        }
      });
      return best;
    });
    centroids = centroids.map((centroid, index) => {
      const members = source.filter((_, pointIndex) => assignments[pointIndex] === index);
      if (!members.length) return centroid;
      return {
        x: members.reduce((sum, point) => sum + point.x, 0) / members.length,
        y: members.reduce((sum, point) => sum + point.y, 0) / members.length,
      };
    });
  }
  const wcss = source.reduce((sum, point, index) => sum + distance(point, centroids[assignments[index]]) ** 2, 0);
  return { centroids, assignments, wcss };
}

function silhouette(points: Point[], assignments: number[]) {
  const values = points.map((point, pointIndex) => {
    const own = assignments[pointIndex];
    const ownPoints = points.filter((_, index) => assignments[index] === own && index !== pointIndex);
    const a = ownPoints.length ? ownPoints.reduce((sum, candidate) => sum + distance(point, candidate), 0) / ownPoints.length : 0;
    const clusters = [...new Set(assignments)].filter((cluster) => cluster !== own);
    const b = Math.min(
      ...clusters.map((cluster) => {
        const others = points.filter((_, index) => assignments[index] === cluster);
        return others.reduce((sum, candidate) => sum + distance(point, candidate), 0) / others.length;
      }),
    );
    return (b - a) / Math.max(a, b || 1);
  });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatP(p: number) {
  if (p < 0.001) return "< 0,001";
  return `= ${p.toFixed(3).replace(".", ",")}`;
}

type AdvancedSection = "methods" | "models" | "psychometrics" | "multivariate";

export default function AdvancedLabs({ section }: { section: AdvancedSection }) {
  const [family, setFamily] = useState<"all" | MethodFamily>("all");
  const [selectedMethodId, setSelectedMethodId] = useState("independent-t");
  const [groupMeans, setGroupMeans] = useState([48, 55, 62]);
  const [withinSd, setWithinSd] = useState(9);
  const [groupN, setGroupN] = useState(24);
  const [rawScore, setRawScore] = useState(65);
  const [normMean, setNormMean] = useState(50);
  const [normSd, setNormSd] = useState(10);
  const [factorRule, setFactorRule] = useState<"parallel" | "eigen" | "fixed">("parallel");
  const [fixedFactors, setFixedFactors] = useState(3);
  const [rotation, setRotation] = useState<"oblimin" | "varimax">("oblimin");
  const [clusterK, setClusterK] = useState(3);
  const [standardized, setStandardized] = useState(true);

  const filteredMethods = family === "all" ? methodCards : methodCards.filter((method) => method.family === family);
  const selectedMethod = methodCards.find((method) => method.id === selectedMethodId) ?? methodCards[0];
  const anova = useMemo(() => buildAnova(groupMeans, withinSd, groupN), [groupMeans, withinSd, groupN]);

  const z = (rawScore - normMean) / normSd;
  const tScore = 50 + 10 * z;
  const sten = Math.max(1, Math.min(10, Math.round(5.5 + 2 * z)));
  const percentile = normalCdf(z) * 100;
  const curveMarker = Math.max(2, Math.min(98, ((z + 3) / 6) * 100));

  const eigenvalues = [3.86, 2.14, 0.91, 0.72, 0.51, 0.38, 0.26, 0.14];
  const parallelValues = [1.45, 1.29, 1.16, 1.07, 0.99, 0.91, 0.84, 0.78];
  const retainedFactors = factorRule === "parallel"
    ? eigenvalues.filter((value, index) => value > parallelValues[index]).length
    : factorRule === "eigen"
      ? eigenvalues.filter((value) => value > 1).length
      : fixedFactors;
  const loadingsOblimin = [
    [0.81, 0.08, 0.09],
    [0.76, 0.14, 0.05],
    [0.68, 0.27, 0.08],
    [0.18, 0.77, 0.04],
    [0.11, 0.73, 0.16],
    [0.29, 0.64, 0.12],
    [0.03, 0.18, 0.82],
    [0.10, 0.22, 0.75],
  ];
  const loadingsVarimax = [
    [0.83, 0.04, 0.03],
    [0.79, 0.08, 0.02],
    [0.73, 0.19, 0.04],
    [0.10, 0.79, 0.02],
    [0.05, 0.76, 0.11],
    [0.20, 0.69, 0.08],
    [0.01, 0.08, 0.84],
    [0.04, 0.13, 0.78],
  ];
  const loadings = rotation === "oblimin" ? loadingsOblimin : loadingsVarimax;
  const itemNames = ["Тревога 1", "Тревога 2", "Тревога 3", "Избегание 1", "Избегание 2", "Избегание 3", "Соматизация 1", "Соматизация 2"];

  const analysisPoints = standardized ? standardizePoints(clusterPoints) : clusterPoints;
  const clusterResult = useMemo(() => kMeans(analysisPoints, clusterK), [analysisPoints, clusterK]);
  const clusterSilhouette = useMemo(
    () => silhouette(analysisPoints, clusterResult.assignments),
    [analysisPoints, clusterResult.assignments],
  );
  const elbow = useMemo(() => Array.from({ length: 6 }, (_, index) => kMeans(analysisPoints, index + 1).wcss), [analysisPoints]);
  const elbowMax = elbow[0];
  const clusterColors = ["#524ba7", "#e9b44c", "#38a9a0", "#d2769a", "#6baec5", "#8d79d8"];

  return (
    <>
      <section className="hypothesis-section" id="hypotheses" hidden={section !== "methods"}>
        <div className="advanced-heading">
          <div>
            <p className="section-index">02.1 — ГИПОТЕЗЫ И КРИТЕРИИ</p>
            <h2>ФОРМУЛИРУЙ<br /><span>ТОЧНО</span></h2>
          </div>
          <p>
            Хорошая гипотеза говорит о параметре генеральной совокупности, а не
            пересказывает будущее p-значение. Выбери метод и проверь формулировки,
            предпосылки, ловушки и путь в SPSS и jamovi.
          </p>
        </div>

        <div className="hypothesis-rules">
          {[
            ["01", "Одна модель", "H₀ и H₁ должны описывать один и тот же параметр: μ, ρ, σ² или распределение."],
            ["02", "Равенство — в H₀", "Нулевая гипотеза содержит точку сравнения: = 0, = μ₀ или равенство групп."],
            ["03", "Направление — заранее", "Односторонняя H₁ допустима только если направление обосновано до анализа данных."],
            ["04", "Не «принимаем» H₀", "Корректно: отвергаем H₀ или не получили оснований её отвергнуть."],
            ["05", "Одного p недостаточно", "Покажи размер эффекта, доверительный интервал и содержательную важность результата."],
          ].map(([number, title, text]) => (
            <article key={number}><span>{number}</span><strong>{title}</strong><p>{text}</p></article>
          ))}
        </div>

        <div className="method-filter" role="group" aria-label="Фильтр статистических методов">
          {familyLabels.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={family === value ? "active" : ""}
              onClick={() => setFamily(value)}
              aria-pressed={family === value}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="method-library">
          <div className="method-list">
            {filteredMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                className={selectedMethod.id === method.id ? "selected" : ""}
                onClick={() => setSelectedMethodId(method.id)}
                aria-pressed={selectedMethod.id === method.id}
              >
                <span>{method.short}</span>
                <strong>{method.title}</strong>
                <i>→</i>
              </button>
            ))}
          </div>

          <article className="method-detail" aria-live="polite">
            <div className="method-detail-head">
              <span>{selectedMethod.short}</span>
              <div><small>ВЫБРАННЫЙ МЕТОД</small><h3>{selectedMethod.title}</h3></div>
            </div>
            <p className="method-use">{selectedMethod.use}</p>
            <div className="hypothesis-pair">
              <div><b>H₀</b><p>{selectedMethod.h0}</p></div>
              <div><b>H₁</b><p>{selectedMethod.h1}</p></div>
            </div>
            <div className="method-checks">
              <div><span>ПРОВЕРЬ</span><p>{selectedMethod.checks}</p></div>
              <div className="trap"><span>ЛОВУШКА</span><p>{selectedMethod.trap}</p></div>
            </div>
            <div className="method-report"><span>КАК ЗАПИСАТЬ</span><code>{selectedMethod.report}</code></div>
            <div className="method-paths">
              <div><b>SPSS</b><p>{selectedMethod.spss}</p></div>
              <div><b>jamovi</b><p>{selectedMethod.jamovi}</p></div>
            </div>
          </article>
        </div>
      </section>

      <section className="anova-section" id="anova" hidden={section !== "models"}>
        <div className="advanced-heading light-heading">
          <div>
            <p className="section-index light">03.1 — ДИСПЕРСИЯ И ANOVA</p>
            <h2>РАЗЛОЖИ<br /><span>РАЗБРОС</span></h2>
          </div>
          <p>
            ANOVA сравнивает вариативность между групповыми средними с шумом
            внутри групп. Разводи средние и меняй внутригрупповое SD: F, p и
            размер эффекта пересчитываются сразу.
          </p>
        </div>

        <div className="anova-lab">
          <aside className="anova-controls">
            <div className="control-heading"><span>ПАРАМЕТРЫ МОДЕЛИ</span><em>3 группы</em></div>
            {groupMeans.map((mean, index) => (
              <label key={index}>
                <span><b>Среднее группы {String.fromCharCode(65 + index)}</b><output>{mean}</output></span>
                <input
                  type="range"
                  min="35"
                  max="75"
                  value={mean}
                  onChange={(event) => setGroupMeans((current) => current.map((value, target) => target === index ? Number(event.target.value) : value))}
                  aria-label={`Среднее группы ${String.fromCharCode(65 + index)}`}
                />
              </label>
            ))}
            <label>
              <span><b>SD внутри групп</b><output>{withinSd}</output></span>
              <input type="range" min="3" max="18" value={withinSd} onChange={(event) => setWithinSd(Number(event.target.value))} aria-label="Стандартное отклонение внутри групп" />
            </label>
            <label>
              <span><b>Участников в группе</b><output>{groupN}</output></span>
              <input type="range" min="10" max="60" step="2" value={groupN} onChange={(event) => setGroupN(Number(event.target.value))} aria-label="Участников в каждой группе" />
            </label>
            <div className="variance-formula">
              <span>ЛОГИКА F</span>
              <strong>F = MS<sub>между</sub> / MS<sub>внутри</sub></strong>
              <p>Сигнал различий делим на фоновый шум.</p>
            </div>
          </aside>

          <div className="anova-stage">
            <div className="anova-toolbar"><span><i /> СИНТЕТИЧЕСКИЕ БАЛЛЫ</span><span>n = {groupN * 3}</span></div>
            <div className="group-plot" aria-label="Точечные распределения трёх групп">
              {anova.groups.map((group, groupIndex) => (
                <div className="group-column" key={groupIndex}>
                  <span className="mean-line" style={{ bottom: `${Math.max(4, Math.min(96, ((anova.groupMeans[groupIndex] - 20) / 70) * 100))}%` }} />
                  {group.map((value, pointIndex) => (
                    <i
                      className="group-point"
                      key={pointIndex}
                      style={{
                        bottom: `${Math.max(1, Math.min(98, ((value - 20) / 70) * 100))}%`,
                        left: `${18 + ((pointIndex * 37 + groupIndex * 13) % 65)}%`,
                        "--delay": `${pointIndex * 7}ms`,
                      } as CSSProperties}
                    />
                  ))}
                  <div className="group-label"><b>{String.fromCharCode(65 + groupIndex)}</b><span>M = {anova.groupMeans[groupIndex].toFixed(1).replace(".", ",")}</span><small>s² = {anova.variances[groupIndex].toFixed(1).replace(".", ",")}</small></div>
                </div>
              ))}
            </div>

            <div className="variance-partition">
              <div className="variance-bar" aria-label="Доля межгрупповой и внутригрупповой вариативности">
                <span style={{ width: `${anova.etaSquared * 100}%` }}>между</span>
                <i style={{ width: `${(1 - anova.etaSquared) * 100}%` }}>внутри</i>
              </div>
              <p><b>η² = {(anova.etaSquared).toFixed(3).replace(".", ",")}</b> — доля общей вариативности, связанная с группой в этой выборке.</p>
            </div>

            <div className="anova-stat-grid">
              <article><span>SS МЕЖДУ</span><strong>{anova.ssBetween.toFixed(1).replace(".", ",")}</strong><small>объясняемая часть</small></article>
              <article><span>SS ВНУТРИ</span><strong>{anova.ssWithin.toFixed(1).replace(".", ",")}</strong><small>ошибка / шум</small></article>
              <article><span>F({anova.dfBetween}; {anova.dfWithin})</span><strong>{anova.f.toFixed(2).replace(".", ",")}</strong><small>отношение сигнал / шум</small></article>
              <article className={anova.p < 0.05 ? "significant" : ""}><span>p</span><strong>{formatP(anova.p)}</strong><small>{anova.p < 0.05 ? "H₀ отвергается" : "оснований отвергать H₀ нет"}</small></article>
              <article><span>ω²</span><strong>{anova.omegaSquared.toFixed(3).replace(".", ",")}</strong><small>менее смещённый эффект</small></article>
            </div>
          </div>
        </div>

        <div className="anova-logic">
          <article><span>H₀</span><p>μA = μB = μC — все генеральные средние равны.</p></article>
          <article><span>H₁</span><p>Хотя бы одно среднее отличается. Не обязательно все три.</p></article>
          <article><span>ПОСЛЕ F</span><p>{anova.p < 0.05 ? "Общий тест значим: нужны запланированные контрасты или post hoc с поправкой." : "Общий тест незначим: не превращай отдельные попарные p в охоту за удачей."}</p></article>
          <article><span>ПРЕДПОСЫЛКИ</span><p>Независимость, остатки, выбросы, Ливинь. При неравных дисперсиях — Welch ANOVA + Games–Howell.</p></article>
        </div>
      </section>

      <section className="norms-section" id="scales" hidden={section !== "psychometrics"}>
        <div className="advanced-heading">
          <div>
            <p className="section-index">04.2 — НОРМИРОВАНИЕ</p>
            <h2>ИЗ СЫРОГО<br /><span>В СТАНДАРТНЫЙ</span></h2>
          </div>
          <p>
            Один и тот же результат можно выразить в z, T-баллах, стэнах и
            процентильном ранге. Формула переводит шкалу; смысл появляется
            только рядом с качественной нормативной выборкой.
          </p>
        </div>

        <div className="norm-lab">
          <div className="norm-controls">
            <label><span><b>Сырой балл X</b><output>{rawScore}</output></span><input type="range" min="10" max="90" value={rawScore} onChange={(event) => setRawScore(Number(event.target.value))} aria-label="Сырой балл" /></label>
            <label><span><b>Среднее нормы M</b><output>{normMean}</output></span><input type="range" min="30" max="70" value={normMean} onChange={(event) => setNormMean(Number(event.target.value))} aria-label="Среднее нормативной выборки" /></label>
            <label><span><b>SD нормы</b><output>{normSd}</output></span><input type="range" min="5" max="20" value={normSd} onChange={(event) => setNormSd(Number(event.target.value))} aria-label="Стандартное отклонение нормативной выборки" /></label>
            <div className="score-formulas"><code>z = (X − M) / SD</code><code>T = 50 + 10z</code><code>sten ≈ 5,5 + 2z</code></div>
          </div>

          <div className="norm-visual">
            <div className="normal-curve" style={{ "--marker": `${curveMarker}%` } as CSSProperties}>
              <svg viewBox="0 0 600 180" role="img" aria-label={`Положение результата: z равно ${z.toFixed(2)}`} preserveAspectRatio="none">
                <path d="M0 174 C95 174 120 166 168 132 C220 94 240 12 300 8 C360 12 380 94 432 132 C480 166 505 174 600 174" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M0 174 C95 174 120 166 168 132 C220 94 240 12 300 8 C360 12 380 94 432 132 C480 166 505 174 600 174 L600 180 L0 180 Z" fill="currentColor" opacity=".08" />
              </svg>
              <span className="curve-marker"><i /><b>X = {rawScore}</b></span>
              <div className="curve-axis"><span>−3σ</span><span>−2σ</span><span>−1σ</span><span>M</span><span>+1σ</span><span>+2σ</span><span>+3σ</span></div>
            </div>

            <div className="score-results">
              <article><span>z-БАЛЛ</span><strong>{z.toFixed(2).replace(".", ",")}</strong><p>{Math.abs(z).toFixed(2).replace(".", ",")} SD {z >= 0 ? "выше" : "ниже"} среднего</p></article>
              <article><span>T-БАЛЛ</span><strong>{tScore.toFixed(1).replace(".", ",")}</strong><p>M = 50 · SD = 10</p></article>
              <article><span>СТЭН</span><strong>{sten}</strong><p>10 категорий · M ≈ 5,5 · SD ≈ 2</p></article>
              <article><span>ПРОЦЕНТИЛЬ*</span><strong>{percentile.toFixed(0)}</strong><p>примерно выше {percentile.toFixed(0)}% нормы</p></article>
            </div>
            <p className="norm-note">* Процентиль здесь рассчитан по нормальной модели. Для реальной методики лучше использовать эмпирические нормы, актуальные для нужной популяции, возраста, языка и процедуры обследования.</p>
          </div>
        </div>
      </section>

      <section className="multivariate-section" id="multivariate" hidden={section !== "multivariate"}>
        <div className="advanced-heading light-heading">
          <div>
            <p className="section-index light">05.1 — ФАКТОРЫ И КЛАСТЕРЫ</p>
            <h2>СТРУКТУРА<br /><span>И ГРУППЫ</span></h2>
          </div>
          <p>
            Факторный анализ ищет скрытые измерения среди переменных. Кластерный
            анализ ищет похожие объекты среди наблюдений. Это разные вопросы — и
            ни один не создаёт психологический смысл автоматически.
          </p>
        </div>

        <div className="terminology-alert">
          <b>НЕ ПУТАТЬ</b>
          <p><strong>Фактор в ANOVA</strong> — наблюдаемый предиктор или условие. <strong>Фактор в EFA</strong> — предполагаемая латентная переменная, объясняющая ковариации пунктов.</p>
        </div>

        <div className="factor-lab" id="factor">
          <div className="factor-copy">
            <span className="lab-number">10.1</span>
            <h3>Разведочный факторный анализ</h3>
            <p>Выбери правило удержания факторов и вращение. Scree plot, параллельный анализ и матрица нагрузок меняются как единая логика решения.</p>
            <div className="factor-prereqs">
              <article><span>KMO</span><strong>0,82</strong><small>адекватность корреляционной матрицы</small></article>
              <article><span>BARTLETT</span><strong>p &lt; 0,001</strong><small>корреляционная матрица не единичная</small></article>
            </div>
            <div className="efa-notice"><b>Здесь нет стандартной H₀ «факторов нет».</b><p>Тест Бартлетта проверяет пригодность корреляционной матрицы, но не выбирает число факторов и не доказывает теорию.</p></div>
          </div>

          <div className="factor-workbench">
            <div className="factor-options">
              <div><span>СКОЛЬКО ФАКТОРОВ?</span>{([['parallel', 'Параллельный анализ'], ['eigen', 'λ > 1'], ['fixed', 'Задать вручную']] as const).map(([value, label]) => <button type="button" key={value} className={factorRule === value ? "active" : ""} onClick={() => setFactorRule(value)}>{label}</button>)}</div>
              <div><span>ВРАЩЕНИЕ</span>{([['oblimin', 'Oblimin'], ['varimax', 'Varimax']] as const).map(([value, label]) => <button type="button" key={value} className={rotation === value ? "active" : ""} onClick={() => setRotation(value)}>{label}</button>)}</div>
              {factorRule === "fixed" && <label><span>ФАКТОРОВ</span><input type="range" min="1" max="3" value={fixedFactors} onChange={(event) => setFixedFactors(Number(event.target.value))} aria-label="Заданное число факторов" /><output>{fixedFactors}</output></label>}
            </div>

            <div className="scree-chart" aria-label="График собственных значений и параллельного анализа">
              <div className="scree-y"><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span></div>
              <div className="scree-bars">
                {eigenvalues.map((value, index) => (
                  <div key={index} className={index < retainedFactors ? "retained" : ""}>
                    <i style={{ height: `${(value / 4.2) * 100}%` }}><b>{value.toFixed(2).replace(".", ",")}</b></i>
                    <em style={{ bottom: `${(parallelValues[index] / 4.2) * 100}%` }} title={`Случайное значение ${parallelValues[index]}`} />
                    <span>{index + 1}</span>
                  </div>
                ))}
              </div>
              <p><i /> эмпирическое λ <em /> порог параллельного анализа</p>
            </div>

            <div className="factor-summary"><strong>{retainedFactors}</strong><p>фактора удержано<br /><span>{factorRule === "parallel" ? "λ выше случайного порога" : factorRule === "eigen" ? "собственное значение > 1" : "решение задано исследователем"}</span></p></div>

            <div className="loading-table">
              <div className="loading-head"><span>ПУНКТ</span>{Array.from({ length: Math.min(retainedFactors, 3) }, (_, index) => <b key={index}>F{index + 1}</b>)}<span>h²</span></div>
              {itemNames.map((name, row) => {
                const visible = loadings[row].slice(0, Math.min(retainedFactors, 3));
                const communality = visible.reduce((sum, value) => sum + value ** 2, 0);
                return <div className="loading-row" key={name}><span>{name}</span>{visible.map((value, column) => <b key={column} style={{ "--load": Math.abs(value) } as CSSProperties}>{value.toFixed(2).replace(".", ",")}</b>)}<span>{communality.toFixed(2).replace(".", ",")}</span></div>;
              })}
            </div>
            <div className="rotation-note"><b>{rotation === "oblimin" ? "Oblimin допускает корреляцию факторов" : "Varimax требует ортогональности факторов"}</b><p>{rotation === "oblimin" ? "Для психологических конструктов это часто реалистичнее." : "Используй только при содержательном основании независимости измерений."}</p></div>
          </div>
        </div>

        <div className="pca-efa-grid">
          <article><span>PCA</span><h4>Главные компоненты</h4><p>Сжимает наблюдаемую дисперсию в меньшее число компонентов. Это редукция данных.</p></article>
          <article><span>EFA</span><h4>Общие факторы</h4><p>Моделирует общую дисперсию как проявление латентных переменных. Это модель измерения.</p></article>
          <article><span>CFA</span><h4>Подтверждающий анализ</h4><p>Проверяет заранее заданную факторную структуру и требует отдельной оценки соответствия модели.</p></article>
        </div>

        <div className="cluster-lab" id="cluster">
          <div className="cluster-head">
            <div><span className="lab-number">10.2</span><h3>Кластерный анализ</h3></div>
            <p>Меняй k и стандартизацию. Алгоритм k-средних пересобирает группы, WCSS строит «локоть», а силуэт показывает, насколько объекты похожи на свой кластер больше, чем на соседний.</p>
          </div>

          <div className="cluster-workbench">
            <aside className="cluster-controls">
              <label><span><b>Число кластеров k</b><output>{clusterK}</output></span><input type="range" min="2" max="5" value={clusterK} onChange={(event) => setClusterK(Number(event.target.value))} /></label>
              <div className="standardize-toggle"><span><b>Стандартизировать признаки</b><small>возраст и балл имеют разный масштаб</small></span><button type="button" className={standardized ? "on" : ""} onClick={() => setStandardized((value) => !value)} aria-pressed={standardized}><i /></button></div>
              <div className="cluster-metrics"><article><span>WCSS</span><strong>{clusterResult.wcss.toFixed(1).replace(".", ",")}</strong><small>компактность внутри</small></article><article><span>SILHOUETTE</span><strong>{clusterSilhouette.toFixed(2).replace(".", ",")}</strong><small>−1 … 1 · выше лучше</small></article></div>
              <div className="cluster-warning"><b>У кластеров нет обычной пары H₀/H₁.</b><p>Проверяют устойчивость решения, силуэт, чувствительность к масштабу и воспроизводимость на новой выборке.</p></div>
            </aside>

            <div className="cluster-visuals">
              <div className="scatter-panel">
                <div className="scatter-title"><span>ПРОФИЛИ УЧАСТНИКОВ</span><b>{standardized ? "анализ по z-признакам" : "анализ в сырых единицах"}</b></div>
                <div className="cluster-scatter" aria-label={`Диаграмма рассеяния с ${clusterK} кластерами`}>
                  <span className="axis-y">БАЛЛ ШКАЛЫ →</span>
                  {clusterPoints.map((point, index) => <i key={point.id} className="cluster-point" style={{ left: `${((point.x - 15) / 40) * 100}%`, bottom: `${point.y}%`, background: clusterColors[clusterResult.assignments[index]] }} title={`Кластер ${clusterResult.assignments[index] + 1}`} />)}
                  <span className="axis-x">ВОЗРАСТ →</span>
                </div>
              </div>
              <div className="elbow-panel">
                <span>МЕТОД «ЛОКТЯ» · WCSS</span>
                <div className="elbow-chart">{elbow.map((value, index) => <button type="button" key={index} className={clusterK === index + 1 ? "active" : ""} onClick={() => setClusterK(Math.max(2, index + 1))} disabled={index === 0}><i style={{ height: `${Math.max(7, (value / elbowMax) * 100)}%` }} /><b>{index + 1}</b></button>)}</div>
                <p>Ищи перегиб, но не объявляй его законом природы. Содержательная интерпретируемость и устойчивость важнее красивого локтя.</p>
              </div>
            </div>
          </div>

          <div className="cluster-methods">
            <article><span>01</span><h4>k-средних</h4><p>Нужно задать k; чувствителен к масштабу, выбросам и стартовым центрам; предпочитает компактные кластеры.</p></article>
            <article><span>02</span><h4>Иерархический</h4><p>Даёт дендрограмму; результат зависит от метрики расстояния и способа объединения, например Ward.</p></article>
            <article><span>03</span><h4>TwoStep</h4><p>В SPSS работает со смешанными типами данных и предлагает число кластеров, но решение всё равно требует проверки.</p></article>
            <article><span>04</span><h4>Где считать</h4><p>SPSS: Analyze → Classify. В базовом jamovi кластеризации нет; нужен Rj/R или дополнительный модуль.</p></article>
          </div>
        </div>
      </section>
    </>
  );
}
