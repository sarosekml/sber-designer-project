import { yearInterval } from '../InputDate.const';
import { RegexpYearType } from '../InputDate.types';

const divideNumber = (number: number): [number, number] => {
  const a = Math.floor(number / 10);
  const b = number % 10;
  return [a, b];
};

const calculateSubRegexp = (year: number, yearType: RegexpYearType, isEqualFirstChar = false): string[] => {
  const stopValue = yearType === 'startYear' ? 9 : 0;
  const stepCount = year.toString().length - (isEqualFirstChar ? 2 : 1);

  let yearNumber = year;
  let step = 0;
  const regexpArray: string[] = [];
  let regexpEnd = '';

  while (step < stepCount) {
    const divNumber = divideNumber(yearNumber);
    if (step === 0) {
      const regexpPart = yearType === 'startYear' ? `${divNumber[1]}-9` : `0-${divNumber[1]}`;
      regexpArray.push(`${divNumber[0]}[${regexpPart}]`);
    } else {
      if (divNumber[1] !== stopValue) {
        const regexpPart = yearType === 'startYear' ? `${divNumber[1] + 1}-9` : `0-${divNumber[1] - 1}`;
        regexpArray.push(`${divNumber[0]}[${regexpPart}]${regexpEnd}`);
      }
    }
    regexpEnd += '[0-9]';
    yearNumber = divNumber[0];
    step++;
  }
  return regexpArray;
};

const calculateMiddleYearRegexp = (year: number, minYear: number, maxYear: number): string[] => {
  const yearFirstChar = year.toString()[0];
  const stepCount = year.toString().length - 1;
  const minYearSecondChar = Number(minYear.toString()[1]);
  const maxYearSecondChar = Number(maxYear.toString()[1]);

  let step = 0;
  const regexpArray: string[] = [];
  let regexpEnd = '';

  while (step < stepCount) {
    if (step === 0) {
      regexpArray.push(`${yearFirstChar}[${minYearSecondChar}-${maxYearSecondChar}]`);
    } else {
      regexpArray.push(`${yearFirstChar}[${minYearSecondChar + 1}-${maxYearSecondChar - 1}]${regexpEnd}`);
    }
    regexpEnd += '[0-9]';
    step++;
  }

  return regexpArray;
};

export const calculateInputRegexp = (): RegExp => {
  const d = new Date();
  const year = d.getFullYear();
  let minYear = year - yearInterval;
  let maxYear = year + yearInterval;
  const minYearRegexp: string[][] = [];
  const maxYearRegexp: string[][] = [];
  let middleYearRegexp: string[] = [];

  const minYearFirstChar = minYear.toString()[0];
  const maxYearFirstChar = maxYear.toString()[0];

  const isEqualFirstChar = minYearFirstChar === maxYearFirstChar;

  if (isEqualFirstChar) {
    middleYearRegexp = calculateMiddleYearRegexp(year, minYear, maxYear);
  }

  while (maxYear.toString().length > 1) {
    const regexpPart = calculateSubRegexp(maxYear, 'endYear', isEqualFirstChar);
    maxYearRegexp.push(regexpPart);
    maxYear = Math.floor(maxYear / 10);
  }

  while (minYear.toString().length > 1) {
    const regexpPart = calculateSubRegexp(minYear, 'startYear', isEqualFirstChar);
    minYearRegexp.push(regexpPart);
    minYear = Math.floor(minYear / 10);
  }

  const regexpYearString = [...minYearRegexp, ...maxYearRegexp, ...middleYearRegexp].flat().join('|');
  const regexpOneChar = isEqualFirstChar ? minYearFirstChar : `(${minYearFirstChar}|${maxYearFirstChar})`;
  const dayRegexp = '0[1-9]|[12][0-9]|3[01]|[0-3]{0,1}';
  const monthRegexp = '0[1-9]|1[0-2]|[0-1]{0,1}';
  const regexpString = `(${dayRegexp})(${monthRegexp})(${regexpYearString}|${regexpOneChar}{0,1})((\\d|\\w|\\D){0,1})`;

  return new RegExp(regexpString, '');
};

export const calculateYearRegexp = () => {
  const d = new Date();
  const year = d.getFullYear();
  const minYear = year - yearInterval;
  const maxYear = year + yearInterval;
  const yearRegexp: string[][] = [];

  const minYearFirstChar = minYear.toString()[0];
  const maxYearFirstChar = maxYear.toString()[0];

  const isEqualFirstChar = minYearFirstChar === maxYearFirstChar;

  if (isEqualFirstChar) {
    const yearFirstChar = year.toString()[0];
    const minYearSecondChar = Number(minYear.toString()[1]);
    const maxYearSecondChar = Number(maxYear.toString()[1]);
    yearRegexp.push([`${yearFirstChar}[${minYearSecondChar + 1}-${maxYearSecondChar - 1}][0-9][0-9]`]);
  }

  const regexpMaxPart = calculateSubRegexp(maxYear, 'endYear', isEqualFirstChar);
  yearRegexp.push(regexpMaxPart);

  const regexpMinPart = calculateSubRegexp(minYear, 'startYear', isEqualFirstChar);
  yearRegexp.push(regexpMinPart);

  return yearRegexp.flat().join('|');
};
