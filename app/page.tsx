"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdvancedLabs from "./AdvancedLabs";
import ResearchWorkbench from "./ResearchWorkbench";
import StatSandbox from "./StatSandbox";
import SPSSGuides from "./SPSSGuides";

type SampleStats = {
  mean: number;
  median: number;
  variance: number;
  sd: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
};

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildSample(n: number, spread: number, skew: number, outliers: number, seed: number) {
  const random = seededRandom(seed);
  const values: number[] = [];

  for (let index = 0; index < n; index += 1) {
    const u1 = Math.max(random(), 0.0001);
    const u2 = random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const shaped = normal + skew * ((normal * normal - 1) / 3.2);
    values.push(50 + shaped * spread);
  }

  for (let index = 0; index < outliers; index += 1) {
    const target = Math.floor(random() * values.length);
    const direction = index % 2 === 0 ? 1 : -1;
    values[target] = 50 + direction * spread * (3.8 + random() * 1.8);
  }

  return values;
}

function summarize(values: number[]): SampleStats {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const quantile = (probability: number) => {
    const position = (sorted.length - 1) * probability;
    const lower = Math.floor(position);
    const fraction = position - lower;
    return sorted[lower + 1] === undefined
      ? sorted[lower]
      : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);

  return {
    mean,
    median,
    variance,
    sd: Math.sqrt(variance),
    q1,
    q3,
    iqr: q3 - q1,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function makeHistogram(values: number[], bins = 18) {
  const min = Math.floor(Math.min(...values) / 5) * 5;
  const max = Math.ceil(Math.max(...values) / 5) * 5;
  const width = Math.max((max - min) / bins, 1);
  const counts = Array.from({ length: bins }, () => 0);

  values.forEach((value) => {
    const position = Math.min(Math.floor((value - min) / width), bins - 1);
    counts[Math.max(position, 0)] += 1;
  });

  return { counts, min, max, peak: Math.max(...counts) };
}

function format(value: number) {
  return value.toFixed(1).replace(".", ",");
}

const quizCases = [
  {
    tag: "СРАВНЕНИЕ ГРУПП",
    title: "Тревожность у очников и заочников",
    text: "Две независимые группы студентов. Тревожность измерена суммарным баллом, распределение заметно асимметрично, есть выбросы.",
    options: ["Парный t-критерий", "U-критерий Манна — Уитни", "Критерий Фридмана", "Корреляция Спирмена"],
    correct: 1,
    explanation:
      "Группы независимы, а распределение и выбросы делают ранговый критерий разумным учебным выбором. U Манна — Уитни сравнивает распределения рангов; не называй его автоматически «тестом медиан».",
  },
  {
    tag: "ДО / ПОСЛЕ",
    title: "Стресс до и после тренинга",
    text: "Одни и те же 34 участника заполнили количественную шкалу стресса до и после программы. Распределение разностей близко к нормальному.",
    options: ["t-критерий для связанных выборок", "t-критерий для независимых выборок", "Критерий χ²", "U-критерий Манна — Уитни"],
    correct: 0,
    explanation:
      "Наблюдения связаны: каждый участник сравнивается с самим собой. Для парного t-критерия проверяют распределение разностей, а не каждую колонку отдельно.",
  },
  {
    tag: "СВЯЗЬ",
    title: "Импульсивность и агрессия",
    text: "Два количественных показателя имеют монотонную связь, но один из них асимметричен и содержит несколько влиятельных наблюдений.",
    options: ["r Пирсона", "ρ Спирмена", "Однофакторный ANOVA", "Критерий Уилкоксона"],
    correct: 1,
    explanation:
      "Спирмен работает с рангами и оценивает монотонную связь. Но сначала всё равно посмотри диаграмму рассеяния: коэффициент без графика умеет красиво маскировать странности.",
  },
  {
    tag: "ПСИХОМЕТРИКА",
    title: "Надёжность новой шкалы",
    text: "В методике 12 пунктов. Нужно оценить внутреннюю согласованность и понять, не держится ли коэффициент на количестве однотипных вопросов.",
    options: ["Только α Кронбаха", "α, ω и анализ пунктов", "Только p-значение", "Критерий Колмогорова — Смирнова"],
    correct: 1,
    explanation:
      "Один коэффициент недостаточен. Смотри α и ω вместе с корреляциями пункт–шкала, содержанием пунктов и структурой методики. Высокая согласованность не доказывает валидность.",
  },
  {
    tag: "ANOVA",
    title: "Три программы профилактики",
    text: "Исследователь сравнил средние баллы резилентности в трёх независимых группах. Общий ANOVA оказался значимым: F(2, 87) = 5,64; p = 0,005.",
    options: ["Все три группы различаются", "Хотя бы одно среднее отличается", "Дисперсии групп равны", "Эффект обязательно большой"],
    correct: 1,
    explanation:
      "Общий F-тест отвергает равенство всех средних, но не называет конкретные пары. Следующий шаг — запланированные контрасты или post hoc с поправкой и размером эффекта.",
  },
  {
    tag: "НОРМАЛЬНОСТЬ",
    title: "K–S дал p = 0,002",
    text: "В выборке из 620 человек тест нормальности значим, но Q–Q график почти прямой, асимметрия 0,18, критичных выбросов нет.",
    options: ["Запретить параметрические методы", "Удалить половину выборки", "Оценить практическую величину отклонения и остатки модели", "Считать данные номинальными"],
    correct: 2,
    explanation:
      "При большом n формальный тест чувствителен к малым отклонениям. Решение принимают по дизайну, графикам, выбросам, остаткам и робастности метода, а не одной лампочке p < 0,05.",
  },
  {
    tag: "НОРМИРОВАНИЕ",
    title: "Что значит T = 65?",
    text: "Использована стандартная T-шкала со средним 50 и стандартным отклонением 10.",
    options: ["65-й процентиль", "1,5 SD выше среднего", "На 65% выше нормы", "Стэн 5"],
    correct: 1,
    explanation:
      "z = (65 − 50) / 10 = 1,5. T-балл — линейная шкала, а не процентиль и не процент преимущества.",
  },
  {
    tag: "МНОГОМЕРНЫЕ МЕТОДЫ",
    title: "Возраст ломает кластеры",
    text: "Кластеризация использует возраст 18–60 и сумму опросника 0–240. После запуска группы почти полностью определяются баллом опросника.",
    options: ["Это доказывает типологию личности", "Увеличить p-значение", "Стандартизировать признаки и проверить устойчивость", "Заменить k-средних на t-тест"],
    correct: 2,
    explanation:
      "Расстояние доминируется переменной с большим масштабом. Стандартизация — обязательная проверка, а само решение нужно валидировать силуэтом, стабильностью и воспроизводимостью.",
  },
  {
    tag: "ДИСПЕРСИИ",
    title: "Критерий Ливиня оказался значимым",
    text: "Сравниваются средние двух независимых групп. Критерий Ливиня: p = 0,008; размеры групп — 29 и 61, распределения без критических выбросов.",
    options: ["Обычная строка t Стьюдента", "t-критерий Уэлча", "Парный t-критерий", "Анализ невозможен"],
    correct: 1,
    explanation:
      "При неодинаковых дисперсиях и несбалансированных группах читают строку Уэлча. Нарушение гомогенности не требует автоматически отказываться от сравнения средних.",
  },
  {
    tag: "КАТЕГОРИАЛЬНЫЕ ДАННЫЕ",
    title: "Формат обучения и завершение курса",
    text: "Обе переменные категориальные: формат имеет три уровня, завершение — да/нет. Нужно проверить связь и оценить её силу.",
    options: ["χ² Пирсона + V Крамера", "r Пирсона", "ANOVA", "Критерий Уилкоксона"],
    correct: 0,
    explanation:
      "χ² проверяет независимость категориальных переменных, стандартизированные остатки локализуют вклад ячеек, а V Крамера описывает силу связи.",
  },
  {
    tag: "ДВУХФАКТОРНЫЙ ANOVA",
    title: "Линии на графике пересеклись",
    text: "Эффект опыта на напряжение положительный в шутерах, почти нулевой в MOBA и отрицательный в кинетических играх.",
    options: ["Только главный эффект опыта", "Вероятное взаимодействие жанр × опыт", "Нормальность доказана", "Нужен χ²"],
    correct: 1,
    explanation:
      "Непараллельные и особенно пересекающиеся линии указывают на взаимодействие: влияние одного фактора меняется на уровнях другого. Далее проверяют F взаимодействия и простые эффекты.",
  },
  {
    tag: "РЕГРЕССИЯ",
    title: "Нормальность предиктора нарушена",
    text: "В множественной линейной регрессии один предиктор асимметричен. Остатки модели близки к нормальным, связь линейна, влиятельных точек нет.",
    options: ["Регрессия запрещена", "Проверять нужно прежде всего остатки и форму модели", "Удалить предиктор", "Заменить модель на корреляцию Кендалла"],
    correct: 1,
    explanation:
      "Линейная регрессия не требует нормальности каждого предиктора. Для статистического вывода рассматривают ошибки модели, а также линейность, гомоскедастичность и влиятельные наблюдения.",
  },
  {
    tag: "ОБРАТНЫЕ ПУНКТЫ",
    title: "α стала отрицательной",
    text: "В шкале есть три обратных утверждения. Их ответы вошли в сумму без перекодирования, а корреляции пункт–шкала оказались отрицательными.",
    options: ["Удалить все три пункта", "Сначала корректно перекодировать и пересчитать", "Высокая валидность", "Применить ANOVA"],
    correct: 1,
    explanation:
      "Первая проверка — ключ и направление шкалы. Для шкалы 1–5 обратное кодирование выполняют как 6 − X; только после этого оценивают пункт–шкала, α и ω.",
  },
  {
    tag: "ФАКТОРНЫЙ АНАЛИЗ",
    title: "KMO = 0,82; Бартлетт p < 0,001",
    text: "Исследователь заключил, что методика точно имеет три фактора, потому что KMO высокий, а Бартлетт значим.",
    options: ["Вывод корректен", "Проверки показывают пригодность матрицы, но не число факторов", "Нужно оставить один фактор", "KMO проверяет нормальность"],
    correct: 1,
    explanation:
      "KMO и Бартлетт помогают оценить пригодность корреляционной матрицы. Число факторов определяют параллельным анализом, scree plot, моделью и интерпретируемостью нагрузок.",
  },
  {
    tag: "MDS",
    title: "Stress уменьшился в трёх измерениях",
    text: "Переход от 2D к 3D снизил Stress-1 с 0,09 до 0,05, но третье измерение трудно содержательно объяснить.",
    options: ["Всегда выбирать минимальный stress", "Сопоставить улучшение соответствия с интерпретируемостью", "Назвать ось автоматически", "MDS доказывает причинность"],
    correct: 1,
    explanation:
      "Число измерений выбирают по качеству воспроизведения расстояний, перегибу stress и содержательной интерпретируемости. Самое сложное решение не всегда самое полезное.",
  },
  {
    tag: "ОТЧЁТНОСТЬ",
    title: "p = 0,032, но эффект почти нулевой",
    text: "В большой выборке различие статистически значимо, однако d = 0,08 и 95% ДИ разности лежит около нуля в практических единицах.",
    options: ["Эффект важный, раз p < 0,05", "Описать значимость и честно указать малый практический эффект", "H₀ доказана", "Размер эффекта не нужен"],
    correct: 1,
    explanation:
      "Статистическая обнаружимость и практическая важность — разные вещи. В выводе нужны величина эффекта, доверительный интервал, контекст шкалы и содержательный порог важности.",
  },
];

function getCriterion(goal: string, design: string, scale: string) {
  if (goal === "association") {
    if (scale === "categorical") {
      return {
        name: "χ² Пирсона + V Крамера",
        why: "Обе переменные категориальные. χ² проверит наличие связи, а V Крамера покажет её силу.",
        check: "Ожидаемые частоты в ячейках; при малых частотах — точный критерий Фишера.",
        spss: "Анализ → Описательные статистики → Таблицы сопряжённости",
        jamovi: "Frequencies → Contingency Tables → Independent Samples",
      };
    }
    if (scale === "ranked") {
      return {
        name: "ρ Спирмена",
        why: "Связь монотонная, данные порядковые или чувствительны к выбросам — работаем с рангами.",
        check: "Диаграмма рассеяния, монотонность, независимость наблюдений.",
        spss: "Анализ → Корреляции → Парные → Спирмен",
        jamovi: "Regression → Correlation Matrix → Spearman",
      };
    }
    return {
      name: "r Пирсона",
      why: "Две количественные переменные и линейная связь без критичных выбросов.",
      check: "Линейность, выбросы, независимость; нормальность важна прежде всего для вывода о значимости.",
      spss: "Анализ → Корреляции → Парные → Пирсон",
      jamovi: "Regression → Correlation Matrix → Pearson",
    };
  }

  if (goal === "prediction") {
    if (scale === "categorical") {
      return {
        name: "Бинарная логистическая регрессия",
        why: "Исход имеет две категории, а задача — оценить вероятность события по предикторам.",
        check: "Независимость, линейность логита для количественных предикторов, мультиколлинеарность.",
        spss: "Анализ → Регрессия → Бинарная логистическая",
        jamovi: "Regression → 2 Outcomes → Binomial Logistic Regression",
      };
    }
    return {
      name: "Линейная регрессия",
      why: "Зависимая переменная количественная, а цель — объяснить или предсказать её значения.",
      check: "Линейность, независимость ошибок, гомоскедастичность, остатки и мультиколлинеарность.",
      spss: "Анализ → Регрессия → Линейная",
      jamovi: "Regression → Linear Regression",
    };
  }

  if (goal === "reliability") {
    return {
      name: "α Кронбаха + ω Макдональда",
      why: "Нужно оценить внутреннюю согласованность шкалы, не делая один коэффициент единственным судьёй.",
      check: "Одномерность, корреляции пункт–шкала, обратные пункты, содержание и диапазон ответов.",
      spss: "Анализ → Шкала → Анализ надёжности (α); для ω нужен модуль или внешний расчёт",
      jamovi: "Factor → Reliability Analysis → Cronbach’s α + McDonald’s ω",
    };
  }

  const nonParametric = scale === "ranked";
  const map: Record<string, { parametric: string; nonParametric: string; spss: string; jamovi: string }> = {
    "two-independent": {
      parametric: "t-критерий для независимых выборок",
      nonParametric: "U-критерий Манна — Уитни",
      spss: "Анализ → Сравнение средних / Непараметрические критерии → Независимые выборки",
      jamovi: "T-Tests → Independent Samples T-Test / Mann–Whitney U",
    },
    "two-related": {
      parametric: "t-критерий для связанных выборок",
      nonParametric: "Критерий Уилкоксона",
      spss: "Анализ → Сравнение средних / Непараметрические критерии → Связанные выборки",
      jamovi: "T-Tests → Paired Samples T-Test / Wilcoxon Rank",
    },
    "many-independent": {
      parametric: "Однофакторный ANOVA",
      nonParametric: "Критерий Краскела — Уоллиса",
      spss: "Анализ → Сравнение средних → Однофакторный дисперсионный анализ",
      jamovi: "ANOVA → One-Way ANOVA / Non-Parametric Tests",
    },
    "many-related": {
      parametric: "ANOVA с повторными измерениями",
      nonParametric: "Критерий Фридмана",
      spss: "Анализ → Общая линейная модель → Повторные измерения",
      jamovi: "ANOVA → Repeated Measures ANOVA / Friedman",
    },
  };
  const chosen = map[design];

  if (scale === "categorical") {
    return {
      name: design === "two-related" ? "Критерий Мак-Немара" : "χ² Пирсона",
      why: "Зависимая переменная категориальная, поэтому сравниваем частоты, а не средние или ранги.",
      check: "Структура зависимости и ожидаемые частоты в ячейках таблицы.",
      spss: "Анализ → Описательные статистики → Таблицы сопряжённости",
      jamovi: "Frequencies → Contingency Tables",
    };
  }

  return {
    name: nonParametric ? chosen.nonParametric : chosen.parametric,
    why: nonParametric
      ? "Данные порядковые, существенно ненормальные или содержат проблемные выбросы — выбран ранговый аналог."
      : "Количественные данные и дизайн позволяют использовать параметрическую модель при выполнении её предпосылок.",
    check: nonParametric
      ? "Независимость или связанность наблюдений, форма распределений и корректная интерпретация рангов."
      : "Выбросы, форма распределения или остатков, гомогенность дисперсий и независимость наблюдений.",
    spss: chosen.spss,
    jamovi: chosen.jamovi,
  };
}

export type StatLabView = "home" | "basics" | "sandbox" | "methods" | "guides" | "models" | "psychometrics" | "multivariate" | "practice";

const pageMeta: Record<Exclude<StatLabView, "home">, { index: string; kicker: string; title: string; lead: string; topics: string[] }> = {
  basics: {
    index: "РАЗДЕЛ 01",
    kicker: "ОСНОВЫ И ЛОГИКА ВЫБОРА",
    title: "Данные, распределения и выбор метода",
    lead: "Начни с устройства данных: посмотри на форму распределения, разброс и выбросы, а затем собери статистическое решение по дизайну исследования.",
    topics: ["Описательная статистика", "Дисперсия и выбросы", "Дерево выбора критерия"],
  },
  sandbox: {
    index: "ИНТЕРАКТИВ",
    kicker: "СТАТИСТИЧЕСКАЯ ПЕСОЧНИЦА",
    title: "Дёргай за рычаги и ломай предпосылки",
    lead: "Живой интерактивный полигон: сравнивай 2 выборки, двигай размер эффекта d Коэна, исследуй перекрытие кривых, внедряй точки-убийцы в регрессию и проводи психометрическую хирургию опросников.",
    topics: ["Сравнение 2 выборок", "Мощность и Overlap d", "Корреляции и выбросы", "Хирургия опросников"],
  },
  methods: {
    index: "РАЗДЕЛ 02",
    kicker: "ГИПОТЕЗЫ И КРИТЕРИИ",
    title: "Формулируй точно, проверяй осмысленно",
    lead: "Справочник основных критериев с корректными H₀ и H₁, предпосылками, типичными ошибками и маршрутами в SPSS и jamovi.",
    topics: ["Конструктор H₀ и H₁", "19 статистических методов", "Предпосылки и ловушки"],
  },
  guides: {
    index: "ПРАКТИКУМ SPSS",
    kicker: "ПОШАГОВЫЕ РУКОВОДСТВА",
    title: "От меню программы до вывода в диплом",
    lead: "Точные пошаговые маршруты со всеми флажками в SPSS и jamovi, интерактивная анатомия таблиц вывода, готовый синтаксис, код на Python и разбор типичных ошибок на защите.",
    topics: ["Пошаговые меню SPSS", "Куда смотреть в таблицах", "Синтаксис и Python", "Ошибки на защите"],
  },
  models: {
    index: "РАЗДЕЛ 03",
    kicker: "ANOVA И СТАТИСТИЧЕСКИЕ МОДЕЛИ",
    title: "От сравнения средних к объясняющей модели",
    lead: "Исследуй однофакторный и двухфакторный ANOVA, категориальные связи и регрессию. Каждый параметр можно менять и сразу видеть последствия.",
    topics: ["Одно- и двухфакторный ANOVA", "χ² и V Крамера", "Регрессия и остатки"],
  },
  psychometrics: {
    index: "РАЗДЕЛ 04",
    kicker: "ПСИХОМЕТРИКА И НОРМЫ",
    title: "От сырого балла к качеству измерения",
    lead: "Разберись со стандартизацией, обратными пунктами и внутренней согласованностью. Красивый коэффициент здесь никогда не заменяет смысл шкалы.",
    topics: ["z, T и стэны", "α, ω и KR-20", "Анализ пунктов"],
  },
  multivariate: {
    index: "РАЗДЕЛ 05",
    kicker: "МНОГОМЕРНЫЕ МЕТОДЫ",
    title: "Структуры, факторы и группы в данных",
    lead: "Продвинутый раздел без ритуального тумана: факторный и кластерный анализ, многомерное шкалирование и психофизические модели.",
    topics: ["PCA и EFA", "Кластерный анализ", "MDS и психофизика"],
  },
  practice: {
    index: "РАЗДЕЛ 06",
    kicker: "ПРАКТИКУМ И ИНТЕРПРЕТАЦИЯ",
    title: "Прочитай вывод и напиши нормальный результат",
    lead: "Решай исследовательские кейсы, учись читать таблицы SPSS и jamovi и собирай корректный черновик для отчёта без лишних обещаний данным.",
    topics: ["16 исследовательских кейсов", "Чтение SPSS и jamovi", "Генератор отчёта"],
  },
};

const navigation: Array<{ view: Exclude<StatLabView, "home">; label: string; href: string }> = [
  { view: "basics", label: "Основы", href: "/basics" },
  { view: "sandbox", label: "Песочница", href: "/sandbox" },
  { view: "methods", label: "Критерии", href: "/methods" },
  { view: "guides", label: "Гайды SPSS", href: "/guides" },
  { view: "models", label: "Модели", href: "/models" },
  { view: "psychometrics", label: "Психометрика", href: "/psychometrics" },
  { view: "multivariate", label: "Многомерные", href: "/multivariate" },
  { view: "practice", label: "Практикум", href: "/practice" },
];

export default function Home({ view = "home" }: { view?: StatLabView }) {
  const [n, setN] = useState(80);
  const [spread, setSpread] = useState(10);
  const [skew, setSkew] = useState(0);
  const [outliers, setOutliers] = useState(0);
  const [seed, setSeed] = useState(21);
  const [goal, setGoal] = useState("difference");
  const [design, setDesign] = useState("two-independent");
  const [scale, setScale] = useState("continuous");
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [items, setItems] = useState(10);
  const [averageCorrelation, setAverageCorrelation] = useState(0.25);
  const [reportTest, setReportTest] = useState("mann-whitney");
  const [statistic, setStatistic] = useState("284,0");
  const [pValue, setPValue] = useState("0,013");
  const [effect, setEffect] = useState("0,31");
  const [copied, setCopied] = useState(false);

  const sample = useMemo(
    () => buildSample(n, spread, skew, outliers, seed),
    [n, spread, skew, outliers, seed],
  );
  const stats = useMemo(() => summarize(sample), [sample]);
  const histogram = useMemo(() => makeHistogram(sample), [sample]);
  const meanMedianGap = Math.abs(stats.mean - stats.median);
  const criterion = getCriterion(goal, design, scale);
  const alpha = (items * averageCorrelation) / (1 + (items - 1) * averageCorrelation);
  const currentQuiz = quizCases[quizIndex];
  const normalizedP = Number(pValue.replace(",", "."));
  const reportText =
    reportTest === "mann-whitney"
      ? `Между группами обнаружены ${normalizedP < 0.05 ? "статистически значимые" : "статистически незначимые"} различия по исследуемому показателю (U = ${statistic}; p = ${pValue}; r = ${effect}). Размер эффекта следует интерпретировать вместе с содержательным значением различий и доверительным интервалом.`
      : reportTest === "spearman"
        ? `Выявлена ${normalizedP < 0.05 ? "статистически значимая" : "статистически незначимая"} монотонная связь между показателями (ρ = ${statistic}; p = ${pValue}). Коэффициент описывает направление и тесноту связи, но не доказывает причинность.`
        : reportTest === "pearson"
          ? `Между показателями выявлена ${normalizedP < 0.05 ? "статистически значимая" : "статистически незначимая"} линейная связь (r = ${statistic}; p = ${pValue}; 95% ДИ следует указать отдельно). Связь не является доказательством причинного влияния.`
          : reportTest === "t-independent"
            ? normalizedP < 0.05
              ? `Средние значения двух независимых групп статистически значимо различались (t = ${statistic}; p = ${pValue}; d = ${effect}). Для полного отчёта добавьте степени свободы, M и SD групп, разность средних и 95% доверительный интервал.`
              : `Статистически значимых различий между средними двух независимых групп не выявлено (t = ${statistic}; p = ${pValue}; d = ${effect}). Для полного отчёта добавьте степени свободы, M и SD групп, разность средних и 95% доверительный интервал.`
            : reportTest === "t-welch"
              ? normalizedP < 0.05
                ? `По критерию Уэлча средние значения двух независимых групп статистически значимо различались (tᵂ = ${statistic}; p = ${pValue}; g = ${effect}). Укажите скорректированные степени свободы, средние и SD групп, разность средних и 95% доверительный интервал.`
                : `Критерий Уэлча не выявил статистически значимых различий между средними двух независимых групп (tᵂ = ${statistic}; p = ${pValue}; g = ${effect}). Укажите скорректированные степени свободы, средние и SD групп, разность средних и 95% доверительный интервал.`
              : reportTest === "t-paired"
                ? `Между двумя связанными измерениями ${normalizedP < 0.05 ? "выявлено статистически значимое изменение" : "не выявлено статистически значимого изменения"} (t = ${statistic}; p = ${pValue}; dᶻ = ${effect}). Добавьте среднюю парную разность, SD разностей и 95% доверительный интервал.`
                : reportTest === "wilcoxon"
                  ? `Парные измерения ${normalizedP < 0.05 ? "статистически значимо различались" : "не показали статистически значимого различия"} по критерию Уилкоксона (W = ${statistic}; p = ${pValue}; rᵣᵦ = ${effect}). Для интерпретации укажите направление сдвига и описательные показатели парных данных.`
            : reportTest === "anova"
              ? `Однофакторный дисперсионный анализ показал, что групповой фактор ${normalizedP < 0.05 ? "статистически значимо связан" : "не показал статистически значимой связи"} с исследуемым показателем (F = ${statistic}; p = ${pValue}; η² = ${effect}). ${normalizedP < 0.05 ? "Для локализации различий нужны post hoc сравнения или запланированные контрасты." : "Оснований отвергать равенство всех генеральных средних не получено."}`
              : reportTest === "factorial"
                ? `В двухфакторной модели проверяемый эффект ${normalizedP < 0.05 ? "оказался статистически значимым" : "не оказался статистически значимым"} (F = ${statistic}; p = ${pValue}; ηp² = ${effect}). Уточните, относится результат к фактору A, фактору B или взаимодействию A×B; при значимом взаимодействии разберите простые эффекты.`
                : reportTest === "chi-square"
                  ? `Между категориальными переменными ${normalizedP < 0.05 ? "выявлена статистически значимая связь" : "не выявлена статистически значимая связь"} (χ² = ${statistic}; p = ${pValue}; V Крамера = ${effect}). Для значимого результата опишите направление по долям и стандартизированным остаткам.`
                  : `Регрессионная модель ${normalizedP < 0.05 ? "статистически значима" : "не достигла статистической значимости"} (R² = ${statistic}; p = ${pValue}; R²скорр. = ${effect}). Перед содержательным выводом проверьте остатки, влиятельные наблюдения, мультиколлинеарность, доверительные интервалы коэффициентов и устойчивость модели.`;

  const currentPage = view === "home" ? null : pageMeta[view];

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="СтатЛаб — на главную">
          <span className="brand-mark">Σ</span>
          <span>
            <strong>СТАТЛАБ</strong>
            <small>психология × данные</small>
          </span>
        </Link>

        <nav aria-label="Основная навигация">
          {navigation.map((item) => (
            <a className={view === item.view ? "active" : ""} href={item.href} key={item.view}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className="header-action" href="/practice">
          Решать задачи <span aria-hidden="true">↗</span>
        </a>
      </header>

      {currentPage && (
        <section className={`section-page-hero section-page-${view}`} id="top">
          <div className="section-page-grid" aria-hidden="true" />
          <div className="section-page-copy">
            <Link className="section-breadcrumb" href="/">СтатЛаб <span>→</span> {currentPage.index}</Link>
            <p className="section-page-kicker">{currentPage.kicker}</p>
            <h1>{currentPage.title}</h1>
            <p className="section-page-lead">{currentPage.lead}</p>
          </div>
          <aside className="section-page-topics" aria-label="Темы раздела">
            <span>В ЭТОМ РАЗДЕЛЕ</span>
            {currentPage.topics.map((topic, index) => (
              <p key={topic}><i>0{index + 1}</i>{topic}</p>
            ))}
          </aside>
        </section>
      )}

      <section className="hero" id="top" hidden={view !== "home"}>
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <span className="hero-cross cross-one" aria-hidden="true">+</span>
        <span className="hero-cross cross-two" aria-hidden="true">+</span>

        <div className="hero-frame">
          <div className="eyebrow">МАТЕМАТИЧЕСКИЕ МЕТОДЫ · ПСИХОДИАГНОСТИКА · ИССЛЕДОВАНИЯ</div>
          <div className="hero-copy">
            <p className="chapter">ЛАБОРАТОРИЯ / 01</p>
            <h1>
              СТАТИСТИКА,
              <br />
              КОТОРУЮ МОЖНО
              <br />
              <span>ПОТРОГАТЬ</span>
            </h1>
            <p className="hero-lead">
              Учись на психологических данных: меняй выборку, ломай распределение,
              выбирай критерий и сразу смотри, что произошло с результатом.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="/basics">Начать эксперимент</a>
              <a className="text-link" href="#how-it-works">Как это работает <span>↓</span></a>
            </div>
          </div>

          <div className="hero-symbol" aria-hidden="true">
            <span>ψ</span>
            <i className="symbol-dot dot-one" />
            <i className="symbol-dot dot-two" />
            <i className="symbol-dot dot-three" />
          </div>

          <div className="hero-proof">
            <span className="proof-number">3</span>
            <p><strong>уровня объяснения</strong><br />простыми словами · статистически · для отчёта</p>
          </div>
        </div>
      </section>

      <section className="manifest" id="how-it-works" hidden={view !== "home"}>
        <p className="section-index">01 — ПРИНЦИП</p>
        <div>
          <h2>НЕ ЗАПОМИНАТЬ КНОПКИ.<br /><span>ПОНИМАТЬ РЕШЕНИЕ.</span></h2>
          <p>
            SPSS и jamovi считают быстро. Лаборатория учит тому, что программа
            не решит за исследователя: какой метод выбрать, какие предпосылки
            проверить и где заканчивается значимость, а начинается смысл.
          </p>
        </div>
      </section>

      <section className="laboratory" id="laboratory" hidden={view !== "basics"}>
        <div className="lab-heading">
          <div>
            <p className="section-index light">01.1 — ЖИВОЙ ЭКСПЕРИМЕНТ</p>
            <h2>АНАТОМИЯ<br />РАСПРЕДЕЛЕНИЯ</h2>
          </div>
          <p className="lab-intro">
            Перед тобой синтетическая выборка баллов психологической шкалы.
            Меняй параметры и наблюдай, какие показатели устойчивы, а какие
            начинают врать первыми.
          </p>
        </div>

        <div className="lab-shell">
          <aside className="lab-controls" aria-label="Параметры выборки">
            <div className="control-heading">
              <span>ПАРАМЕТРЫ</span>
              <button type="button" onClick={() => setSeed((value) => value + 1)}>
                Новая выборка <span aria-hidden="true">↻</span>
              </button>
            </div>

            <label className="slider-control">
              <span><b>Объём выборки</b><output>{n}</output></span>
              <input
                aria-label="Объём выборки"
                type="range"
                min="20"
                max="240"
                step="10"
                value={n}
                onChange={(event) => setN(Number(event.target.value))}
              />
              <small>n = число наблюдений</small>
            </label>

            <label className="slider-control">
              <span><b>Разброс данных</b><output>{spread}</output></span>
              <input
                aria-label="Стандартное отклонение"
                type="range"
                min="3"
                max="22"
                value={spread}
                onChange={(event) => setSpread(Number(event.target.value))}
              />
              <small>ожидаемое стандартное отклонение</small>
            </label>

            <label className="slider-control">
              <span><b>Асимметрия</b><output>{skew.toFixed(1)}</output></span>
              <input
                aria-label="Асимметрия распределения"
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={skew}
                onChange={(event) => setSkew(Number(event.target.value))}
              />
              <small>− влево · 0 симметрично · + вправо</small>
            </label>

            <div className="outlier-control">
              <span><b>Выбросы</b><output>{outliers}</output></span>
              <div className="segmented" role="group" aria-label="Количество выбросов">
                {[0, 1, 3, 5].map((value) => (
                  <button
                    className={outliers === value ? "active" : ""}
                    type="button"
                    key={value}
                    onClick={() => setOutliers(value)}
                    aria-pressed={outliers === value}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="reset-button"
              type="button"
              onClick={() => {
                setN(80);
                setSpread(10);
                setSkew(0);
                setOutliers(0);
                setSeed(21);
              }}
            >
              Сбросить эксперимент
            </button>
          </aside>

          <div className="lab-visual">
            <div className="visual-toolbar">
              <div>
                <span className="live-dot" />
                ГИСТОГРАММА · ОБНОВЛЯЕТСЯ В РЕАЛЬНОМ ВРЕМЕНИ
              </div>
              <span>ШКАЛА 0–100</span>
            </div>

            <div className="histogram" aria-label="Гистограмма распределения выборки">
              <div className="y-label">ЧАСТОТА</div>
              <div className="bars">
                {histogram.counts.map((count, index) => (
                  <div className="bar-column" key={`${index}-${seed}`}>
                    <span
                      className="bar"
                      style={{ height: `${Math.max((count / histogram.peak) * 100, count ? 5 : 0)}%` }}
                      title={`${count} наблюдений`}
                    />
                  </div>
                ))}
              </div>
              <div className="x-axis">
                <span>{Math.round(histogram.min)}</span>
                <span>{Math.round((histogram.min + histogram.max) / 2)}</span>
                <span>{Math.round(histogram.max)}</span>
              </div>
            </div>

            <div className="stats-row">
              <article><span>СРЕДНЕЕ</span><strong>{format(stats.mean)}</strong><small>чувствительно к выбросам</small></article>
              <article><span>МЕДИАНА</span><strong>{format(stats.median)}</strong><small>устойчива к крайним значениям</small></article>
              <article><span>ДИСПЕРСИЯ s²</span><strong>{format(stats.variance)}</strong><small>средний квадрат отклонений</small></article>
              <article><span>СТ. ОТКЛОНЕНИЕ</span><strong>{format(stats.sd)}</strong><small>разброс вокруг среднего</small></article>
            </div>

            <div className="spread-strip">
              <span><b>MIN</b>{format(stats.min)}</span>
              <span><b>Q1</b>{format(stats.q1)}</span>
              <span><b>IQR</b>{format(stats.iqr)}</span>
              <span><b>Q3</b>{format(stats.q3)}</span>
              <span><b>MAX</b>{format(stats.max)}</span>
            </div>

            <div className={`insight ${meanMedianGap > 2 ? "warning" : ""}`}>
              <span className="insight-mark">i</span>
              <p>
                <strong>{meanMedianGap > 2 ? "Распределение тянет среднее за собой." : "Среднее и медиана пока близки."}</strong>
                {meanMedianGap > 2
                  ? ` Разница уже ${format(meanMedianGap)} балла. Проверь асимметрию и выбросы перед выбором описательных показателей.`
                  : " Для симметричных данных среднее хорошо описывает центр, но одного графика всё равно недостаточно для вывода о нормальности."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="module-preview" id="modules" hidden={view !== "home"}>
        <div className="module-heading">
          <p className="section-index">02 — УЧЕБНЫЙ МАРШРУТ</p>
          <h2>ОТ ПЕРЕМЕННОЙ<br />ДО ВЫВОДА</h2>
        </div>
        <div className="module-grid">
          {[
            ["01", "Основы и выбор метода", "Распределения, дисперсия, выбросы и дерево статистического решения.", "СТАРТ", "/basics"],
            ["02", "Песочница данных", "Двойные выборки, мощность 1-β, перекрытие кривых, выбросы и хирургия тестов.", "ИНТЕРАКТИВ", "/sandbox"],
            ["03", "Критерии и гипотезы", "Корректные H₀ и H₁, предпосылки, ловушки, SPSS и jamovi.", "СПРАВОЧНИК", "/methods"],
            ["04", "Гайды SPSS и jamovi", "Пошаговые маршруты меню, анатомия таблиц вывода, синтаксис и код на Python.", "РУКОВОДСТВО", "/guides"],
            ["05", "ANOVA и модели", "Одно- и двухфакторный ANOVA, χ², регрессия и диагностика модели.", "ЛАБОРАТОРИЯ", "/models"],
            ["06", "Психометрика и нормы", "z, T, стэны, обратные пункты, α, ω, KR-20 и анализ шкалы.", "ИЗМЕРЕНИЕ", "/psychometrics"],
            ["07", "Многомерные методы", "PCA, EFA, кластеры, MDS и психофизика на интерактивных моделях.", "ПРОДВИНУТОЕ", "/multivariate"],
            ["08", "Практикум и отчёт", "Кейсы, чтение таблиц и генератор корректной формулировки результата.", "ТРЕНАЖЁР", "/practice"],
          ].map(([number, title, description, type, href]) => (
            <article className="module-card" key={number}>
              <span>{number}</span>
              <em>{type}</em>
              <h3>{title}</h3>
              <p>{description}</p>
              <a href={href} aria-label={`Открыть модуль ${title}`}>Открыть модуль <i>→</i></a>
            </article>
          ))}
        </div>
      </section>

      <section className="criterion-section" id="criterion" hidden={view !== "basics"}>
        <div className="criterion-title">
          <p className="section-index light">01.2 — КОНСТРУКТОР РЕШЕНИЯ</p>
          <h2>КАКОЙ КРИТЕРИЙ<br /><span>ВЫБРАТЬ?</span></h2>
          <p>
            Выбор начинается не с кнопки «проверить нормальность», а с вопроса,
            дизайна и типа данных. Собери свою ситуацию — лаборатория объяснит
            решение и покажет путь в двух программах.
          </p>
        </div>

        <div className="decision-builder">
          <div className="decision-steps">
            <fieldset>
              <legend><span>1</span> ЧТО НУЖНО УЗНАТЬ?</legend>
              <div className="choice-grid goal-grid">
                {[
                  ["difference", "Сравнить", "группы или измерения"],
                  ["association", "Найти связь", "между переменными"],
                  ["prediction", "Предсказать", "значение или исход"],
                  ["reliability", "Проверить шкалу", "внутреннюю согласованность"],
                ].map(([value, title, note]) => (
                  <button
                    type="button"
                    className={goal === value ? "selected" : ""}
                    key={value}
                    onClick={() => setGoal(value)}
                    aria-pressed={goal === value}
                  >
                    <strong>{title}</strong><small>{note}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            {goal === "difference" && (
              <fieldset>
                <legend><span>2</span> КАК УСТРОЕН ДИЗАЙН?</legend>
                <div className="choice-grid design-grid">
                  {[
                    ["two-independent", "2 независимые", "разные люди в группах"],
                    ["two-related", "2 связанные", "те же люди или пары"],
                    ["many-independent", "> 2 независимых", "несколько разных групп"],
                    ["many-related", "> 2 связанных", "повторные измерения"],
                  ].map(([value, title, note]) => (
                    <button
                      type="button"
                      className={design === value ? "selected" : ""}
                      key={value}
                      onClick={() => setDesign(value)}
                      aria-pressed={design === value}
                    >
                      <strong>{title}</strong><small>{note}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend><span>{goal === "difference" ? "3" : "2"}</span> КАКИЕ ДАННЫЕ?</legend>
              <div className="choice-grid scale-grid">
                {[
                  ["continuous", "Количественные", "предпосылки приемлемы"],
                  ["ranked", "Порядковые / проблемные", "асимметрия или выбросы"],
                  ["categorical", "Категориальные", "частоты и доли"],
                ].map(([value, title, note]) => (
                  <button
                    type="button"
                    className={scale === value ? "selected" : ""}
                    key={value}
                    onClick={() => setScale(value)}
                    aria-pressed={scale === value}
                  >
                    <strong>{title}</strong><small>{note}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <aside className="criterion-result" aria-live="polite">
            <p>ПОДХОДЯЩИЙ СТАРТОВЫЙ МЕТОД</p>
            <h3>{criterion.name}</h3>
            <div className="result-explanation">
              <span>ПОЧЕМУ</span>
              <p>{criterion.why}</p>
            </div>
            <div className="result-explanation">
              <span>ПРОВЕРЬ ДО АНАЛИЗА</span>
              <p>{criterion.check}</p>
            </div>
            <div className="software-paths">
              <article><b>SPSS</b><span>{criterion.spss}</span></article>
              <article><b>jamovi</b><span>{criterion.jamovi}</span></article>
            </div>
            <p className="criterion-note">
              Это учебная рекомендация, а не автоматический приговор: окончательный
              метод зависит от дизайна, качества данных и исследовательской модели.
            </p>
          </aside>
        </div>
      </section>

      <section className="trainer-section" id="trainer" hidden={view !== "practice"}>
        <div className="trainer-heading">
          <div>
            <p className="section-index">06.1 — ИССЛЕДОВАТЕЛЬСКИЕ КЕЙСЫ</p>
            <h2>ТЕПЕРЬ<br />ТВОЯ ОЧЕРЕДЬ</h2>
          </div>
          <div className="trainer-progress">
            <span>КЕЙС {Math.min(quizIndex + 1, quizCases.length)} / {quizCases.length}</span>
            <div><i style={{ width: `${quizDone ? 100 : ((quizIndex + 1) / quizCases.length) * 100}%` }} /></div>
            <small>{quizScore} правильных ответов</small>
          </div>
        </div>

        {!quizDone ? (
          <div className="quiz-card">
            <div className="quiz-case">
              <span>{currentQuiz.tag}</span>
              <h3>{currentQuiz.title}</h3>
              <p>{currentQuiz.text}</p>
              <div className="case-data">
                <span>ЗАДАЧА</span>
                <strong>Выбери наиболее обоснованное решение</strong>
              </div>
            </div>
            <div className="quiz-options">
              {currentQuiz.options.map((option, index) => {
                const checked = quizChoice === index;
                const revealed = quizChoice !== null;
                const className = revealed
                  ? index === currentQuiz.correct
                    ? "correct"
                    : checked
                      ? "wrong"
                      : "muted"
                  : "";

                return (
                  <button
                    type="button"
                    key={option}
                    className={className}
                    onClick={() => {
                      if (quizChoice !== null) return;
                      setQuizChoice(index);
                      if (index === currentQuiz.correct) setQuizScore((value) => value + 1);
                    }}
                    disabled={quizChoice !== null}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <strong>{option}</strong>
                    {revealed && index === currentQuiz.correct && <i>верно</i>}
                  </button>
                );
              })}

              {quizChoice !== null && (
                <div className={`quiz-feedback ${quizChoice === currentQuiz.correct ? "success" : "error"}`}>
                  <strong>{quizChoice === currentQuiz.correct ? "Точно." : "Здесь логика сломалась."}</strong>
                  <p>{currentQuiz.explanation}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (quizIndex === quizCases.length - 1) {
                        setQuizDone(true);
                      } else {
                        setQuizIndex((value) => value + 1);
                        setQuizChoice(null);
                      }
                    }}
                  >
                    {quizIndex === quizCases.length - 1 ? "Завершить серию" : "Следующий кейс"} <span>→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="quiz-finish">
            <span className="finish-score">{quizScore}/{quizCases.length}</span>
            <div>
              <p>СЕРИЯ ЗАВЕРШЕНА</p>
              <h3>{quizScore === quizCases.length ? "Методы выбраны без единой жертвы." : "Логика уже есть — осталось докрутить детали."}</h3>
              <button
                type="button"
                onClick={() => {
                  setQuizIndex(0);
                  setQuizChoice(null);
                  setQuizScore(0);
                  setQuizDone(false);
                }}
              >
                Пройти ещё раз ↻
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="psychometrics-section" id="psychometrics" hidden={view !== "psychometrics"}>
        <div className="psycho-title">
          <p className="section-index light">04.1 — НАДЁЖНОСТЬ ШКАЛЫ</p>
          <h2>НАДЁЖНОСТЬ<br /><span>НЕ РАВНА</span> ВАЛИДНОСТИ</h2>
          <p>
            Посмотри, как α растёт от количества похожих пунктов. Коэффициент
            может стать красивее, но методика от этого не обязана измерять именно
            то, что написано в её названии.
          </p>
        </div>

        <div className="reliability-lab">
          <div className="reliability-controls">
            <label>
              <span><b>Количество пунктов</b><output>{items}</output></span>
              <input
                type="range"
                min="3"
                max="30"
                value={items}
                onChange={(event) => setItems(Number(event.target.value))}
                aria-label="Количество пунктов шкалы"
              />
            </label>
            <label>
              <span><b>Средняя межпунктовая корреляция</b><output>{averageCorrelation.toFixed(2)}</output></span>
              <input
                type="range"
                min="0.05"
                max="0.75"
                step="0.01"
                value={averageCorrelation}
                onChange={(event) => setAverageCorrelation(Number(event.target.value))}
                aria-label="Средняя корреляция между пунктами"
              />
            </label>
            <div className="formula-card">
              <span>УПРОЩЁННАЯ ФОРМУЛА</span>
              <strong>α = k · r̄ / [1 + (k − 1) · r̄]</strong>
              <small>Показывает механику коэффициента, но не заменяет анализ реальных пунктов.</small>
            </div>
          </div>

          <div className="alpha-gauge">
            <div className="gauge-shell" style={{ "--alpha": `${alpha * 100}%` } as React.CSSProperties}>
              <div>
                <span>α КРОНБАХА</span>
                <strong>{alpha.toFixed(2)}</strong>
              </div>
            </div>
            <div className="gauge-scale"><span>0</span><span>0,5</span><span>1</span></div>
            <p>
              {alpha >= 0.9
                ? "Очень высокий коэффициент. Проверь, не дублируют ли пункты друг друга — больше не всегда лучше."
                : alpha >= 0.7
                  ? "Условно приемлемый диапазон для учебного примера. Дальше нужны ω, структура и анализ пунктов."
                  : "Согласованность невысока. Но удалять пункты только ради роста α — плохая психометрическая торговля."}
            </p>
          </div>
        </div>
      </section>

      {view === "methods" && <AdvancedLabs section="methods" />}
      {view === "models" && <AdvancedLabs section="models" />}
      {view === "psychometrics" && <AdvancedLabs section="psychometrics" />}
      {view === "multivariate" && <AdvancedLabs section="multivariate" />}

      {view === "sandbox" && <StatSandbox />}
      {view === "guides" && <SPSSGuides />}
      {view === "methods" && <SPSSGuides />}

      {view === "methods" && <ResearchWorkbench section="methods" />}
      {view === "models" && <ResearchWorkbench section="models" />}
      {view === "psychometrics" && <ResearchWorkbench section="psychometrics" />}
      {view === "multivariate" && <ResearchWorkbench section="multivariate" />}
      {view === "practice" && <ResearchWorkbench section="practice" />}

      <section className="report-section" id="report" hidden={view !== "practice"}>
        <div className="report-heading">
          <p className="section-index">06.3 — ИНТЕРПРЕТАЦИЯ</p>
          <h2>ИЗ ТАБЛИЦЫ<br />В НОРМАЛЬНЫЙ ТЕКСТ</h2>
          <p>
            Подставь результат анализа и получи черновик на трёх уровнях. Не
            копируй вслепую: смысл переменных и направление эффекта всё ещё на тебе.
          </p>
        </div>

        <div className="report-builder">
          <div className="report-form">
            <label>
              <span>МЕТОД</span>
              <select value={reportTest} onChange={(event) => setReportTest(event.target.value)}>
                <option value="mann-whitney">U-критерий Манна — Уитни</option>
                <option value="spearman">Корреляция Спирмена</option>
                <option value="pearson">Корреляция Пирсона</option>
                <option value="t-independent">t-критерий для независимых</option>
                <option value="t-welch">t-критерий Уэлча</option>
                <option value="t-paired">Парный t-критерий</option>
                <option value="wilcoxon">Критерий Уилкоксона</option>
                <option value="anova">Однофакторный ANOVA</option>
                <option value="factorial">Двухфакторный ANOVA</option>
                <option value="chi-square">χ² Пирсона</option>
                <option value="regression">Линейная регрессия</option>
              </select>
            </label>
            <div className="report-inputs">
              <label>
                <span>{reportTest === "spearman" ? "ρ" : reportTest === "pearson" ? "r" : reportTest === "t-independent" || reportTest === "t-paired" || reportTest === "t-welch" ? "t" : reportTest === "anova" || reportTest === "factorial" ? "F" : reportTest === "chi-square" ? "χ²" : reportTest === "regression" ? "R²" : reportTest === "wilcoxon" ? "W" : "U"}</span>
                <input value={statistic} onChange={(event) => setStatistic(event.target.value)} aria-label="Значение статистики" />
              </label>
              <label>
                <span>p</span>
                <input value={pValue} onChange={(event) => setPValue(event.target.value)} aria-label="Уровень значимости" />
              </label>
              <label>
                <span>{reportTest === "regression" ? "R² скорр." : reportTest === "anova" ? "η²" : reportTest === "factorial" ? "ηp²" : reportTest === "chi-square" ? "V" : reportTest === "t-independent" ? "d" : reportTest === "t-welch" ? "g" : reportTest === "t-paired" ? "dᶻ" : reportTest === "wilcoxon" ? "rᵣᵦ" : "ЭФФЕКТ"}</span>
                <input value={effect} onChange={(event) => setEffect(event.target.value)} aria-label="Размер эффекта" />
              </label>
            </div>
            <div className="micro-warning">
              <span>!</span>
              <p>p-значение не показывает вероятность истинности H₀ и не говорит, насколько результат важен на практике.</p>
            </div>
          </div>

          <div className="report-output" aria-live="polite">
            <div className="output-tabs">
              <span className="active">ДЛЯ РАБОТЫ</span>
              <span>СТАТИСТИЧЕСКИ</span>
              <span>ПРОСТЫМИ СЛОВАМИ</span>
            </div>
            <p>{reportText}</p>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(reportText);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? "Скопировано ✓" : "Копировать черновик"}
            </button>
          </div>
        </div>
      </section>

      <section className="science-section" hidden={view !== "home"}>
        <div>
          <p className="section-index light">03 — НАУЧНАЯ ОПОРА</p>
          <h2>НЕ «ПОВЕРЬ НАМ».<br /><span>ПРОВЕРЬ ИСТОЧНИК.</span></h2>
        </div>
        <div className="source-list">
          <a href="https://docs.jamovi.org/" target="_blank" rel="noreferrer">
            <span>01</span><div><strong>jamovi Documentation</strong><small>Логика анализов и интерфейс программы</small></div><i>↗</i>
          </a>
          <a href="https://www.ibm.com/docs/en/spss-statistics" target="_blank" rel="noreferrer">
            <span>02</span><div><strong>IBM SPSS Statistics Documentation</strong><small>Официальная документация процедур SPSS</small></div><i>↗</i>
          </a>
          <a href="https://www.itl.nist.gov/div898/handbook/" target="_blank" rel="noreferrer">
            <span>03</span><div><strong>NIST/SEMATECH e-Handbook</strong><small>Распределения, графики и статистические методы</small></div><i>↗</i>
          </a>
          <a href="https://www.apa.org/pubs/journals/resources/research-reporting-standards" target="_blank" rel="noreferrer">
            <span>04</span><div><strong>APA Reporting Standards</strong><small>Стандарты отчётности количественных исследований</small></div><i>↗</i>
          </a>
          <a href="https://docs.jamovi.org/jmv/jmv_efa.html" target="_blank" rel="noreferrer">
            <span>05</span><div><strong>jamovi: Exploratory Factor Analysis</strong><small>Извлечение, вращения, KMO, Бартлетт и факторные нагрузки</small></div><i>↗</i>
          </a>
          <a href="https://www.ibm.com/docs/en/spss-statistics/32.0.0?topic=edition-core-features" target="_blank" rel="noreferrer">
            <span>06</span><div><strong>IBM SPSS: Core Features</strong><small>ANOVA, непараметрические и кластерные процедуры SPSS</small></div><i>↗</i>
          </a>
        </div>
      </section>

    </main>
  );
}
