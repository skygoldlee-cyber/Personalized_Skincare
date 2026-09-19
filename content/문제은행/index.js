// src/data/index.js — 전체 문항 집합
import subject1 from './subject1.js';
import subject2 from './subject2.js';
import subject3 from './subject3.js';
import subject4 from './subject4.js';

export const bySubject = { 1: subject1, 2: subject2, 3: subject3, 4: subject4 };
export const allQuestions = [...subject1, ...subject2, ...subject3, ...subject4];
export default allQuestions;
