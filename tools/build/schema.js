function validateSubjectData(subjKey, data) {
  const errors = [];

  if (!data.name) errors.push('Missing "name".');
  if (!Array.isArray(data.cards)) errors.push('Missing or invalid "cards" array.');
  if (!Array.isArray(data.quizzes)) errors.push('Missing or invalid "quizzes" array.');
  if (!Array.isArray(data.chapters)) errors.push('Missing or invalid "chapters" array.');

  if (errors.length > 0) {
    throw new Error(`Subject schema validation failed for "${subjKey}":\n- ${errors.join('\n- ')}`);
  }

  // Check unique IDs
  const cardIds = new Set();
  data.cards.forEach((card, idx) => {
    if (!card.id || !card.term || !card.definition) {
      errors.push(`Card at index ${idx} is missing id, term, or definition.`);
    }
    if (cardIds.has(card.id)) {
      errors.push(`Duplicate card ID: ${card.id}`);
    }
    cardIds.add(card.id);
  });

  const quizIds = new Set();
  data.quizzes.forEach((quiz, idx) => {
    if (!quiz.id || !quiz.question || !quiz.answer) {
      errors.push(`Quiz at index ${idx} is missing id, question, or answer.`);
    }
    if (quizIds.has(quiz.id)) {
      errors.push(`Duplicate quiz ID: ${quiz.id}`);
    }
    quizIds.add(quiz.id);
  });

  if (errors.length > 0) {
    throw new Error(`Subject data integrity validation failed for "${subjKey}":\n- ${errors.join('\n- ')}`);
  }
}

function validateExamData(examKey, data) {
  const errors = [];

  if (!data.id) errors.push('Missing "id".');
  if (!data.title) errors.push('Missing "title".');
  if (!Array.isArray(data.questions)) errors.push('Missing or invalid "questions" array.');

  if (errors.length > 0) {
    throw new Error(`Exam schema validation failed for "${examKey}":\n- ${errors.join('\n- ')}`);
  }

  const qIds = new Set();
  data.questions.forEach((q, idx) => {
    if (!q.id || typeof q.num !== 'number' || !q.question || q.answer === undefined) {
      errors.push(`Question at index ${idx} is missing id, num, question, or answer.`);
    }
    if (qIds.has(q.id)) {
      errors.push(`Duplicate question ID: ${q.id}`);
    }
    qIds.add(q.id);
  });

  if (errors.length > 0) {
    throw new Error(`Exam data integrity validation failed for "${examKey}":\n- ${errors.join('\n- ')}`);
  }
}

function validateIngredientsData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Ingredients data must be an array.');
  }

  const errors = [];
  const names = new Set();

  data.forEach((ing, idx) => {
    if (!ing.name || !ing.type) {
      errors.push(`Ingredient at index ${idx} is missing name or type.`);
    }
    if (names.has(ing.name)) {
      // Duplicates are resolved in the parser (restricted/banned overrides approved), 
      // but if there are still duplicate entries in the array, report it.
      errors.push(`Duplicate ingredient name: ${ing.name}`);
    }
    names.add(ing.name);
  });

  if (errors.length > 0) {
    throw new Error(`Ingredients data validation failed:\n- ${errors.join('\n- ')}`);
  }
}

module.exports = {
  validateSubjectData,
  validateExamData,
  validateIngredientsData
};
