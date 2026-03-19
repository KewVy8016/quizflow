// Auto-discover quiz files by trying to load them
async function discoverQuizFiles() {
    // Try to load quiz-list.json first (if exists from build)
    try {
        const response = await fetch('quiz-list.json');
        if (response.ok) {
            const quizList = await response.json();
            console.log('Loaded from quiz-list.json:', quizList);
            return quizList;
        }
    } catch (error) {
        console.log('quiz-list.json not found, using auto-discovery');
    }
    
    // Fallback: Auto-discover by trying common file patterns
    const potentialFiles = [];
    const jsonDir = 'json/';
    
    // Try to fetch index of json directory (works on some servers)
    try {
        const response = await fetch(jsonDir);
        const text = await response.text();
        
        // Parse HTML directory listing (if available)
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.endsWith('.json')) {
                potentialFiles.push(href);
            }
        });
        
        if (potentialFiles.length > 0) {
            console.log('Auto-discovered files:', potentialFiles);
            return potentialFiles;
        }
    } catch (error) {
        console.log('Directory listing not available');
    }
    
    // Last resort: Try to load known files
    const knownFiles = [
        'Main Memory Management_ OS Concepts.json',
        'Threads and Concurrency in Operating Systems.json',
        'memory-management.json',
        'cpu-scheduling.json',
        'networking.json'
    ];
    
    const existingFiles = [];
    for (const file of knownFiles) {
        try {
            const response = await fetch(`${jsonDir}${file}`, { method: 'HEAD' });
            if (response.ok) {
                existingFiles.push(file);
            }
        } catch (error) {
            // File doesn't exist, skip
        }
    }
    
    console.log('Found files:', existingFiles);
    return existingFiles;
}

// แปลงโครงสร้าง quiz-list ให้เป็นรูปแบบที่มี subject เสมอ
// รองรับทั้งรูปแบบเก่า (array ของ string) และรูปแบบใหม่ (array ของ { subject, files })
function normalizeQuizList(quizList) {
    if (!Array.isArray(quizList) || quizList.length === 0) {
        return [];
    }

    const first = quizList[0];

    // รูปแบบใหม่: [{ subject: 'OS', files: ['Operating System/xxx.json'] }, ...]
    if (typeof first === 'object' && first !== null && 'subject' in first && Array.isArray(first.files)) {
        return quizList;
    }

    // รูปแบบเดิม: ['Main Memory.json', 'Threads.json', ...]
    if (typeof first === 'string') {
        return [{
            subject: 'ทั่วไป',
            files: quizList
        }];
    }

    return [];
}

// Load and display quiz library
async function loadQuizLibrary() {
    const libraryContainer = document.getElementById('quiz-library');
    
    try {
        const rawQuizList = await discoverQuizFiles();
        const categories = normalizeQuizList(rawQuizList);
        
        libraryContainer.innerHTML = '';
        
        if (!categories || categories.length === 0) {
            libraryContainer.innerHTML = `
                <div class="loading">
                    <p>❌ ไม่พบไฟล์ quiz</p>
                    <p style="font-size: 0.9em; color: #eee; margin-top: 10px;">
                        กรุณาเพิ่มไฟล์ในโฟลเดอร์ <code>json/</code> หรือรัน:<br>
                        <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 5px; color: #333;">
                            npm run setup
                        </code>
                    </p>
                </div>
            `;
            return;
        }
        
        // แสดงแบบแบ่งตามรายวิชา (subject)
        for (const category of categories) {
            const section = document.createElement('section');
            section.className = 'subject-section';

            const title = document.createElement('h2');
            title.className = 'subject-title';
            title.textContent = category.subject;
            section.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'quiz-library';

            for (const quizFile of category.files) {
                const card = await createQuizCard(quizFile, category.subject);
                grid.appendChild(card);
            }

            section.appendChild(grid);
            libraryContainer.appendChild(section);
        }
    } catch (error) {
        console.error('Error loading quiz library:', error);
        libraryContainer.innerHTML = `
            <div class="loading">
                <p>❌ ไม่สามารถโหลดรายการ quiz ได้</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    กรุณารัน web server เพื่อใช้งาน:<br>
                    <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 5px;">
                        serve . -p 3000
                    </code>
                </p>
            </div>
        `;
    }
}

async function createQuizCard(quizFile, subject) {
    console.log('Creating card for quiz file:', quizFile);
    // รองรับ path ที่มี subfolder เช่น "Ebusiness/EB04.json"
    const fileName = quizFile.split('/').pop().split('\\').pop();
    const topicName = fileName.replace('.json', '').replace(/_/g, ' ');
    
    // Load quiz to get question count
    let questionCount = 0;
    try {
        const filePath = `json/${quizFile}`;
        console.log('Fetching quiz info from:', filePath);
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const quizData = await response.json();
        questionCount = quizData.length;
        console.log(`Quiz "${quizFile}" has ${questionCount} questions`);
    } catch (error) {
        console.error(`Error loading ${quizFile}:`, error);
    }
    
    // Get progress from localStorage
    const stateKey = `quiz_state_${topicName}`;
    const savedState = localStorage.getItem(stateKey);
    let progress = 0;
    
    if (savedState) {
        const state = JSON.parse(savedState);
        progress = Object.keys(state.answers || {}).length;
    }
    
    // Create card element
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.innerHTML = `
        <h3>${topicName}</h3>
        ${subject ? `<div class="quiz-subject-tag">${subject}</div>` : ''}
        <div class="quiz-info">${questionCount} คำถาม</div>
        <div class="quiz-progress">Progress: ${progress} / ${questionCount}</div>
    `;
    
    card.addEventListener('click', () => {
        const url = `quiz.html?topic=${encodeURIComponent(quizFile)}`;
        console.log('Navigating to quiz:', url);
        window.location.href = url;
    });
    
    return card;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadQuizLibrary);
