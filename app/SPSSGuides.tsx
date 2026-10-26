"use client";

import { useState } from "react";

export interface SPSSGuideItem {
  id: string;
  short: string;
  title: string;
  category: "assumptions" | "means" | "nonparametric" | "anova" | "relations" | "multivariate" | "psychometrics";
  categoryLabel: string;
  purpose: string;
  menuPathSPSS: string[];
  optionsSPSS: string[];
  syntaxSPSS: string;
  menuPathJamovi: string;
  pythonSnippet: string;
  tableMockup: {
    title: string;
    note: string;
    headers: string[];
    rows: {
      cells: string[];
      highlightIndex?: number;
      highlightTooltip?: string;
    }[];
  };
  apaReportExample: string;
  studentMistakes: string[];
  psychologyContext: string;
}

export const spssGuides: SPSSGuideItem[] = [
  {
    id: "normality",
    short: "W / K–S",
    title: "Проверка нормальности (Shapiro–Wilk и K–S)",
    category: "assumptions",
    categoryLabel: "Предпосылки",
    purpose: "Проверить, совместимо ли эмпирическое распределение баллов методики с нормальным законом Гаусса.",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Описательные статистики (Descriptive Statistics)",
      "Разведочный анализ (Explore...)",
    ],
    optionsSPSS: [
      "В поле «Зависимые переменные» (Dependent List) перенесите исследуемую шкалу.",
      "Нажмите кнопку «Графики...» (Plots...).",
      "Обязательно поставьте галочку: «Графики с проверкой нормальности» (Normality plots with tests).",
      "В блоке «Описательные» выберите «Гистограммы» (Histograms) и «Стебель с листьями».",
      "Нажмите «Продолжить» (Continue) и «ОК».",
    ],
    syntaxSPSS: `* Проверка нормальности распределения в SPSS:
EXAMINE VARIABLES=Score BY Group
  /PLOT BOXPLOT STEMLEAF NPPLOT HISTOGRAM
  /STATISTICS DESCRIPTIVES
  /CINTERVAL 95
  /MISSING LISTWISE
  /NOTOTAL.`,
    menuPathJamovi: "Exploration → Descriptives → в блоке Statistics отметьте Shapiro–Wilk, в блоке Plots выберите Q–Q",
    pythonSnippet: `from scipy import stats
stat, p = stats.shapiro(data['score'])
print(f"W = {stat:.3f}, p = {p:.4f}")
# p > 0.05 означает, что гипотеза о нормальности не отвергается`,
    tableMockup: {
      title: "Tests of Normality (Критерии нормальности)",
      note: "Для выборок N < 50 ориентируйтесь на Shapiro-Wilk; при N > 300 оценивайте асимметрию и Q-Q график.",
      headers: ["Показатель", "Колмогоров-Смирнов (Статистика)", "df", "Sig.", "Шапиро-Уилк (Статистика)", "df", "Sig."],
      rows: [
        {
          cells: ["Уровень тревожности", "0,084", "45", "0,200*", "0,976", "45", "0,468"],
          highlightIndex: 6,
          highlightTooltip: "Sig. = 0,468 > 0,05: нет оснований отвергать нормальность!",
        },
      ],
    },
    apaReportExample:
      "Проверка нормальности распределения баллов тревожности с помощью критерия Шапиро — Уилка показала совместимость эмпирических данных с нормальным законом (W = 0,976; p = 0,468). Визуальный анализ нормального вероятностного графика (Q–Q plot) также подтвердил близость точек к теоретической прямой.",
    studentMistakes: [
      "Отказ от t-теста при p = 0,049 на выборке 800 человек: при больших N формальные тесты отвергают нормальность из-за микроскопических отклонений.",
      "Слепая вера в K–S без Лиллиефорса: стандартный K–S требует заранее известных генеральных μ и σ.",
      "Игнорирование формы распределения: всегда смотрите на гистограмму, выбросы и асимметрию, а не только на одно p.",
    ],
    psychologyContext:
      "В психологических опросниках (особенно клинических, таких как шкала депрессии Бека BDI) легкая правосторонняя асимметрия в неклинической норме — это нормальное явление, так как большинство здоровых людей набирают низкие баллы.",
  },
  {
    id: "independent-t",
    short: "t-критерий",
    title: "t-критерий для независимых выборок + тест Ливиня",
    category: "means",
    categoryLabel: "Сравнение средних",
    purpose: "Сравнить средние значения количественного психологического показателя в двух независимых группах (например, мужчины vs женщины, очники vs заочники).",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Сравнение средних (Compare Means)",
      "t-критерий для независимых выборок (Independent-Samples T Test...)",
    ],
    optionsSPSS: [
      "В поле «Проверяемые переменные» (Test Variable(s)) перенесите зависимый показатель (например, балл стресса).",
      "В поле «Группирующая переменная» (Grouping Variable) перенесите фактор деления на группы.",
      "Нажмите кнопку «Задать группы...» (Define Groups...) и укажите коды групп (например, 1 и 2).",
      "В версиях SPSS 27+ в блоке «Оценка размера эффекта» поставьте галочку «Estimate effect sizes» (d Коэна, g Хеджеса).",
      "Нажмите «Продолжить» и «ОК».",
    ],
    syntaxSPSS: `* t-критерий для независимых выборок:
T-TEST GROUPS=Group(1 2)
  /MISSING=ANALYSIS
  /VARIABLES=StressScore
  /ES DISPLAY(TRUE)
  /CRITERIA=CI(.95).`,
    menuPathJamovi: "T-Tests → Independent Samples T-Test → Assumption Checks: Homogeneity test; Additional: Effect size",
    pythonSnippet: `import pingouin as pg
# Тест Уэлча по умолчанию (наиболее надёжен):
res = pg.ttest(group1, group2, correction=True)
print(res[['T', 'dof', 'p-val', 'cohen-d', 'CI95%']])`,
    tableMockup: {
      title: "Independent Samples Test (Критерий для независимых выборок)",
      note: "Сначала смотрим строку Levene's Test. Если p > 0.05 — читаем верхнюю строку. Если p < 0.05 — нижнюю строку (Уэлч)!",
      headers: ["Предпосылка", "F (Ливинь)", "Sig. (Ливинь)", "t", "df", "Sig. (2-tailed)", "Mean Difference", "Std. Error Difference"],
      rows: [
        {
          cells: ["Equal variances assumed (равенство принято)", "0,841", "0,362", "2,415", "68", "0,018", "4,320", "1,789"],
          highlightIndex: 2,
          highlightTooltip: "Sig. Ливиня = 0,362 > 0,05: дисперсии равны, читаем эту строку!",
        },
        {
          cells: ["Equal variances not assumed (Уэлч)", "—", "—", "2,428", "66,3", "0,018", "4,320", "1,779"],
          highlightIndex: 5,
          highlightTooltip: "Если бы Ливинь был значим (p < 0,05), читали бы эту нижнюю строку Уэлча.",
        },
      ],
    },
    apaReportExample:
      "Средний уровень стресса у заочников (M = 24,12; SD = 6,85) оказался статистически значимо выше, чем у очников (M = 19,80; SD = 7,42), по критерию t Стьюдента: t(68) = 2,42; p = 0,018; d = 0,60; 95% ДИ разности [0,75; 7,89]. Различие соответствует среднему размеру эффекта.",
    studentMistakes: [
      "Чтение только верхней строки t-теста, даже когда критерий Ливиня показал p = 0,001 (грубое нарушение гомогенности дисперсий).",
      "Указание только p без среднего (M), стандартного отклонения (SD) и размера эффекта (d Коэна).",
      "Применение независимого t-теста для одних и тех же людей «до и после тренинга» (для этого нужен парный t-тест!).",
    ],
    psychologyContext:
      "При неравных объемах групп (например, n₁ = 20 и n₂ = 80) и разной дисперсии классический t Стьюдента может многократно завышать вероятность ошибки I рода. В современных статьях APA всегда рекомендуется приводить критерий Уэлча (нижняя строка).",
  },
  {
    id: "paired-t",
    short: "Парный t",
    title: "t-критерий для связанных выборок (До / После)",
    category: "means",
    categoryLabel: "Сравнение средних",
    purpose: "Сравнить показатели одних и тех же участников в двух измерениях (лонгитюд, тренинг, повторное тестирование) или в подобранных парах (близнецы, супруги).",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Сравнение средних (Compare Means)",
      "t-критерий для связанных выборок (Paired-Samples T Test...)",
    ],
    optionsSPSS: [
      "В списке слева выделите одновременно две переменные (например, «Тревожность_До» и «Тревожность_После»).",
      "Перенесите их стрелкой в поле «Связанные переменные» (Paired Variables) как пару Variable1 — Variable2.",
      "В блоке «Параметры» проверьте доверительный интервал (95%).",
      "Нажмите «ОК».",
    ],
    syntaxSPSS: `* t-критерий для связанных выборок (парный):
T-TEST PAIRS=Anxiety_Pre WITH Anxiety_Post (PAIRED)
  /CRITERIA=CI(.95)
  /MISSING=ANALYSIS.`,
    menuPathJamovi: "T-Tests → Paired Samples T-Test → Measure 1 & Measure 2",
    pythonSnippet: `import pingouin as pg
res = pg.ttest(pre, post, paired=True)
print(res[['T', 'dof', 'p-val', 'cohen-d']])`,
    tableMockup: {
      title: "Paired Samples Test (Парные выборки)",
      note: "Проверяет гипотезу о равенстве нулю среднего значения попарных разностей (μΔ = 0).",
      headers: ["Пара измерений", "Средняя разность", "SD разностей", "95% ДИ (Нижний)", "95% ДИ (Верхний)", "t", "df", "Sig. (2-tailed)"],
      rows: [
        {
          cells: ["Тревога_До − Тревога_После", "4,850", "3,210", "3,721", "5,979", "8,274", "33", "< 0,001"],
          highlightIndex: 7,
          highlightTooltip: "p < 0,001: высокозначимое снижение тревожности после программы тренинга!",
        },
      ],
    },
    apaReportExample:
      "Участие в тренинге эмоциональной саморегуляции привело к статистически значимому снижению уровня тревожности: до тренинга (M = 28,40; SD = 5,12), после тренинга (M = 23,55; SD = 4,89); t(33) = 8,27; p < 0,001; d_z = 1,42; 95% ДИ среднего снижения [3,72; 5,98].",
    studentMistakes: [
      "Проверка нормальности каждого замера отдельно вместо проверки нормальности разностей (D = Pre − Post). Для парного теста важна именно нормальность разностей!",
      "Использование формулы независимого d Коэна без учета корреляции между замерами (d_z занижается или завышается).",
    ],
    psychologyContext:
      "Парный тест обладает намного более высокой статистической мощностью, чем независимый t-тест, так как каждый участник служит собственным контролем, устраняя межиндивидуальную вариативность.",
  },
  {
    id: "mann-whitney",
    short: "U Манна–Уитни",
    title: "U-критерий Манна — Уитни (ранговый аналог)",
    category: "nonparametric",
    categoryLabel: "Непараметрика",
    purpose: "Сравнить две независимые группы по порядковой шкале (баллы школьных оценок, короткие шкалы Лайкерта 1-5) или при грубом нарушении нормальности и наличии выбросов.",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Непараметрические критерии (Nonparametric Tests)",
      "Устаревшие диалоговые окна (Legacy Dialogs)",
      "2 независимые выборки (2 Independent Samples...)",
    ],
    optionsSPSS: [
      "Перенесите показатель в «Список проверяемых переменных» (Test Variable List).",
      "Перенесите фактор в «Группирующую переменную» (Grouping Variable) и задайте коды групп (1 и 2).",
      "Убедитесь, что отмечен флажок «Манна — Уитни (U)» (Mann-Whitney U).",
      "Нажмите «ОК».",
    ],
    syntaxSPSS: `* U-критерий Манна-Уитни в SPSS:
NPAR TESTS
  /M-W= AggressionScore BY Group(1 2)
  /MISSING ANALYSIS.`,
    menuPathJamovi: "T-Tests → Independent Samples T-Test → в блоке Tests отметьте Mann-Whitney U",
    pythonSnippet: `from scipy import stats
stat, p = stats.mannwhitneyu(group1, group2, alternative='two-sided')
# Размер эффекта r = Z / sqrt(N)
print(f"U = {stat:.1f}, p = {p:.4f}")`,
    tableMockup: {
      title: "Test Statistics: Mann-Whitney U",
      note: "В выводе представлены статистика U, сумма рангов W Уилкоксона и стандартизованное значение Z.",
      headers: ["Статистика", "Значение"],
      rows: [
        { cells: ["Mann-Whitney U", "192,500"] },
        { cells: ["Wilcoxon W", "423,500"] },
        {
          cells: ["Z", "−2,482"],
          highlightIndex: 1,
          highlightTooltip: "Z используется для расчета размера эффекта r = |Z| / sqrt(N)",
        },
        {
          cells: ["Asymp. Sig. (2-tailed)", "0,013"],
          highlightIndex: 1,
          highlightTooltip: "p = 0,013 < 0,05: группы различаются статистически значимо!",
        },
      ],
    },
    apaReportExample:
      "Уровень вербальной агрессии у подростков правонарушителей оказался статистически значимо выше (Mdn = 18,50), чем в контрольной группе (Mdn = 12,00), по U-критерию Манна — Уитни: U = 192,50; Z = −2,48; p = 0,013; r = 0,34 (умеренный размер эффекта).",
    studentMistakes: [
      "Называние теста «сравнением медиан»: U Манна-Уитни проверяет распределение рангов. Он сравнивает медианы ТОЛЬКО при абсолютно одинаковой форме распределений в обеих группах!",
      "Приведение M ± SD для описания групп: для ранговых тестов корректно приводить медиану и квартили (Mdn, IQR).",
    ],
    psychologyContext:
      "Идеален для сравнения психологических шкал с сильным эффектом социальной желательности (например, шкала лжи СМИЛ), где данные сильно скошены к нулевым значениям.",
  },
  {
    id: "one-way-anova",
    short: "One-Way ANOVA",
    title: "Однофакторный дисперсионный анализ + Post Hoc",
    category: "anova",
    categoryLabel: "Дисперсионный анализ",
    purpose: "Сравнить средние значения в 3 и более независимых группах (например, сравнение 3 методов психотерапии: КПТ vs Гештальт vs Психоанализ).",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Сравнение средних (Compare Means)",
      "Однофакторный дисперсионный анализ (One-Way ANOVA...)",
    ],
    optionsSPSS: [
      "Показатель перенесите в «Список зависимых» (Dependent List).",
      "Групповой фактор перенесите в «Фактор» (Factor).",
      "Нажмите кнопку «Post Hoc...»: при равных дисперсиях выберите Тьюки (Tukey) или Бонферрони; при неравных — Games-Howell.",
      "Нажмите кнопку «Параметры...» (Options): отметьте «Описательные» (Descriptive) и «Тест на гомогенность дисперсий» (Homogeneity of variance test).",
      "В версиях 27+ отметьте «Оценка размера эффекта» (Eta-squared).",
    ],
    syntaxSPSS: `* Однофакторный ANOVA с post hoc Тьюки и тестом Ливиня:
ONEWAY ResilienceScore BY TherapyType
  /STATISTICS DESCRIPTIVES HOMOGENEITY
  /POSTHOC=TUKEY ALPHA(0.05)
  /ES=OVERALL.`,
    menuPathJamovi: "ANOVA → One-Way ANOVA → Post Hoc Tests (Tukey) → Assumption Checks (Homogeneity)",
    pythonSnippet: `import pingouin as pg
aov = pg.anova(dv='score', between='group', data=df, detailed=True)
print(aov[['Source', 'SS', 'DF', 'MS', 'F', 'p-unc', 'np2']])
# Попарные сравнения:
posthoc = pg.pairwise_tukey(dv='score', between='group', data=df)`,
    tableMockup: {
      title: "ANOVA (Таблица дисперсионного анализа)",
      note: "Общий F-тест отвечает на вопрос: «Есть ли хоть какое-то различие между средними хотя бы двух групп?»",
      headers: ["Источник дисперсии", "Сумма квадратов (SS)", "df", "Средний квадрат (MS)", "F", "Sig."],
      rows: [
        {
          cells: ["Между группами (Between Groups)", "248,320", "2", "124,160", "5,842", "0,004"],
          highlightIndex: 5,
          highlightTooltip: "F(2, 87) = 5,84; p = 0,004: хотя бы одна группа отличается от остальных!",
        },
        { cells: ["Внутри групп (Within Groups / Ошибка)", "1849,150", "87", "21,255", "—", "—"] },
        { cells: ["Всего (Total)", "2097,470", "89", "—", "—", "—"] },
      ],
    },
    apaReportExample:
      "Однофакторный дисперсионный анализ выявил статистически значимое влияние типа психотерапии на показатели жизнестойкости: F(2, 87) = 5,84; p = 0,004; η² = 0,118. Апостериорные сравнения по критерию Тьюки показали, что группа КПТ (M = 48,2; SD = 4,5) значимо опередила контрольную группу (M = 42,1; SD = 4,8; p = 0,003), тогда как различия между КПТ и гештальт-терапией не достигли значимости (p = 0,241).",
    studentMistakes: [
      "Проведение серии из 3 независимых t-тестов вместо ANOVA: при трех t-тестах совокупная вероятность ошибки первого рода возрастает с 5% до 14,3% (инфляция ошибки α).",
      "Остановка на общем значимом F без проведения Post Hoc: общий ANOVA не сообщает, какие конкретно пары групп различаются.",
    ],
    psychologyContext:
      "Показатель η² (эта-квадрат) = 0,118 означает, что 11,8% всей дисперсии жизнестойкости в выборке объясняется фактором терапии (по Коэну: 1% — малый, 6% — средний, 14% — большой эффект).",
  },
  {
    id: "correlation",
    short: "Корреляции",
    title: "Корреляции Пирсона, Спирмена и Частная корреляция",
    category: "relations",
    categoryLabel: "Связи и ассоциации",
    purpose: "Оценить силу и направление связи между двумя количественными или порядковыми психологическими переменными, либо оценить чистую связь при контроле третьей переменной (возраста, тревожности).",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Корреляции (Correlate)",
      "Двумерные (Bivariate...) [или Частные (Partial...)]",
    ],
    optionsSPSS: [
      "Перенесите интересующие переменные в список «Переменные» (Variables).",
      "Отметьте тип коэффициента: «Пирсон» (линейная) или «Спирмен» (ранговая/монотонная).",
      "Выберите «Двусторонний критерий» (Two-tailed).",
      "Поставьте флажок «Отметить значимые корреляции» (Flag significant correlations).",
      "Для исключения третьей переменной используйте «Частные...» (Partial...) и укажите контрольную переменную в поле «Контрольные переменные».",
    ],
    syntaxSPSS: `* Корреляционный анализ Пирсона и Спирмена:
CORRELATIONS
  /VARIABLES=SelfEsteem Anxiety Depression
  /PRINT=TWOTAIL NOSIG
  /MISSING=PAIRWISE.

* Частная корреляция (контролируя возраст):
PARTIAL CORR
  /VARIABLES=SelfEsteem WITH Anxiety BY Age
  /SIGNIFICANCE=TWOTAIL.`,
    menuPathJamovi: "Regression → Correlation Matrix → отметьте Pearson / Spearman / Flag significant correlations",
    pythonSnippet: `import pingouin as pg
# Частная корреляция самооценки и тревоги при контроле возраста:
res = pg.partial_corr(data=df, x='self_esteem', y='anxiety', covar='age')
print(res[['r', 'p-val', 'CI95%']])`,
    tableMockup: {
      title: "Correlations (Корреляционная матрица)",
      note: "Коэффициент r варьирует от −1.0 до +1.0. Две звездочки (**) означают p < 0.01.",
      headers: ["Переменные", "Показатель", "Самооценка", "Тревожность", "Депрессия"],
      rows: [
        {
          cells: ["Самооценка", "Пирсон r\nSig.\nN", "1\n—\n72", "−0,542**\n< 0,001\n72", "−0,481**\n< 0,001\n72"],
          highlightIndex: 3,
          highlightTooltip: "r = −0,542 (p < 0,001): статистически значимая отрицательная связь средней силы!",
        },
        {
          cells: ["Тревожность", "Пирсон r\nSig.\nN", "−0,542**\n< 0,001\n72", "1\n—\n72", "0,618**\n< 0,001\n72"],
        },
      ],
    },
    apaReportExample:
      "Анализ корреляций Пирсона показал статистически значимую отрицательную связь средней силы между уровнем самооценки и тревожностью: r(70) = −0,54; p < 0,001; 95% ДИ [−0,69; −0,35]. Коэффициент детерминации R² = 0,29 свидетельствует о том, что различиями в самооценке объясняется 29% дисперсии тревожности.",
    studentMistakes: [
      "Формулировка «Самооценка снижает тревожность»: корреляционный анализ не доказывает причинно-следственную связь!",
      "Игнорирование диаграммы рассеяния: нелинейная связь (парабола) может иметь r = 0,02, хотя связь идеальная.",
      "Расчет Пирсона по порядковым рангам (например, «место в рейтинге от 1 до 10») — здесь требуется Спирмен или Кендалл.",
    ],
    psychologyContext:
      "В психологии корреляции редко превышают |r| = 0,60–0,70 из-за погрешности психологических методик. Коэффициент |r| > 0,50 в дипломных работах считается сильным результатом.",
  },
  {
    id: "regression",
    short: "Регрессия",
    title: "Множественная линейная регрессия и VIF",
    category: "relations",
    categoryLabel: "Модели и предсказание",
    purpose: "Оценить, как несколько психологических факторов (предикторов) совместно объясняют зависимый результат, и определить относительный вклад каждого предиктора (бета-коэффициенты).",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Регрессия (Regression)",
      "Линейная (Linear...)",
    ],
    optionsSPSS: [
      "Зависимую переменную (например, Академическая успеваемость) перенесите в «Зависимая» (Dependent).",
      "Предикторы (Интеллект, Мотивация, Тревожность) перенесите в «Независимые» (Independent(s)).",
      "В методе выберите «Ввести» (Enter) для стандартной регрессии или «Пошаговый» (Stepwise).",
      "Нажмите кнопку «Статистика...» (Statistics): отметьте «Диагностика коллинеарности» (Collinearity diagnostics для проверки VIF) и «Дарбин — Уотсон» (Durbin-Watson).",
      "Нажмите кнопку «Графики...» (Plots): перенесите *ZRESID в Y и *ZPRED в X для проверки гомоскедастичности.",
    ],
    syntaxSPSS: `* Множественная линейная регрессия с проверкой мультиколлинеарности:
REGRESSION
  /MISSING LISTWISE
  /STATISTICS COEFF OUTS R ANOVA COLLIN TOL
  /CRITERIA=PIN(.05) POUT(.10)
  /NOORIGIN
  /DEPENDENT Performance
  /METHOD=ENTER IQ Motivation Anxiety
  /RESIDUALS DURBIN.`,
    menuPathJamovi: "Regression → Linear Regression → Model Fit (R²) → Assumption Checks (Collinearity VIF)",
    pythonSnippet: `import statsmodels.api as sm
X = sm.add_constant(df[['IQ', 'Motivation', 'Anxiety']])
y = df['Performance']
model = sm.OLS(y, X).fit()
print(model.summary())`,
    tableMockup: {
      title: "Coefficients (Коэффициенты регрессии)",
      note: "Стандартизованный коэффициент Beta позволяет сравнивать силу влияния разных предикторов между собой.",
      headers: ["Модель / Предикторы", "B (Нестанд.)", "Std. Error", "Beta (Станд.)", "t", "Sig.", "Толерантность", "VIF"],
      rows: [
        { cells: ["(Константа)", "12,450", "3,810", "—", "3,268", "0,002", "—", "—"] },
        {
          cells: ["Учебная мотивация", "0,412", "0,095", "0,425", "4,337", "< 0,001", "0,812", "1,232"],
          highlightIndex: 3,
          highlightTooltip: "Beta = 0,425 — сильнейший положительный предиктор успеваемости!",
        },
        { cells: ["Интеллект (IQ)", "0,285", "0,082", "0,310", "3,475", "0,001", "0,795", "1,258"] },
        {
          cells: ["Тревожность", "−0,140", "0,068", "−0,185", "−2,059", "0,043", "0,920", "1,087"],
          highlightIndex: 7,
          highlightTooltip: "VIF = 1,087 < 5: мультиколлинеарность отсутствует, модель устойчива.",
        },
      ],
    },
    apaReportExample:
      "Множественный регрессионный анализ показал, что модель статистически значима: F(3, 76) = 14,82; p < 0,001; R² = 0,369 (скорректированный R² = 0,344). Выделенные предикторы объясняют 36,9% дисперсии успеваемости. Наибольший вклад внесла учебная мотивация (β = 0,425; p < 0,001), затем уровень интеллекта (β = 0,310; p = 0,001) и негативно — тревожность (β = −0,185; p = 0,043). Показатели VIF < 1,3 исключают мультиколлинеарность.",
    studentMistakes: [
      "Сравнение нестандартизованных коэффициентов B между шкалами с разной размерностью (например, баллы теста 0-100 и возраст в годах). Для сравнения силы влияния используют стандартизованные коэффициенты Beta (β)!",
      "Игнорирование мультиколлинеарности: если VIF > 5 или 10, оценки коэффициентов становятся нестабильными из-за дублирования предикторов.",
    ],
    psychologyContext:
      "Регрессия позволяет выявить так называемые эффекты подавления (suppressor effects) и понять, сохраняет ли психологический фактор прогностическую силу при контроле базовых демографических показателей.",
  },
  {
    id: "factor-analysis",
    short: "EFA / PCA",
    title: "Эксплораторный факторный анализ (EFA / PCA)",
    category: "multivariate",
    categoryLabel: "Многомерные методы",
    purpose: "Выявить скрытую структуру опросника, сократить число переменных и сгруппировать пункты теста в латентные факторы (шкалы).",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Снижение размерности (Dimension Reduction)",
      "Факторный анализ (Factor...)",
    ],
    optionsSPSS: [
      "Перенесите все пункты методики в список «Переменные» (Variables).",
      "Кнопка «Описательные» (Descriptives): поставьте галочки «КМО и критерий сферичности Бартлетта» (KMO and Bartlett's test of sphericity).",
      "Кнопка «Выделение» (Extraction): метод — «Метод главных компонент» (PCA) или «Метод главных осей» (Principal axis factoring); отметьте «График каменистой осыпи» (Scree plot).",
      "Кнопка «Вращение» (Rotation): выберите «Прямой облимин» (Direct Oblimin при коррелирующих факторах — стандарт в психологии!) или «Варимакс» (Varimax).",
      "Кнопка «Параметры» (Options): отметьте «Отсортировать по размеру» (Sorted by size) и «Подавлять малые коэффициенты» (Suppress small coefficients < 0.30 или 0.40).",
    ],
    syntaxSPSS: `* Эксплораторный факторный анализ с косоугольным вращением Облимин:
FACTOR
  /VARIABLES Item1 TO Item15
  /MISSING LISTWISE
  /PRINT INITIAL KMO EXTRACTION ROTATION FSCORE
  /PLOT EIGEN
  /CRITERIA MINEIGEN(1) ITERATE(25)
  /EXTRACTION PAF
  /ROTATION OBLIMIN
  /METHOD=CORRELATION.`,
    menuPathJamovi: "Factor → Exploratory Factor Analysis → Rotation: Direct Oblimin / Extraction: MinRes or PAF",
    pythonSnippet: `from factor_analyzer import FactorAnalyzer
fa = FactorAnalyzer(n_factors=3, rotation='oblimin')
fa.fit(df)
loadings = fa.loadings_
print("Факторные нагрузки:\n", loadings)`,
    tableMockup: {
      title: "KMO and Bartlett's Test (Адекватность выборки)",
      note: "KMO > 0.70 — хорошо; тест Бартлетта должен быть p < 0.001.",
      headers: ["Критерий", "Значение"],
      rows: [
        {
          cells: ["Критерий адекватности выборки Кайзера-Мейера-Олкина (KMO)", "0,824"],
          highlightIndex: 1,
          highlightTooltip: "KMO = 0,824 > 0,70: корреляционная матрица прекрасно факторизуется!",
        },
        { cells: ["Критерий сферичности Бартлетта (Прибл. Хи-квадрат)", "482,150"] },
        { cells: ["df", "105"] },
        {
          cells: ["Sig.", "< 0,001"],
          highlightIndex: 1,
          highlightTooltip: "p < 0,001: матрица не является единичной, связи между пунктами реальны.",
        },
      ],
    },
    apaReportExample:
      "Факторный анализ (метод главных осей с вращением Direct Oblimin) 15 пунктов подтвердил пригодность данных: KMO = 0,824; критерий Бартлетта χ²(105) = 482,15; p < 0,001. Анализ графика каменистой осыпи Кеттелла и правило Кайзера (собственные значения > 1) выделили 3 фактора, объясняющих 58,4% совокупной дисперсии. Все пункты имели нагрузки на целевой фактор λ ≥ 0,52 при отсутствии двойных перекрестных нагрузок (> 0,30).",
    studentMistakes: [
      "Использование жесткого ортогонального вращения Варимакс (Varimax) по умолчанию: в психологии личностные черты почти всегда коррелируют между собой, поэтому косоугольное вращение (Oblimin/Promax) теоретически более оправдано.",
      "Автоматический выбор числа факторов только по правилу Кайзера (λ > 1): это правило часто дробит данные на слишком много мелких неинтерпретируемых факторов. Всегда смотрите на Scree plot и содержательный смысл.",
    ],
    psychologyContext:
      "Факторный анализ — это фундаментальный инструмент валидизации психодиагностических тестов (конструктная валидность). Без него разработка опросника не считается завершенной.",
  },
  {
    id: "reliability",
    short: "Надёжность",
    title: "Анализ надёжности: Альфа Кронбаха и перекодирование",
    category: "psychometrics",
    categoryLabel: "Психометрика",
    purpose: "Оценить внутреннюю согласованность шкалы опросника (насколько согласованно все пункты измеряют одну и ту же черту) и выявить неработающие пункты.",
    menuPathSPSS: [
      "Анализ (Analyze)",
      "Шкала (Scale)",
      "Анализ надёжности (Reliability Analysis...)",
    ],
    optionsSPSS: [
      "ВАЖНО! До анализа перекодируйте все обратные пункты через «Преобразовать → Перекодировать в те же переменные» (Transform → Recode). Например, при шкале 1–5 формула: Новый_пункт = 6 − Старый_пункт.",
      "Перенесите все пункты шкалы в поле «Элементы» (Items).",
      "Убедитесь, что модель установлена как «Альфа» (Alpha).",
      "Нажмите кнопку «Статистика...» (Statistics): обязательно отметьте «Пункт» (Item), «Шкала» (Scale) и «Шкала при исключении пункта» (Scale if item deleted).",
      "Нажмите «Продолжить» и «ОК».",
    ],
    syntaxSPSS: `* Перекодирование обратных пунктов (1..5):
RECODE Item3 Item7 Item11 (1=5) (2=4) (3=3) (4=2) (5=1) INTO Item3_rev Item7_rev Item11_rev.
EXECUTE.

* Анализ надёжности шкалы:
RELIABILITY
  /VARIABLES=Item1 Item2 Item3_rev Item4 Item5 Item6 Item7_rev Item8
  /SCALE('Resilience Scale') ALL
  /MODEL=ALPHA
  /STATISTICS=DESCRIPTIVE SCALE
  /SUMMARY=TOTAL.`,
    menuPathJamovi: "Factor → Reliability Analysis → перенесите пункты, отметьте Cronbach’s α, McDonald’s ω, Reverse scaled items",
    pythonSnippet: `import pingouin as pg
# Расчет альфы Кронбаха:
alpha, ci = pg.cronbach_alpha(data=df[['item1', 'item2', 'item3_rev', 'item4']])
print(f"Cronbach's alpha = {alpha:.3f}, 95% CI: {ci}")`,
    tableMockup: {
      title: "Item-Total Statistics (Статистика для элементов)",
      note: "Столбец Cronbach's Alpha if Item Deleted показывает, вырастет ли альфа, если этот пункт выкинуть из теста.",
      headers: ["Пункт опросника", "Среднее шкалы без пункта", "Дисперсия шкалы без пункта", "Скорректированная корреляция пункт–тест", "Альфа при удалении пункта"],
      rows: [
        { cells: ["Item 1 (Уверенность)", "24,50", "18,20", "0,642", "0,812"] },
        { cells: ["Item 2 (Спокойствие)", "25,10", "17,80", "0,710", "0,798"] },
        {
          cells: ["Item 3_rev (Обратный)", "24,80", "19,40", "0,580", "0,821"],
          highlightIndex: 3,
          highlightTooltip: "Корреляция пункт-тест положительная (0,580) — обратный пункт перекодирован верно!",
        },
        {
          cells: ["Item 8 (Шум в комнате)", "26,20", "22,50", "0,140", "0,858"],
          highlightIndex: 4,
          highlightTooltip: "Внимание! Удаление Item 8 повысит альфу с 0,83 до 0,858: пункт слабый!",
        },
      ],
    },
    apaReportExample:
      "Оценка внутренней согласованности разработанной методики жизнестойкости (8 пунктов) продемонстрировала высокую надёжность: α Кронбаха = 0,838; ω Макдональда = 0,845. Все скорректированные коэффициенты корреляции элементов с суммарным баллом превысили пороговое значение 0,40 (r_it от 0,48 до 0,71), за исключением пункта 8 (r_it = 0,14), рекомендованного к исключению.",
    studentMistakes: [
      "Получение отрицательной альфы Кронбаха (например, α = −0,42): это верный признак того, что в шкале есть обратные утверждения, о которых забыли и не перекодировали!",
      "Слепая погоня за α > 0,95: чрезмерно высокая альфа часто говорит не о «великолепной надёжности», а о тавтологии (тест состоит из 15 переформулировок одного и того же вопроса).",
    ],
    psychologyContext:
      "Для исследовательских опросников достаточной считается α ≥ 0,70. Для клинических и психодиагностических тестов, по результатам которых принимаются важные решения о человеке, стандарт требует α ≥ 0,85–0,90.",
  },
];

export default function SPSSGuides() {
  const [selectedId, setSelectedId] = useState<string>("independent-t");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copiedSyntax, setCopiedSyntax] = useState(false);
  const [copiedPython, setCopiedPython] = useState(false);

  const filteredGuides =
    activeCategory === "all"
      ? spssGuides
      : spssGuides.filter((g) => g.category === activeCategory);

  const currentGuide =
    spssGuides.find((g) => g.id === selectedId) ?? spssGuides[0];

  const handleCopySyntax = () => {
    navigator.clipboard.writeText(currentGuide.syntaxSPSS);
    setCopiedSyntax(true);
    setTimeout(() => setCopiedSyntax(false), 2000);
  };

  const handleCopyPython = () => {
    navigator.clipboard.writeText(currentGuide.pythonSnippet);
    setCopiedPython(true);
    setTimeout(() => setCopiedPython(false), 2000);
  };

  return (
    <section className="spss-guides-root" id="guides">
      <div className="advanced-heading">
        <div>
          <p className="section-index">02.2 — ПРАКТИЧЕСКИЕ ГАЙДЫ SPSS И JAMOVI</p>
          <h2>
            ОТ МЕНЮ ПРОГРАММЫ<br />
            <span>ДО ВЫВОДА В ДИПЛОМ</span>
          </h2>
        </div>
        <p>
          Пошаговые маршруты со всеми флажками, интерактивная анатомия таблиц вывода, готовый синтаксис
          и разбор типичных ошибок студентов на защите.
        </p>
      </div>

      {/* Category filters */}
      <div className="method-filter" role="group" aria-label="Фильтр руководств SPSS">
        {[
          ["all", "Все гайды (7)"],
          ["assumptions", "Нормальность"],
          ["means", "Сравнение средних"],
          ["nonparametric", "Непараметрика"],
          ["anova", "ANOVA"],
          ["relations", "Корреляции и регрессия"],
          ["multivariate", "Факторный анализ"],
          ["psychometrics", "Надёжность тестов"],
        ].map(([val, label]) => (
          <button
            key={val}
            type="button"
            className={activeCategory === val ? "active" : ""}
            onClick={() => setActiveCategory(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Guide Workbench */}
      <div className="method-library spss-guide-workbench">
        {/* Left Side: Method List */}
        <div className="method-list">
          {filteredGuides.map((guide) => (
            <button
              key={guide.id}
              type="button"
              className={selectedId === guide.id ? "selected" : ""}
              onClick={() => setSelectedId(guide.id)}
            >
              <span>{guide.short}</span>
              <strong>{guide.title}</strong>
              <i>→</i>
            </button>
          ))}
        </div>

        {/* Right Side: Detailed Guide Content */}
        <article className="method-detail spss-detail-pane">
          <div className="method-detail-head">
            <span>{currentGuide.short}</span>
            <div>
              <small>{currentGuide.categoryLabel}</small>
              <h3>{currentGuide.title}</h3>
            </div>
          </div>

          <p className="method-use">{currentGuide.purpose}</p>

          {/* Psychology Context Alert */}
          <div className="guide-alert-box">
            <span>🧠 ПСИХОЛОГИЧЕСКИЙ КОНТЕКСТ:</span>
            <p>{currentGuide.psychologyContext}</p>
          </div>

          {/* Step-by-Step SPSS Menu Path */}
          <div className="guide-section-block">
            <h4 className="guide-subhead">ПОШАГОВЫЙ МАРШРУТ В МЕНЮ SPSS:</h4>
            <div className="spss-menu-breadcrumbs">
              {currentGuide.menuPathSPSS.map((step, idx) => (
                <span key={idx} className="menu-step">
                  <strong>{step}</strong>
                  {idx < currentGuide.menuPathSPSS.length - 1 && <i> → </i>}
                </span>
              ))}
            </div>

            <ul className="spss-options-list">
              {currentGuide.optionsSPSS.map((opt, idx) => (
                <li key={idx}>
                  <span className="step-num">{idx + 1}</span>
                  <span>{opt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Table Mockup with Interactive Tooltips */}
          <div className="guide-section-block">
            <h4 className="guide-subhead">АНАТОМИЯ ТАБЛИЦЫ ВЫВОДА SPSS: КУДА СМОТРЕТЬ</h4>
            <p className="table-note">{currentGuide.tableMockup.note}</p>

            <div className="mockup-table-scroll">
              <table className="spss-output-mockup">
                <thead>
                  <tr>
                    {currentGuide.tableMockup.headers.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentGuide.tableMockup.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.cells.map((cell, cIdx) => {
                        const isHighlighted = row.highlightIndex === cIdx;
                        return (
                          <td
                            key={cIdx}
                            className={isHighlighted ? "highlighted-spss-cell" : ""}
                            title={isHighlighted ? row.highlightTooltip : undefined}
                          >
                            <span>{cell}</span>
                            {isHighlighted && (
                              <span className="cell-hint-badge">
                                👈 {row.highlightTooltip}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Code Tabs: Syntax, Jamovi, Python */}
          <div className="guide-section-block">
            <div className="code-header-row">
              <h4 className="guide-subhead">СИНТАКСИС SPSS ДЛЯ ВСТАВКИ:</h4>
              <button type="button" className="copy-code-btn" onClick={handleCopySyntax}>
                {copiedSyntax ? "Синтаксис скопирован ✓" : "Копировать синтаксис SPSS"}
              </button>
            </div>
            <pre className="spss-syntax-code">
              <code>{currentGuide.syntaxSPSS}</code>
            </pre>

            <div className="alt-software-row">
              <div className="alt-box jamovi-box">
                <span>МАРШРУТ В JAMOVI:</span>
                <p>{currentGuide.menuPathJamovi}</p>
              </div>
              <div className="alt-box python-box">
                <div className="py-head">
                  <span>КОД НА PYTHON:</span>
                  <button type="button" className="mini-copy-btn" onClick={handleCopyPython}>
                    {copiedPython ? "Скопировано ✓" : "Копировать"}
                  </button>
                </div>
                <code>{currentGuide.pythonSnippet}</code>
              </div>
            </div>
          </div>

          {/* APA 7 Report Template */}
          <div className="guide-section-block">
            <h4 className="guide-subhead">КАК ОПИСАТЬ РЕЗУЛЬТАТ В ДИПЛОМЕ ИЛИ ВАК-СТАТЬЕ (APA 7):</h4>
            <div className="apa-quote-box">
              <p>«{currentGuide.apaReportExample}»</p>
            </div>
          </div>

          {/* Student Pitfalls */}
          <div className="guide-section-block pitfalls-block">
            <h4 className="guide-subhead">⚠️ ТОП-3 ОШИБКИ СТУДЕНТОВ НА ЗАЩИТЕ:</h4>
            <ul className="pitfalls-list">
              {currentGuide.studentMistakes.map((mistake, idx) => (
                <li key={idx}>
                  <strong>Ошибка {idx + 1}:</strong> {mistake}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
