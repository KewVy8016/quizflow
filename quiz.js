let quizData = [];
let currentQuestion = 0;
let answers = {};
let quizTopic = '';
let quizFile = '';
const storage = window.QuizFlowStorage;

// Shuffle answers (ตัวเลือกคำตอบ)
let shuffleEnabled = false;
let shuffledQuizData = [];
let answerMappings = {}; // Maps shuffled index to original index for each question

// Shuffle questions (ลำดับข้อสอบ)
let shuffleQuestionsEnabled = false;
let shuffledQuestionOrder = []; // Array of original indices in shuffled order

// Get quiz topic from URL
function getQuizFileFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('topic');
}

// Initialize quiz
async function initQuiz() {
    console.log('Initializing quiz with file:', quizFile);
    // Use the filename as a readable title; storage uses the full file path.
    quizTopic = storage.topic(quizFile);
    document.getElementById('quiz-title').textContent = quizTopic;
    document.title = `${quizTopic} — QuizFlow`;
    document.getElementById('quiz-context').textContent = quizFile.split(/[\\/]/).slice(0, -1).join(' / ') || 'ทั่วไป';
    
    try {
        const filePath = `json/${quizFile}`;
        console.log('Fetching quiz from:', filePath);
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        quizData = await response.json();
        if (!Array.isArray(quizData) || !quizData.length || quizData.some(q => !Array.isArray(q.answers) || !q.answers.length)) {
            throw new Error('รูปแบบคำถามไม่ถูกต้อง');
        }
        console.log('Quiz data loaded successfully, questions:', quizData.length);
        
        // Load saved state and shuffle preference
        loadState();
        
        // Create shuffled quiz if shuffle is enabled
        if (shuffleEnabled) {
            createShuffledQuiz();
        }
        
        // Render first question
        ['shuffle-btn', 'shuffle-questions-btn', 'reset-btn'].forEach(id => document.getElementById(id).disabled = false);
        saveState();
        if (Object.keys(answers).length === quizData.length) showResult();
        else renderQuestion();
    } catch (error) {
        console.error('Error loading quiz:', error);
        const container = document.getElementById('quiz-container');
        container.replaceChildren();
        const message = document.createElement('p');
        message.className = 'loading';
        message.textContent = 'โหลดแบบฝึกหัดไม่สำเร็จ กรุณากลับไปเลือกชุดอื่น หรือลองโหลดหน้าใหม่';
        container.appendChild(message);
        document.getElementById('progress-text').textContent = 'ยังไม่ได้เริ่ม';
    }
}

function loadState() {
    const savedState = storage.read(quizFile);
    
    if (savedState) {
        const state = savedState;
        currentQuestion = Number.isInteger(state.currentQuestion) ? Math.max(0, Math.min(state.currentQuestion, quizData.length)) : 0;
        answers = Object.fromEntries(Object.entries(state.answers || {}).filter(([index, value]) => quizData[index]?.answers[value] && Number.isInteger(value)));
        shuffledQuestionOrder = Array.isArray(state.questionOrder) ? state.questionOrder : [];
        if (currentQuestion === quizData.length && Object.keys(answers).length < quizData.length) {
            currentQuestion = 0;
        }
    }
    
    // Load shuffle answers preference
    shuffleEnabled = storage.read(quizFile, 'shuffle') === true;
    updateShuffleButton();

    // Load shuffle questions preference
    shuffleQuestionsEnabled = storage.read(quizFile, 'shuffle_questions') === true;
    if (shuffleQuestionsEnabled) {
        const validOrder = shuffledQuestionOrder.length === quizData.length && new Set(shuffledQuestionOrder).size === quizData.length && shuffledQuestionOrder.every(i => Number.isInteger(i) && i >= 0 && i < quizData.length);
        if (!validOrder) createShuffledQuestionOrder();
    }
    updateShuffleQuestionsButton();
}

function saveState() {
    const state = {
        currentQuestion,
        answers,
        totalQuestions: quizData.length,
        questionOrder: shuffledQuestionOrder,
        updatedAt: Date.now()
    };
    storage.write(quizFile, state);
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    storage.write(quizFile, shuffleEnabled, 'shuffle');
    updateShuffleButton();
    
    // Re-shuffle if enabling
    if (shuffleEnabled) {
        createShuffledQuiz();
    }
    renderQuestion();
}

function createShuffledQuiz() {
    // Create a deep copy of quiz data with shuffled answers
    shuffledQuizData = quizData.map((question, qIndex) => {
        // Shuffle the answers and create a mapping
        const mapping = shuffleArray(question.answers.map((_, index) => index));
        const shuffledAnswers = mapping.map(index => question.answers[index]);
        
        // Create mapping from shuffled index to original index
        answerMappings[qIndex] = mapping;
        
        return {
            ...question,
            answers: shuffledAnswers
        };
    });
}

function updateShuffleButton() {
    const btn = document.getElementById('shuffle-btn');
    if (btn) {
        btn.classList.toggle('active', shuffleEnabled);
        btn.setAttribute('aria-pressed', String(shuffleEnabled));
        btn.innerHTML = `สลับตัวเลือกคำตอบ <span>${shuffleEnabled ? 'เปิด' : 'ปิด'}</span>`;
    }
}

// ---- Question Order Shuffle ----

function toggleShuffleQuestions() {
    shuffleQuestionsEnabled = !shuffleQuestionsEnabled;
    storage.write(quizFile, shuffleQuestionsEnabled, 'shuffle_questions');
    updateShuffleQuestionsButton();
    
    if (shuffleQuestionsEnabled) {
        createShuffledQuestionOrder();
    } else {
        shuffledQuestionOrder = [];
    }
    // Reset to first question when toggling
    currentQuestion = 0;
    saveState();
    renderQuestion();
}

function createShuffledQuestionOrder() {
    // Create an array [0, 1, 2, ..., n-1] then shuffle it
    shuffledQuestionOrder = quizData.map((_, i) => i);
    for (let i = shuffledQuestionOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledQuestionOrder[i], shuffledQuestionOrder[j]] = 
            [shuffledQuestionOrder[j], shuffledQuestionOrder[i]];
    }
}

function updateShuffleQuestionsButton() {
    const btn = document.getElementById('shuffle-questions-btn');
    if (btn) {
        btn.classList.toggle('active', shuffleQuestionsEnabled);
        btn.setAttribute('aria-pressed', String(shuffleQuestionsEnabled));
        btn.innerHTML = `สลับลำดับคำถาม <span>${shuffleQuestionsEnabled ? 'เปิด' : 'ปิด'}</span>`;
    }
}

function renderQuestion() {
    if (currentQuestion >= quizData.length) {
        showResult();
        return;
    }
    
    // Resolve the "real" original index based on question order shuffle
    const originalQIndex = shuffleQuestionsEnabled
        ? shuffledQuestionOrder[currentQuestion]
        : currentQuestion;
    
    // Use shuffled answer data if enabled, otherwise use original
    const displayData = shuffleEnabled ? shuffledQuizData : quizData;
    const question = displayData[originalQIndex];
    const hasAnswered = answers.hasOwnProperty(originalQIndex);
    
    const container = document.getElementById('quiz-container');
    container.classList.remove('hidden');
    document.getElementById('result-container').classList.add('hidden');
    container.innerHTML = `
        <div class="question-number">คำถามที่ ${currentQuestion + 1} / ${quizData.length}</div>
        <h2 class="question-text" tabindex="-1" id="question-title"></h2>
        <div class="answers" id="answers-container"></div>
        ${hasAnswered ? `
            <div class="explanation">
                <div class="explanation-title">เรียนรู้จากคำตอบ</div>
                <div class="explanation-text" id="explanation-text"></div>
            </div>
        ` : ''}
        <div class="quiz-actions">
            ${currentQuestion > 0 ? '<button id="prev-btn" class="btn-secondary">← ก่อนหน้า</button>' : ''}
            ${hasAnswered ? `<button id="next-btn" class="btn-primary">${currentQuestion === quizData.length - 1 ? 'ดูผลคะแนน →' : 'ข้อถัดไป →'}</button>` : '<span class="quiz-hint">เลือกคำตอบเพื่อดูคำอธิบาย</span>'}
        </div>
    `;
    document.getElementById('question-title').textContent = question.text;
    if (hasAnswered) document.getElementById('explanation-text').textContent = question.info || 'ไม่มีคำอธิบาย';
    
    renderAnswers(question, hasAnswered, originalQIndex);
    updateProgress();
    
    // Event listeners
    if (document.getElementById('prev-btn')) {
        document.getElementById('prev-btn').addEventListener('click', prevQuestion);
    }
    if (document.getElementById('next-btn')) {
        document.getElementById('next-btn').addEventListener('click', nextQuestion);
    }
}

function renderAnswers(question, hasAnswered, originalQIndex) {
    const answersContainer = document.getElementById('answers-container');
    
    question.answers.forEach((answer, displayIndex) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        const letter = document.createElement('span');
        letter.className = 'answer-letter';
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = String.fromCharCode(65 + displayIndex);
        const text = document.createElement('span');
        text.textContent = answer.text;
        btn.append(letter, text);
        btn.disabled = hasAnswered;
        
        // Get the original answer index if answer-shuffle is enabled
        const originalAnsIndex = shuffleEnabled ? answerMappings[originalQIndex][displayIndex] : displayIndex;
        
        if (hasAnswered) {
            if (answer.correct) {
                btn.classList.add('correct');
            } else if (answers[originalQIndex] === originalAnsIndex) {
                btn.classList.add('incorrect');
            }
            if (answer.correct || answers[originalQIndex] === originalAnsIndex) {
                const verdict = document.createElement('span');
                verdict.className = 'answer-verdict';
                verdict.textContent = answer.correct ? (answers[originalQIndex] === originalAnsIndex ? '✓ คุณตอบถูก' : '✓ คำตอบที่ถูกต้อง') : '✕ คำตอบของคุณ';
                text.appendChild(verdict);
            }
        } else if (answers[originalQIndex] === originalAnsIndex) {
            btn.classList.add('selected');
        }
        
        btn.addEventListener('click', () => selectAnswer(originalQIndex, originalAnsIndex));
        answersContainer.appendChild(btn);
    });
}

function selectAnswer(originalQIndex, answerIndex) {
    answers[originalQIndex] = answerIndex;
    saveState();
    renderQuestion();
    document.getElementById('next-btn')?.focus({ preventScroll: true });
}

function nextQuestion() {
    currentQuestion++;
    saveState();
    renderQuestion();
    document.getElementById('question-title')?.focus({ preventScroll: true });
}

function prevQuestion() {
    currentQuestion--;
    saveState();
    renderQuestion();
    document.getElementById('question-title')?.focus({ preventScroll: true });
}

function updateProgress() {
    const answered = Object.keys(answers).length;
    const progress = (answered / quizData.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.querySelector('.progress-bar').setAttribute('aria-valuenow', String(Math.round(progress)));
    document.getElementById('progress-text').textContent = `ตอบแล้ว ${answered} จาก ${quizData.length} ข้อ`;
}

function showResult() {
    updateProgress();
    document.getElementById('quiz-container').classList.add('hidden');
    const resultContainer = document.getElementById('result-container');
    resultContainer.classList.remove('hidden');
    
    let correctCount = 0;
    // Always score against original quizData indices stored in answers
    quizData.forEach((question, index) => {
        const userAnswer = answers[index];
        if (userAnswer !== undefined && question.answers[userAnswer]?.correct) {
            correctCount++;
        }
    });
    
    const percentage = Math.round((correctCount / quizData.length) * 100);
    
    document.getElementById('score-display').innerHTML = `
        <div class="score-percentage">${percentage}%</div>
        <div class="score-detail">${correctCount} / ${quizData.length} ข้อถูกต้อง</div>
    `;
    document.getElementById('result-title').focus({ preventScroll: true });
}

// Event listeners
document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('ต้องการรีเซ็ตความก้าวหน้าและเริ่มใหม่?')) {
        storage.reset(quizFile);
        currentQuestion = 0;
        answers = {};
        document.getElementById('quiz-settings').open = false;
        saveState();
        renderQuestion();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Get quiz file from URL
    quizFile = getQuizFileFromURL();
    
    console.log('URL parameters:', window.location.search);
    console.log('quizFile value:', quizFile);
    
    if (!quizFile) {
        console.error('No quiz file specified in URL, redirecting to index');
        window.location.href = 'index.html';
        return;
    }
    
    if (document.getElementById('shuffle-questions-btn')) {
        document.getElementById('shuffle-questions-btn').addEventListener('click', toggleShuffleQuestions);
    }
    
    if (document.getElementById('shuffle-btn')) {
        document.getElementById('shuffle-btn').addEventListener('click', toggleShuffle);
    }
    
    if (document.getElementById('retry-btn')) {
        document.getElementById('retry-btn').addEventListener('click', () => {
            storage.reset(quizFile);
            window.location.reload();
        });
    }
    
    if (document.getElementById('home-btn')) {
        document.getElementById('home-btn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    initQuiz();
});

// Close settings with Escape or a click outside the disclosure.
document.addEventListener('click', event => {
    const settings = document.getElementById('quiz-settings');
    if (!settings.contains(event.target)) settings.open = false;
});
document.addEventListener('keydown', event => {
    const settings = document.getElementById('quiz-settings');
    if (event.key === 'Escape' && settings.open) {
        settings.open = false;
        settings.querySelector('summary').focus();
    }
});
