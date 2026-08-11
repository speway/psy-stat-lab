"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalSeries(n: number, seed: number) {
  const random = seededRandom(seed);
  const values: number[] = [];
  while (values.length < n) {
    const u1 = Math.max(random(), 0.00001);
    const u2 = random();
    values.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }
  return values;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
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

function betaFraction(a: number, b: number, x: number) {
  const tiny = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 120; m += 1) {
    const m2 = 2 * m;
    let step = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + step * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + step / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    step = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + step * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + step / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-10) break;
  }
  return h;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaFraction(a, b, x)) / a;
  return 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

function fSurvival(f: number, df1: number, df2: number) {
  const x = (df1 * f) / (df1 * f + df2);
  return Math.max(0, Math.min(1, 1 - regularizedBeta(x, df1 / 2, df2 / 2)));
}

function display(value: number, digits = 2) {
  return value.toFixed(digits).replace(".", ",");
}

function displayP(value: number) {
  return value < 0.001 ? "< 0,001" : `= ${display(value, 3)}`;
}

type HypothesisTemplate = {
  label: string;
  question: string;
  h0: string;
  h1two: string;
  h1positive?: string;
  h1negative?: string;
  parameter: string;
};

const hypothesisTemplates: Record<string, HypothesisTemplate> = {
  independent: {
    label: "Две независимые группы",
    question: "Различается ли средняя резилентность у студентов двух программ?",
    h0: "Средние значения резилентности в генеральных совокупностях равны: μ₁ = μ₂.",
    h1two: "Средние значения резилентности в генеральных совокупностях различаются: μ₁ ≠ μ₂.",
    h1positive: "Среднее значение резилентности в первой совокупности выше: μ₁ > μ₂.",
    h1negative: "Среднее значение резилентности в первой совокупности ниже: μ₁ < μ₂.",
    parameter: "μ₁ − μ₂",
  },
  paired: {
    label: "Два связанных измерения",
    question: "Изменился ли средний стресс после тренинга?",
    h0: "Средняя парная разность равна нулю: μΔ = 0.",
    h1two: "Средняя парная разность не равна нулю: μΔ ≠ 0.",
    h1positive: "Средний показатель после тренинга выше: μΔ > 0.",
    h1negative: "Средний показатель после тренинга ниже: μΔ < 0.",
    parameter: "μΔ",
  },
  correlation: {
    label: "Связь показателей",
    question: "Связаны ли импульсивность и агрессивность?",
    h0: "Коэффициент связи в генеральной совокупности равен нулю: ρ = 0.",
    h1two: "Коэффициент связи в генеральной совокупности не равен нулю: ρ ≠ 0.",
    h1positive: "Связь в генеральной совокупности положительная: ρ > 0.",
    h1negative: "Связь в генеральной совокупности отрицательная: ρ < 0.",
    parameter: "ρ",
  },
  factorial: {
    label: "Два фактора",
    question: "Зависит ли напряжение от жанра игры и опыта игрока?",
    h0: "Для каждого эффекта отдельно: различий между уровнями фактора нет; взаимодействие A×B равно нулю.",
    h1two: "Хотя бы один главный эффект или взаимодействие отличается от нуля. Для A, B и A×B нужны отдельные проверки.",
    parameter: "αᵢ, βⱼ, (αβ)ᵢⱼ",
  },
  contingency: {
    label: "Категориальные признаки",
    question: "Связан ли формат обучения с завершением программы?",
    h0: "Формат обучения и завершение программы статистически независимы.",
    h1two: "Формат обучения и завершение программы статистически связаны.",
    parameter: "Pᵢⱼ = Pᵢ·Pⱼ",
  },
  regression: {
    label: "Регрессионная модель",
    question: "Предсказывает ли резилентность уровень негативной реактивности?",
    h0: "Регрессионный коэффициент предиктора равен нулю: β₁ = 0.",
    h1two: "Регрессионный коэффициент предиктора отличается от нуля: β₁ ≠ 0.",
    h1positive: "Регрессионный коэффициент положителен: β₁ > 0.",
    h1negative: "Регрессионный коэффициент отрицателен: β₁ < 0.",
    parameter: "β₁",
  },
};

function buildTwoWay(genreEffect: number, experienceEffect: number, interaction: number, sd: number, n: number) {
  const genreOffsets = [-1, 0, 1];
  const experienceOffsets = [-0.5, 0.5];
  const cells = genreOffsets.map((genre) => experienceOffsets.map((experience) =>
    52 + genre * genreEffect + experience * experienceEffect + genre * experience * interaction,
  ));
  const a = cells.length;
  const b = cells[0].length;
  const grand = cells.flat().reduce((sum, value) => sum + value, 0) / (a * b);
  const rowMeans = cells.map((row) => row.reduce((sum, value) => sum + value, 0) / b);
  const columnMeans = Array.from({ length: b }, (_, column) => cells.reduce((sum, row) => sum + row[column], 0) / a);
  const ssA = n * b * rowMeans.reduce((sum, mean) => sum + (mean - grand) ** 2, 0);
  const ssB = n * a * columnMeans.reduce((sum, mean) => sum + (mean - grand) ** 2, 0);
  const ssAB = n * cells.reduce((outer, row, i) => outer + row.reduce(
    (sum, mean, j) => sum + (mean - rowMeans[i] - columnMeans[j] + grand) ** 2,
    0,
  ), 0);
  const dfA = a - 1;
  const dfB = b - 1;
  const dfAB = dfA * dfB;
  const dfError = a * b * (n - 1);
  const ssError = a * b * (n - 1) * sd ** 2;
  const msError = ssError / dfError;
  const metric = (ss: number, df: number) => {
    const f = ss / df / msError;
    return { f, p: fSurvival(f, df, dfError), eta: ss / (ss + ssError) };
  };
  return { cells, dfError, genre: metric(ssA, dfA), experience: metric(ssB, dfB), interaction: metric(ssAB, dfAB) };
}

function chiSquareTable(association: number) {
  const shift = Math.round(association);
  const successes = [30 - shift, 30, 30 + shift];
  const observed = successes.map((success) => [success, 60 - success]);
  const rows = observed.map((row) => row[0] + row[1]);
  const columns = [0, 1].map((column) => observed.reduce((sum, row) => sum + row[column], 0));
  const total = rows.reduce((sum, row) => sum + row, 0);
  const expected = observed.map((_, i) => [0, 1].map((j) => (rows[i] * columns[j]) / total));
  const residuals = observed.map((row, i) => row.map((value, j) => (value - expected[i][j]) / Math.sqrt(expected[i][j])));
  const chi = observed.reduce((outer, row, i) => outer + row.reduce((sum, value, j) => sum + (value - expected[i][j]) ** 2 / expected[i][j], 0), 0);
  const p = Math.exp(-chi / 2);
  const v = Math.sqrt(chi / total);
  return { observed, expected, residuals, chi, p, v, total };
}

function solve(matrix: number[][], target: number[]) {
  const augmented = matrix.map((row, i) => [...row, target[i]]);
  for (let column = 0; column < matrix.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < matrix.length; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column] || 1e-10;
    augmented[column] = augmented[column].map((value) => value / divisor);
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      augmented[row] = augmented[row].map((value, index) => value - factor * augmented[column][index]);
    }
  }
  return augmented.map((row) => row[row.length - 1]);
}

function fitRegression(curve: number, noise: number, predictorCorrelation: number, quadratic: boolean) {
  const n = 64;
  const xBase = normalSeries(n, 1901);
  const secondNoise = normalSeries(n, 1902);
  const error = normalSeries(n, 1903);
  const r = predictorCorrelation / 100;
  const rows = xBase.map((x1, index) => {
    const x2 = r * x1 + Math.sqrt(1 - r ** 2) * secondNoise[index];
    const y = 50 - 6.2 * x1 + 4.4 * x2 + curve * (x1 ** 2 - 1) + error[index] * noise;
    return { x1, x2, y };
  });
  const features = rows.map((row) => quadratic ? [1, row.x1, row.x1 ** 2, row.x2] : [1, row.x1, row.x2]);
  const p = features[0].length;
  const xtx = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => features.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const xty = Array.from({ length: p }, (_, i) => features.reduce((sum, row, index) => sum + row[i] * rows[index].y, 0));
  const coefficients = solve(xtx, xty);
  const points = rows.map((row, index) => {
    const predicted = features[index].reduce((sum, value, column) => sum + value * coefficients[column], 0);
    return { ...row, predicted, residual: row.y - predicted };
  });
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / n;
  const sse = points.reduce((sum, point) => sum + point.residual ** 2, 0);
  const sst = rows.reduce((sum, row) => sum + (row.y - meanY) ** 2, 0);
  const rSquared = 1 - sse / sst;
  const adjusted = 1 - (1 - rSquared) * (n - 1) / (n - p);
  const vif = 1 / (1 - r ** 2);
  return { coefficients, points, rSquared, adjusted, vif };
}

type Item = { id: number; label: string; loading: number; reverse: boolean };

const scaleItems: Item[] = [
  { id: 1, label: "Сохраняю спокойствие", loading: 0.72, reverse: false },
  { id: 2, label: "Быстро восстанавливаюсь", loading: 0.77, reverse: false },
  { id: 3, label: "Теряюсь при трудностях", loading: 0.64, reverse: true },
  { id: 4, label: "Нахожу способ продолжать", loading: 0.74, reverse: false },
  { id: 5, label: "Долго не могу прийти в себя", loading: 0.59, reverse: true },
  { id: 6, label: "Адаптируюсь к переменам", loading: 0.70, reverse: false },
  { id: 7, label: "Избегаю сложных задач", loading: 0.42, reverse: true },
  { id: 8, label: "Опираюсь на прошлый опыт", loading: 0.55, reverse: false },
];

function alphaFromMatrix(matrix: number[][]) {
  const k = matrix.length;
  if (k < 2) return 0;
  const totalVariance = matrix.flat().reduce((sum, value) => sum + value, 0);
  return (k / (k - 1)) * (1 - k / totalVariance);
}

function buildScaleMetrics(excluded: number[], reversed: boolean) {
  const items = scaleItems.filter((item) => !excluded.includes(item.id));
  const signs = items.map((item) => item.reverse && !reversed ? -1 : 1);
  const matrix = items.map((item, i) => items.map((other, j) => i === j ? 1 : item.loading * other.loading * signs[i] * signs[j]));
  const alpha = alphaFromMatrix(matrix);
  const signedLoadings = items.map((item, index) => item.loading * signs[index]);
  const omegaNumerator = signedLoadings.reduce((sum, value) => sum + value, 0) ** 2;
  const omegaDenominator = omegaNumerator + items.reduce((sum, item) => sum + (1 - item.loading ** 2), 0);
  const omega = omegaNumerator / omegaDenominator;
  const rows = items.map((item, index) => {
    const rest = items.filter((_, restIndex) => restIndex !== index);
    const covariance = matrix[index].reduce((sum, value, column) => column === index ? sum : sum + value, 0);
    const restIndexes = items.map((_, itemIndex) => itemIndex).filter((itemIndex) => itemIndex !== index);
    const restVariance = restIndexes.reduce((outer, row) => outer + restIndexes.reduce((sum, column) => sum + matrix[row][column], 0), 0);
    const itemTotal = covariance / Math.sqrt(Math.max(restVariance, 0.0001));
    const deletedMatrix = matrix.filter((_, row) => row !== index).map((row) => row.filter((_, column) => column !== index));
    return { ...item, itemTotal, alphaDeleted: alphaFromMatrix(deletedMatrix), restCount: rest.length };
  });
  return { items, alpha, omega, rows };
}

const outputTasks = [
  {
    title: "Независимый t-тест",
    note: "В SPSS даны две строки — сначала смотри на Ливиня.",
    columns: ["Проверка", "Статистика", "df", "p"],
    rows: [["Ливинь", "7,214", "—", "0,009"], ["t · равные дисперсии", "−2,086", "78", "0,040"], ["t · равенство не задано", "−2,431", "61,7", "0,018"]],
    options: ["Использовать первую строку t, потому что она выше", "Использовать строку Уэлча: дисперсии неодинаковы", "H₀ Ливиня принята", "Перейти к критерию Манна — Уитни автоматически"],
    correct: 1,
    explanation: "p Ливиня = 0,009 указывает на несовместимость с равенством дисперсий. Для сравнения средних читаем строку Equal variances not assumed: t(61,7) = −2,431; p = 0,018.",
  },
  {
    title: "Однофакторный ANOVA",
    note: "Общий тест отвечает только на общий вопрос.",
    columns: ["Источник", "SS", "df", "F", "p", "η²"],
    rows: [["Между группами", "824,6", "2", "6,42", "0,003", "0,128"], ["Внутри групп", "5589,2", "87", "", "", ""]],
    options: ["Все три группы различаются", "Хотя бы одно среднее отличается; нужны post hoc", "Эффект равен 12,8 балла", "Дисперсии точно равны"],
    correct: 1,
    explanation: "F(2, 87) = 6,42; p = 0,003 отвергает равенство всех средних. η² = 0,128 — доля выборочной вариативности, связанная с фактором. Пары локализуют post hoc или контрасты.",
  },
  {
    title: "Множественная регрессия",
    note: "Значимость модели и значимость отдельных предикторов — разные вопросы.",
    columns: ["Предиктор", "b", "β", "t", "p", "VIF"],
    rows: [["Резилентность", "−0,58", "−0,49", "−5,31", "< 0,001", "1,34"], ["Импульсивность", "0,31", "0,26", "2,89", "0,005", "1,34"], ["Подавление", "0,08", "0,06", "0,74", "0,462", "1,05"]],
    options: ["Все предикторы значимы, потому что R² модели значим", "Подавление — сильнейший предиктор", "Два предиктора дают уникальный вклад; VIF не выглядит критичным", "β доказывает причинное влияние"],
    correct: 2,
    explanation: "Резилентность и импульсивность имеют значимые частные коэффициенты, подавление — нет. VIF около 1,3 не указывает на выраженную мультиколлинеарность, но причинность из модели не следует.",
  },
  {
    title: "Факторный анализ",
    note: "Пригодность матрицы — ещё не готовая структура.",
    columns: ["Проверка", "Значение", "p"],
    rows: [["KMO", "0,812", "—"], ["Бартлетт χ²(45)", "486,2", "< 0,001"], ["Параллельный анализ", "2 фактора", "—"]],
    options: ["KMO доказывает двухфакторную теорию", "Бартлетт проверяет нормальность", "Матрица пригодна; число факторов поддерживает параллельный анализ", "Нужно оставить все компоненты с λ < 1"],
    correct: 2,
    explanation: "KMO и Бартлетт поддерживают возможность факторизации. Число факторов выбирают по параллельному анализу, scree plot, интерпретируемости и устойчивости, а не по одному KMO.",
  },
];

type WorkbenchSection = "methods" | "models" | "psychometrics" | "multivariate" | "practice";

export default function ResearchWorkbench({ section }: { section: WorkbenchSection }) {
  const [hypothesisKind, setHypothesisKind] = useState("independent");
  const [direction, setDirection] = useState<"two" | "positive" | "negative">("two");
  const [genreEffect, setGenreEffect] = useState(4);
  const [experienceEffect, setExperienceEffect] = useState(6);
  const [interaction, setInteraction] = useState(0);
  const [factorialSd, setFactorialSd] = useState(9);
  const [association, setAssociation] = useState(8);
  const [curve, setCurve] = useState(0);
  const [regressionNoise, setRegressionNoise] = useState(5);
  const [predictorCorrelation, setPredictorCorrelation] = useState(35);
  const [quadratic, setQuadratic] = useState(false);
  const [reverseScored, setReverseScored] = useState(false);
  const [excludedItems, setExcludedItems] = useState<number[]>([]);
  const [binaryItems, setBinaryItems] = useState(false);
  const [mdsDimensions, setMdsDimensions] = useState(2);
  const [stimulus, setStimulus] = useState(48);
  const [outputIndex, setOutputIndex] = useState(0);
  const [outputChoice, setOutputChoice] = useState<number | null>(null);

  const hypothesis = hypothesisTemplates[hypothesisKind];
  const h1 = direction === "positive" && hypothesis.h1positive
    ? hypothesis.h1positive
    : direction === "negative" && hypothesis.h1negative
      ? hypothesis.h1negative
      : hypothesis.h1two;
  const factorial = useMemo(
    () => buildTwoWay(genreEffect, experienceEffect, interaction, factorialSd, 28),
    [genreEffect, experienceEffect, interaction, factorialSd],
  );
  const contingency = useMemo(() => chiSquareTable(association), [association]);
  const regression = useMemo(
    () => fitRegression(curve, regressionNoise, predictorCorrelation, quadratic),
    [curve, regressionNoise, predictorCorrelation, quadratic],
  );
  const psychometrics = useMemo(
    () => buildScaleMetrics(excludedItems, reverseScored),
    [excludedItems, reverseScored],
  );
  const outputTask = outputTasks[outputIndex];

  const lineCoordinates = factorial.cells.map((row, genreIndex) => row.map((mean, experienceIndex) => ({
    x: 90 + genreIndex * 170,
    y: 235 - (mean - 35) * 4.2,
    mean,
    experienceIndex,
  })));
  const mdsStress = [0.221, 0.094, 0.051][mdsDimensions - 1];
  const sensation = Math.log(stimulus + 1) * 12;
  const jnd = stimulus * 0.08;

  return (
    <>
      <section className="research-map-section" id="research-map" hidden={section !== "methods"}>
        <div className="advanced-heading">
          <div>
            <p className="section-index">02.2 — АРХИТЕКТУРА ИССЛЕДОВАНИЯ</p>
            <h2>ОТ ВОПРОСА<br /><span>ДО МОДЕЛИ</span></h2>
          </div>
          <p>Статистика начинается раньше SPSS: с единицы наблюдения, дизайна, операционализации и заранее сформулированного вопроса. Этот маршрут удерживает исследование от анализа «на авось».</p>
        </div>

        <div className="research-pipeline">
          {[
            ["01", "Вопрос", "Что именно хотим узнать?"],
            ["02", "Дизайн", "Кто, когда и сколько раз измерен?"],
            ["03", "Переменные", "Роль, шкала, кодировка, пропуски."],
            ["04", "Предпосылки", "Графики, остатки, выбросы, зависимость."],
            ["05", "Модель", "Критерий, эффект, ДИ, поправки."],
            ["06", "Вывод", "Ответ на вопрос без причинной магии."],
          ].map(([number, title, text]) => <article key={number}><span>{number}</span><strong>{title}</strong><p>{text}</p></article>)}
        </div>

        <div className="hypothesis-builder" id="hypothesis-builder">
          <div className="hypothesis-builder-controls">
            <span className="workbench-label">КОНСТРУКТОР H₀ / H₁</span>
            <h3>Сначала параметр.<br />Потом формулировка.</h3>
            <label>
              <span>ИССЛЕДОВАТЕЛЬСКИЙ ВОПРОС</span>
              <select value={hypothesisKind} onChange={(event) => setHypothesisKind(event.target.value)}>
                {Object.entries(hypothesisTemplates).map(([value, template]) => <option value={value} key={value}>{template.label}</option>)}
              </select>
            </label>
            <div className="direction-switch" role="group" aria-label="Направленность гипотезы">
              {([['two', 'Двусторонняя'], ['positive', 'Больше / +'], ['negative', 'Меньше / −']] as const).map(([value, label]) => (
                <button type="button" key={value} className={direction === value ? "active" : ""} onClick={() => setDirection(value)} disabled={value !== "two" && !hypothesis.h1positive}>{label}</button>
              ))}
            </div>
            <p className="direction-note">Одностороннюю гипотезу выбирают до просмотра данных и только при содержательном обосновании. «Так p красивее» — не обоснование.</p>
          </div>
          <div className="hypothesis-builder-output" aria-live="polite">
            <span>ПРИМЕР ВОПРОСА</span><p className="research-question">{hypothesis.question}</p>
            <div><b>ПАРАМЕТР</b><code>{hypothesis.parameter}</code></div>
            <article><b>H₀</b><p>{hypothesis.h0}</p></article>
            <article><b>H₁</b><p>{h1}</p></article>
            <small>После анализа: «H₀ отвергнута» или «не получено оснований отвергнуть H₀». Не «H₀ доказана».</small>
          </div>
        </div>
      </section>

      <section className="factorial-section" id="factorial" hidden={section !== "models"}>
        <div className="advanced-heading light-heading">
          <div>
            <p className="section-index light">03.2 — ДВУХФАКТОРНЫЙ ANOVA</p>
            <h2>ГЛАВНЫЕ ЭФФЕКТЫ<br /><span>И ВЗАИМОДЕЙСТВИЕ</span></h2>
          </div>
          <p>Синтетический кейс по эмоциональным реакциям игроков: жанр × опыт. Двигай эффекты и смотри, когда линии перестают быть параллельными — именно это означает взаимодействие.</p>
        </div>

        <div className="factorial-workbench">
          <aside className="factorial-controls">
            <label><span><b>Эффект жанра</b><output>{genreEffect}</output></span><input type="range" min="0" max="10" value={genreEffect} onChange={(event) => setGenreEffect(Number(event.target.value))} /></label>
            <label><span><b>Эффект опыта</b><output>{experienceEffect}</output></span><input type="range" min="0" max="14" value={experienceEffect} onChange={(event) => setExperienceEffect(Number(event.target.value))} /></label>
            <label><span><b>Взаимодействие</b><output>{interaction}</output></span><input type="range" min="-14" max="14" value={interaction} onChange={(event) => setInteraction(Number(event.target.value))} /></label>
            <label><span><b>SD внутри ячеек</b><output>{factorialSd}</output></span><input type="range" min="4" max="16" value={factorialSd} onChange={(event) => setFactorialSd(Number(event.target.value))} /></label>
            <div className="factorial-rule"><b>Если A×B значимо</b><p>Разбирай простые эффекты: как опыт работает внутри каждого жанра и наоборот. Главные средние могут скрыть всю историю.</p></div>
          </aside>

          <div className="factorial-stage">
            <div className="interaction-chart">
              <div className="chart-topline"><span>СРЕДНЕЕ НАПРЯЖЕНИЕ</span><div><i /> до 10 лет <i /> более 10 лет</div></div>
              <svg viewBox="0 0 520 285" role="img" aria-label="График взаимодействия жанра и опыта">
                {[45, 55, 65].map((tick) => <g key={tick}><line x1="52" x2="480" y1={235 - (tick - 35) * 4.2} y2={235 - (tick - 35) * 4.2} /><text x="18" y={239 - (tick - 35) * 4.2}>{tick}</text></g>)}
                {[0, 1].map((experienceIndex) => {
                  const points = lineCoordinates.map((row) => row[experienceIndex]);
                  return <g className={`experience-line experience-${experienceIndex}`} key={experienceIndex}>
                    <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
                    {points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="7" /><text x={point.x} y={point.y - 13}>{display(point.mean, 1)}</text></g>)}
                  </g>;
                })}
                <text x="70" y="274">Шутеры</text><text x="235" y="274">MOBA</text><text x="385" y="274">Кинетические</text>
              </svg>
            </div>
            <div className="factorial-results">
              {[
                ["ЖАНР", factorial.genre], ["ОПЫТ", factorial.experience], ["ЖАНР × ОПЫТ", factorial.interaction],
              ].map(([label, metric]) => {
                const value = metric as { f: number; p: number; eta: number };
                return <article className={value.p < 0.05 ? "significant" : ""} key={label as string}><span>{label as string}</span><strong>F = {display(value.f)}</strong><p>p {displayP(value.p)} · ηp² = {display(value.eta, 3)}</p></article>;
              })}
            </div>
            <div className="factorial-interpretation"><b>{factorial.interaction.p < 0.05 ? "Взаимодействие заметно." : "Убедительного взаимодействия нет."}</b><p>{factorial.interaction.p < 0.05 ? "Линии непараллельны: различие между уровнями опыта меняется в зависимости от жанра. Нужны простые эффекты и скорректированные сравнения." : "Линии примерно параллельны: влияние опыта похоже для разных жанров. Главные эффекты можно интерпретировать осторожно."}</p></div>
          </div>
        </div>
      </section>

      <section className="contingency-section" id="contingency" hidden={section !== "models"}>
        <div className="advanced-heading">
          <div><p className="section-index">03.3 — χ² И ТАБЛИЦЫ СОПРЯЖЁННОСТИ</p><h2>СВЯЗЬ<br /><span>В ЧАСТОТАХ</span></h2></div>
          <p>χ² говорит, что распределения категорий связаны. Остатки показывают, где именно наблюдаемые частоты расходятся с ожидаемыми, а V Крамера — насколько выражена связь.</p>
        </div>

        <div className="contingency-workbench">
          <aside>
            <span className="workbench-label">СИНТЕТИЧЕСКИЙ КЕЙС</span>
            <h3>Формат обучения × завершение курса</h3>
            <label><span><b>Сила различий</b><output>{association}</output></span><input type="range" min="0" max="20" value={association} onChange={(event) => setAssociation(Number(event.target.value))} /></label>
            <div className="chi-metrics"><article><span>χ²(2)</span><strong>{display(contingency.chi)}</strong></article><article><span>p</span><strong>{displayP(contingency.p)}</strong></article><article><span>V КРАМЕРА</span><strong>{display(contingency.v)}</strong></article></div>
            <p className="expected-note">Ожидаемая частота — сколько наблюдений было бы в ячейке при независимости признаков.</p>
          </aside>
          <div className="contingency-table-wrap">
            <div className="contingency-legend"><span>СТАНДАРТИЗИРОВАННЫЙ ОСТАТОК</span><i>меньше ожидаемого</i><i>около ожидания</i><i>больше ожидаемого</i></div>
            <div className="contingency-table" role="table" aria-label="Таблица сопряжённости">
              <div className="ct-head"><span>ФОРМАТ</span><b>ЗАВЕРШИЛ</b><b>НЕ ЗАВЕРШИЛ</b></div>
              {['Очно', 'Гибрид', 'Онлайн'].map((label, i) => <div className="ct-row" key={label}><strong>{label}</strong>{[0, 1].map((j) => {
                const residual = contingency.residuals[i][j];
                return <article key={j} style={{ "--residual": Math.min(Math.abs(residual) / 3, 1), "--residual-color": residual >= 0 ? "var(--sage)" : "var(--rose)" } as CSSProperties}><b>{contingency.observed[i][j]}</b><span>ожид. {display(contingency.expected[i][j], 1)}</span><small>остаток {residual > 0 ? "+" : ""}{display(residual)}</small></article>;
              })}</div>)}
            </div>
            <div className="chi-reading"><b>{contingency.p < 0.05 ? "Связь статистически значима." : "Оснований говорить о связи пока нет."}</b><p>{contingency.p < 0.05 ? "Смотри ячейки с |остатком| примерно от 2 и выше, затем описывай направление через доли. Значимость не заменяет содержательную интерпретацию." : "Наблюдаемые частоты близки к ожидаемым. Это не доказывает абсолютную независимость; учитывай мощность и доверительные интервалы долей."}</p></div>
          </div>
        </div>
      </section>

      <section className="regression-section" id="regression" hidden={section !== "models"}>
        <div className="advanced-heading light-heading">
          <div><p className="section-index light">03.4 — РЕГРЕССИЯ</p><h2>ОТ СВЯЗИ<br /><span>К МОДЕЛИ</span></h2></div>
          <p>Модель показывает уникальный вклад предикторов при прочих равных. Добавь кривизну, шум или корреляцию предикторов — и посмотри, как меняются R², остатки и мультиколлинеарность.</p>
        </div>
        <div className="regression-workbench">
          <aside className="regression-controls">
            <label><span><b>Нелинейность данных</b><output>{curve}</output></span><input type="range" min="0" max="8" value={curve} onChange={(event) => setCurve(Number(event.target.value))} /></label>
            <label><span><b>Случайный шум</b><output>{regressionNoise}</output></span><input type="range" min="2" max="12" value={regressionNoise} onChange={(event) => setRegressionNoise(Number(event.target.value))} /></label>
            <label><span><b>Связь предикторов</b><output>{predictorCorrelation}%</output></span><input type="range" min="0" max="92" value={predictorCorrelation} onChange={(event) => setPredictorCorrelation(Number(event.target.value))} /></label>
            <div className="model-toggle"><span><b>Модель</b><small>{quadratic ? "линейная + x²" : "только линейная"}</small></span><button type="button" className={quadratic ? "on" : ""} onClick={() => setQuadratic((value) => !value)}><i /></button></div>
            <div className={`vif-card ${regression.vif > 5 ? "warning" : ""}`}><span>VIF ПРЕДИКТОРОВ</span><strong>{display(regression.vif)}</strong><p>{regression.vif > 5 ? "Коэффициенты становятся нестабильнее. Проверь ДИ, структуру предикторов и теорию." : "Выраженной мультиколлинеарности в учебной модели нет."}</p></div>
          </aside>
          <div className="regression-stage">
            <div className="regression-metrics"><article><span>R²</span><strong>{display(regression.rSquared, 3)}</strong></article><article><span>R² СКОРР.</span><strong>{display(regression.adjusted, 3)}</strong></article><article><span>RMSE</span><strong>{display(Math.sqrt(regression.points.reduce((sum, point) => sum + point.residual ** 2, 0) / regression.points.length))}</strong></article></div>
            <div className="regression-plots">
              <div><span>НАБЛЮДАЕМОЕ × ПРЕДСКАЗАННОЕ</span><svg viewBox="0 0 360 230" role="img" aria-label="Наблюдаемые и предсказанные значения"><line x1="35" y1="200" x2="330" y2="25" />{regression.points.map((point, index) => <circle key={index} cx={35 + Math.max(0, Math.min(1, (point.predicted - 30) / 40)) * 295} cy={200 - Math.max(0, Math.min(1, (point.y - 30) / 40)) * 175} r="3.5" />)}</svg></div>
              <div><span>ОСТАТКИ × ПРЕДСКАЗАННОЕ</span><svg viewBox="0 0 360 230" role="img" aria-label="График остатков"><line x1="25" y1="115" x2="338" y2="115" />{regression.points.map((point, index) => <circle key={index} cx={35 + Math.max(0, Math.min(1, (point.predicted - 30) / 40)) * 295} cy={115 - Math.max(-1, Math.min(1, point.residual / 20)) * 90} r="3.5" />)}</svg></div>
            </div>
            <div className="coefficient-grid">
              {regression.coefficients.map((coefficient, index) => <article key={index}><span>{quadratic ? ['КОНСТАНТА', 'РЕЗИЛЕНТНОСТЬ', 'РЕЗИЛЕНТНОСТЬ²', 'ИМПУЛЬСИВНОСТЬ'][index] : ['КОНСТАНТА', 'РЕЗИЛЕНТНОСТЬ', 'ИМПУЛЬСИВНОСТЬ'][index]}</span><strong>b = {display(coefficient)}</strong></article>)}
            </div>
            <div className="residual-message"><b>{curve > 2 && !quadratic ? "Остатки намекают: прямая слишком проста." : "Форма модели выглядит согласованнее с данными."}</b><p>{curve > 2 && !quadratic ? "Включи x² и сравни скорректированный R² и рисунок остатков. Добавлять член нужно содержательно, а не ради охоты за R²." : "В реальном исследовании всё равно проверь Cook’s distance, Q–Q остатков, гомоскедастичность и валидацию модели."}</p></div>
          </div>
        </div>
      </section>

      <section className="item-analysis-section" id="item-analysis" hidden={section !== "psychometrics"}>
        <div className="advanced-heading">
          <div><p className="section-index">04.3 — ПСИХОМЕТРИЧЕСКАЯ ЛАБОРАТОРИЯ</p><h2>ПУНКТЫ,<br /><span>КЛЮЧИ И НАДЁЖНОСТЬ</span></h2></div>
          <p>Учебная шкала резилентности показывает типичный сценарий: обратные пункты забыли перекодировать, α рухнула, а удаление пункта кажется спасением. Сначала исправь ключ — потом суди содержание.</p>
        </div>
        <div className="item-workbench">
          <div className="item-toolbar">
            <div className="reverse-toggle"><span><b>Обратные пункты</b><small>{reverseScored ? "перекодированы: 1↔5, 2↔4" : "пока считаются как прямые"}</small></span><button type="button" className={reverseScored ? "on" : ""} onClick={() => setReverseScored((value) => !value)}><i /></button></div>
            <div className="scale-type-switch"><button type="button" className={!binaryItems ? "active" : ""} onClick={() => setBinaryItems(false)}>Ликерт 1–5</button><button type="button" className={binaryItems ? "active" : ""} onClick={() => setBinaryItems(true)}>Дихотомия 0/1</button></div>
            <button className="restore-items" type="button" onClick={() => setExcludedItems([])}>Вернуть удалённые ↻</button>
          </div>
          <div className="reliability-summary">
            <article><span>α КРОНБАХА</span><strong>{display(psychometrics.alpha)}</strong><p>на основе ковариаций пунктов</p></article>
            <article><span>ω МАКДОНАЛЬДА</span><strong>{display(psychometrics.omega)}</strong><p>по однофакторной учебной модели</p></article>
            <article><span>{binaryItems ? "KR-20" : "ПУНКТОВ"}</span><strong>{binaryItems ? display(psychometrics.alpha) : psychometrics.items.length}</strong><p>{binaryItems ? "для пунктов 0/1" : `из ${scaleItems.length} в расчёте`}</p></article>
            <article className={!reverseScored ? "warning" : "good"}><span>КЛЮЧ</span><strong>{reverseScored ? "OK" : "ОШИБКА"}</strong><p>{reverseScored ? "направление согласовано" : "обратные пункты не обращены"}</p></article>
          </div>
          <div className="item-table" role="table" aria-label="Анализ пунктов шкалы">
            <div className="item-table-head"><span>ПУНКТ</span><b>ТИП</b><b>r ПУНКТ–ШКАЛА</b><b>α БЕЗ ПУНКТА</b><b>ДЕЙСТВИЕ</b></div>
            {psychometrics.rows.map((row) => <div className={`item-table-row ${row.itemTotal < 0 ? "problem" : ""}`} key={row.id}><span><i>{row.id}</i>{row.label}</span><b>{row.reverse ? "обратный" : "прямой"}</b><b>{display(row.itemTotal)}</b><b className={row.alphaDeleted > psychometrics.alpha + 0.01 ? "higher" : ""}>{display(row.alphaDeleted)}</b><button type="button" disabled={psychometrics.items.length <= 3} title={psychometrics.items.length <= 3 ? "Для учебного расчёта оставьте минимум три пункта" : "Исключить пункт из расчёта"} onClick={() => setExcludedItems((items) => [...items, row.id])}>исключить</button></div>)}
          </div>
          <div className="psychometric-lessons">
            <article><b>α выросла после удаления?</b><p>Это сигнал проверить пункт, но не автоматическая команда удалить. Содержание, покрытие конструкта и воспроизводимость важнее косметики коэффициента.</p></article>
            <article><b>ω выше или ниже α?</b><p>Коэффициенты опираются на разные допущения. Показывай модель измерения, интервалы и анализ пунктов, а не выбирай самое красивое число.</p></article>
            <article><b>KR-20</b><p>Для дихотомических пунктов 0/1. При таких данных это частный случай α; он не применяется к обычной шкале Ликерта как отдельная «магическая надёжность».</p></article>
            <article><b>Надёжность ≠ валидность</b><p>Согласованные пункты могут очень надёжно измерять не тот конструкт. Нужны содержательные и структурные свидетельства валидности.</p></article>
          </div>
        </div>
      </section>

      <section className="methods-frontier-section" id="mds" hidden={section !== "multivariate"}>
        <div className="advanced-heading light-heading">
          <div><p className="section-index light">05.2 — MDS И ПСИХОФИЗИКА</p><h2>КАРТА СХОДСТВА<br /><span>И ПОРОГ ОЩУЩЕНИЯ</span></h2></div>
          <p>Продвинутый блок из учебных задач: многомерное шкалирование превращает матрицу расстояний в карту, а психофизика связывает физическую интенсивность стимула с субъективным ощущением.</p>
        </div>
        <div className="frontier-grid">
          <article className="mds-lab">
            <div className="frontier-head"><span>MDS</span><div><h3>Многомерное шкалирование</h3><p>Ближе на карте — психологически похожее по исходным оценкам.</p></div></div>
            <div className="mds-switch">{[1, 2, 3].map((dimension) => <button type="button" key={dimension} className={mdsDimensions === dimension ? "active" : ""} onClick={() => setMdsDimensions(dimension)}>{dimension}D</button>)}</div>
            <div className="mds-map" aria-label="Карта многомерного шкалирования">
              {[
                ["Доверие", 29, 70], ["Близость", 20, 53], ["Поддержка", 40, 45], ["Контроль", 73, 58], ["Конфликт", 81, 27],
              ].map(([label, x, y], index) => <i key={label as string} style={{ left: `${x}%`, bottom: `${mdsDimensions === 1 ? 48 : Number(y) + (mdsDimensions === 3 ? (index % 2 ? 5 : -4) : 0)}%` }}><b>{label}</b></i>)}
              <span className="mds-axis-x">измерение 1 →</span><span className="mds-axis-y">измерение 2 →</span>
            </div>
            <div className="stress-meter"><span>STRESS-1</span><strong>{display(mdsStress, 3)}</strong><div><i style={{ width: `${Math.min(mdsStress / 0.25, 1) * 100}%` }} /></div><p>{mdsDimensions === 1 ? "Одного измерения мало: расстояния искажены." : mdsDimensions === 2 ? "Двумерное решение уже передаёт структуру заметно лучше." : "Третье измерение снижает stress, но усложняет интерпретацию."}</p></div>
            <small>Оси MDS не получают психологические названия автоматически. Их интерпретируют по расположению стимулов и внешним данным.</small>
          </article>
          <article className="psychophysics-lab">
            <div className="frontier-head"><span>Ψ</span><div><h3>Психофизическая кривая</h3><p>Закон Фехнера в учебной форме: S = k · ln(I / I₀).</p></div></div>
            <label><span><b>Интенсивность стимула I</b><output>{stimulus}</output></span><input type="range" min="1" max="100" value={stimulus} onChange={(event) => setStimulus(Number(event.target.value))} /></label>
            <div className="psychophysics-chart">
              <svg viewBox="0 0 500 230" role="img" aria-label="Логарифмическая психофизическая кривая"><path d="M28 204 C70 135 115 100 170 77 C255 42 360 28 472 21" />{Array.from({ length: 10 }, (_, index) => { const x = 28 + index * 49; const i = 1 + index * 11; const y = 204 - Math.log(i + 1) * 39; return <circle key={index} cx={x} cy={y} r="3" />; })}<line x1={28 + (stimulus / 100) * 444} x2={28 + (stimulus / 100) * 444} y1="204" y2={204 - (sensation / 55) * 183} /><circle className="active" cx={28 + (stimulus / 100) * 444} cy={204 - (sensation / 55) * 183} r="7" /></svg>
            </div>
            <div className="psychophysics-results"><article><span>ОЩУЩЕНИЕ S</span><strong>{display(sensation, 1)}</strong></article><article><span>JND ≈ 8% I</span><strong>{display(jnd, 1)}</strong></article></div>
            <p><b>Закон Вебера:</b> едва заметное различие растёт пропорционально исходной интенсивности. Это модель, а доля Вебера зависит от модальности и условий.</p>
          </article>
        </div>
      </section>

      <section className="output-reader-section" id="output-reader" hidden={section !== "practice"}>
        <div className="advanced-heading">
          <div><p className="section-index">06.2 — ЧТЕНИЕ SPSS И JAMOVI</p><h2>ТАБЛИЦА<br /><span>НЕ ГОВОРИТ САМА</span></h2></div>
          <p>Четыре коротких фрагмента вывода устроены как реальные учебные задания: выбери вывод, получи разбор и научись видеть нужную строку, а не первое попавшееся p.</p>
        </div>
        <div className="output-workbench">
          <div className="output-task-tabs">{outputTasks.map((task, index) => <button type="button" key={task.title} className={outputIndex === index ? "active" : ""} onClick={() => { setOutputIndex(index); setOutputChoice(null); }}><span>0{index + 1}</span>{task.title}</button>)}</div>
          <div className="output-screen">
            <div className="output-screen-head"><span>OUTPUT · УЧЕБНЫЙ ФРАГМЕНТ</span><i /><i /><i /></div>
            <h3>{outputTask.title}</h3><p>{outputTask.note}</p>
            <div className="spss-table" role="table"><div className="spss-row spss-head">{outputTask.columns.map((column) => <b key={column}>{column}</b>)}</div>{outputTask.rows.map((row, rowIndex) => <div className="spss-row" key={rowIndex}>{row.map((cell, index) => <span key={index}>{cell}</span>)}</div>)}</div>
          </div>
          <div className="output-question">
            <span className="workbench-label">КАКОЙ ВЫВОД КОРРЕКТЕН?</span>
            <div>{outputTask.options.map((option, index) => <button type="button" key={option} className={outputChoice === null ? "" : index === outputTask.correct ? "correct" : outputChoice === index ? "wrong" : "muted"} onClick={() => outputChoice === null && setOutputChoice(index)} disabled={outputChoice !== null}><i>{String.fromCharCode(65 + index)}</i>{option}</button>)}</div>
            {outputChoice !== null && <article className={outputChoice === outputTask.correct ? "success" : "error"}><b>{outputChoice === outputTask.correct ? "Верно." : "Не совсем."}</b><p>{outputTask.explanation}</p><button type="button" onClick={() => { setOutputIndex((outputIndex + 1) % outputTasks.length); setOutputChoice(null); }}>Следующий фрагмент →</button></article>}
          </div>
        </div>
        <div className="error-hunt-grid">
          {[
            ["n < 60", "Не означает автоматический запрет параметрических методов."],
            ["p > 0,05", "Не доказывает H₀ и не подтверждает идеальную нормальность."],
            ["Регрессия", "Проверяй остатки модели, а не нормальность каждого предиктора."],
            ["ANOVA", "После значимого F нужны сравнения и размер эффекта."],
            ["PCA ≠ EFA", "Компоненты сжимают дисперсию; факторы моделируют общую."],
            ["Кластер", "Красивая дендрограмма ещё не валидирует типологию."],
          ].map(([title, text]) => <article key={title}><b>{title}</b><p>{text}</p></article>)}
        </div>
      </section>
    </>
  );
}
