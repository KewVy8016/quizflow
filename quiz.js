let quizData = [];
let currentQuestion = 0;
let answers = {};
let quizTopic = '';
let quizFile = '';

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
    // ใช้แค่ชื่อไฟล์ (ไม่รวม subfolder path) เพื่อให้ stateKey สม่ำเสมอ
    const fileName = quizFile.split('/').pop().split('\\').pop();
    quizTopic = fileName.replace('.json', '').replace(/_/g, ' ');
    document.getElementById('quiz-title').textContent = quizTopic;
    
    try {
        const filePath = `json/${quizFile}`;
        console.log('Fetching quiz from:', filePath);
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        quizData = await response.json();
        console.log('Quiz data loaded successfully, questions:', quizData.length);
        
        // Load saved state and shuffle preference
        loadState();
        
        // Create shuffled quiz if shuffle is enabled
        if (shuffleEnabled) {
            createShuffledQuiz();
        }
        
        // Render first question
        renderQuestion();
    } catch (error) {
        console.error('Error loading quiz:', error);
        document.getElementById('quiz-container').innerHTML = 
            `<div class="loading">
                <p>ไม่สามารถโหลดข้อสอบได้</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    ไฟล์: ${quizFile}<br>
                    ข้อผิดพลาด: ${error.message}
                </p>
            </div>`;
    }
}

function loadState() {
    const stateKey = `quiz_state_${quizTopic}`;
    const savedState = localStorage.getItem(stateKey);
    
    if (savedState) {
        const state = JSON.parse(savedState);
        currentQuestion = state.currentQuestion || 0;
        answers = state.answers || {};
    }
    
    // Load shuffle answers preference
    const shuffleKey = `quiz_shuffle_${quizTopic}`;
    const savedShuffle = localStorage.getItem(shuffleKey);
    shuffleEnabled = savedShuffle === 'true';
    updateShuffleButton();

    // Load shuffle questions preference
    const shuffleQKey = `quiz_shuffle_questions_${quizTopic}`;
    const savedShuffleQ = localStorage.getItem(shuffleQKey);
    shuffleQuestionsEnabled = savedShuffleQ === 'true';
    if (shuffleQuestionsEnabled) {
        createShuffledQuestionOrder();
    }
    updateShuffleQuestionsButton();
}

function saveState() {
    const stateKey = `quiz_state_${quizTopic}`;
    const state = {
        currentQuestion,
        answers
    };
    localStorage.setItem(stateKey, JSON.stringify(state));
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
    const shuffleKey = `quiz_shuffle_${quizTopic}`;
    localStorage.setItem(shuffleKey, shuffleEnabled);
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
        const shuffledAnswers = shuffleArray(question.answers);
        
        // Create mapping from shuffled index to original index
        const mapping = [];
        shuffledAnswers.forEach(shuffledAnswer => {
            const originalIndex = question.answers.findIndex(
                a => a.text === shuffledAnswer.text && a.correct === shuffledAnswer.correct
            );
            mapping.push(originalIndex);
        });
        
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
        if (shuffleEnabled) {
            btn.classList.add('active');
            btn.innerHTML = '🔀 <span class="btn-label">สลับตัวเลือก ✓</span>';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '🔀 <span class="btn-label">สลับตัวเลือก</span>';
        }
    }
}

// ---- Question Order Shuffle ----

function toggleShuffleQuestions() {
    shuffleQuestionsEnabled = !shuffleQuestionsEnabled;
    const shuffleQKey = `quiz_shuffle_questions_${quizTopic}`;
    localStorage.setItem(shuffleQKey, shuffleQuestionsEnabled);
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
        if (shuffleQuestionsEnabled) {
            btn.classList.add('active');
            btn.innerHTML = '📋 <span class="btn-label">สลับข้อสอบ ✓</span>';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '📋 <span class="btn-label">สลับข้อสอบ</span>';
        }
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
    container.innerHTML = `
        <div class="question-number">คำถามที่ ${currentQuestion + 1} / ${quizData.length}</div>
        <div class="question-text">${question.text}</div>
        <div class="answers" id="answers-container"></div>
        ${hasAnswered ? `
            <div class="explanation">
                <div class="explanation-title">💡 คำอธิบาย</div>
                <div class="explanation-text">${question.info || 'ไม่มีคำอธิบาย'}</div>
            </div>
        ` : ''}
        <div class="quiz-actions">
            ${currentQuestion > 0 ? '<button id="prev-btn" class="btn-secondary">← ก่อนหน้า</button>' : ''}
            ${hasAnswered ? '<button id="next-btn" class="btn-primary">ถัดไป →</button>' : ''}
        </div>
    `;
    
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
        btn.textContent = answer.text;
        btn.disabled = hasAnswered;
        
        // Get the original answer index if answer-shuffle is enabled
        const originalAnsIndex = shuffleEnabled ? answerMappings[originalQIndex][displayIndex] : displayIndex;
        
        if (hasAnswered) {
            if (answer.correct) {
                btn.classList.add('correct');
            } else if (answers[originalQIndex] === originalAnsIndex) {
                btn.classList.add('incorrect');
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
}

function nextQuestion() {
    currentQuestion++;
    saveState();
    renderQuestion();
}

function prevQuestion() {
    currentQuestion--;
    saveState();
    renderQuestion();
}

function updateProgress() {
    const progress = ((currentQuestion + 1) / quizData.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
}

function showResult() {
    document.getElementById('quiz-container').classList.add('hidden');
    const resultContainer = document.getElementById('result-container');
    resultContainer.classList.remove('hidden');
    
    let correctCount = 0;
    // Always score against original quizData indices stored in answers
    quizData.forEach((question, index) => {
        const userAnswer = answers[index];
        if (userAnswer !== undefined && question.answers[userAnswer].correct) {
            correctCount++;
        }
    });
    
    const percentage = Math.round((correctCount / quizData.length) * 100);
    
    document.getElementById('score-display').innerHTML = `
        <div style="font-size: 3em; color: #667eea; font-weight: 700;">${percentage}%</div>
        <div class="score-detail">${correctCount} / ${quizData.length} ข้อถูกต้อง</div>
    `;
}

// Event listeners
document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('ต้องการรีเซ็ตความก้าวหน้าและเริ่มใหม่?')) {
        const stateKey = `quiz_state_${quizTopic}`;
        localStorage.removeItem(stateKey);
        currentQuestion = 0;
        answers = {};
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
            const stateKey = `quiz_state_${quizTopic}`;
            localStorage.removeItem(stateKey);
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
