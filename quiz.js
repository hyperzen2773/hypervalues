let questionsByCategory = {};
let categoryOrder = [
  "economics", 
  "resource_management", 
  "culture", 
  "authority", 
  "nation", 
  "foreign", 
  "technology", 
  "social_control", 
  "territorial_organization"
];
let currentCategoryIndex = 0;
let currentQuestions = {};
let results = {};
let history = [];
let currentNodeId = null;

fetch('questions_tree.json')
  .then(res => res.json())
  .then(data => {
    questionsByCategory = data;
    startCategory(categoryOrder[currentCategoryIndex]);
  });

function loadCategory(category) {
  currentQuestions = {};
  if (questionsByCategory[category]) {
    questionsByCategory[category].forEach(q => currentQuestions[q.id] = q);
  }
}

function startCategory(category, targetId = null) {
  loadCategory(category);
  const firstId = targetId || questionsByCategory[category][0].id;
  renderNode(currentQuestions[firstId]);
}

function selectOption(nextId) {
  history.push({
    categoryIndex: currentCategoryIndex,
    nodeId: currentNodeId,
    results: { ...results }
  });

  const category = categoryOrder[currentCategoryIndex];
  const node = currentQuestions[nextId];

  if (!node.options) {
    results[category] = node.id;
    currentCategoryIndex++;
    if (currentCategoryIndex < categoryOrder.length) {
      startCategory(categoryOrder[currentCategoryIndex]);
    } else {
      localStorage.setItem('quizResults', JSON.stringify(results));
      window.location.href = 'results.html';
    }
  } else {
    renderNode(node);
  }
}

function renderNode(node) {
  currentNodeId = node.id;
  const questionEl = document.getElementById('question');
  const buttonsDiv = document.getElementById('buttons');
  buttonsDiv.innerHTML = '';
  questionEl.innerText = node.text || "";

  if (node.options && node.options.length > 3) {
    buttonsDiv.classList.add('multi-column');
  } else {
    buttonsDiv.classList.remove('multi-column');
  }

  node.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.innerText = opt.text;
    if (opt.color) btn.style.backgroundColor = opt.color;
    btn.onclick = () => selectOption(opt.next);
    buttonsDiv.appendChild(btn);
  });

  updateBackButton();
}

function previousQuestion() {
  if (history.length === 0) {
    window.location.href = 'Instruction.html';
    return;
  }

  const prevState = history.pop();
  currentCategoryIndex = prevState.categoryIndex;
  results = prevState.results;

  loadCategory(categoryOrder[currentCategoryIndex]);
  renderNode(currentQuestions[prevState.nodeId]);
}

function updateBackButton() {
  const backBtn = document.getElementById('back-button');
  if (!backBtn) return;

  if (history.length === 0) {
    backBtn.innerText = "Back to Instructions";
  } else {
    backBtn.innerText = "Previous Question";
    backBtn.disabled = false;
  }
}
