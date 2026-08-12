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

// แปลงโครงสร้าง quiz-list ให้เป็นรูปแบบมาตรฐานที่มี semester เสมอ:
//   [{ semester: 'ปี 1 เทอม 1', subjects: [{ subject, files }] }, ...]
// รองรับทั้งรูปแบบใหม่ (มี semester), รูปแบบเก่า (มี subject เดิม) และรูปแบบ string array
function normalizeQuizList(quizList) {
    if (!Array.isArray(quizList) || quizList.length === 0) {
        return [];
    }

    const first = quizList[0];

    // รูปแบบใหม่: [{ semester: 'ปี 1 เทอม 1', subjects: [{ subject, files }] }, ...]
    if (typeof first === 'object' && first !== null && 'semester' in first && Array.isArray(first.subjects)) {
        return quizList.map(sem => ({
            semester: sem.semester,
            subjects: (sem.subjects || []).map(sub => ({
                subject: sub.subject || 'ทั่วไป',
                files: Array.isArray(sub.files) ? sub.files : []
            }))
        }));
    }

    // รูปแบบเดิม: [{ subject: 'OS', files: [...] }, ...] → ครอบด้วยภาคเรียนเดียว
    if (typeof first === 'object' && first !== null && 'subject' in first && Array.isArray(first.files)) {
        return [{
            semester: 'ทุกภาคเรียน',
            subjects: quizList.map(cat => ({
                subject: cat.subject,
                files: Array.isArray(cat.files) ? cat.files.map(f => (typeof f === 'string' ? f : f.file)) : []
            }))
        }];
    }

    // รูปแบบเดิม: ['foo.json', 'bar.json', ...] → วิชา "ทั่วไป"
    if (typeof first === 'string') {
        return [{
            semester: 'ทุกภาคเรียน',
            subjects: [{ subject: 'ทั่วไป', files: quizList }]
        }];
    }

    return [];
}

// หา subject ทั้งหมดที่ซ้ำชื่อกันในภาคเรียนเดียวกัน (label path ซ้อน เช่น "Midterm/Stat")
function findSubject(semester, subjectName) {
    for (const sub of semester.subjects) {
        if (sub.subject === subjectName) return sub;
    }
    return null;
}

// Load and display quiz library
async function loadQuizLibrary() {
    const libraryContainer = document.getElementById('quiz-library');
    
    try {
        const rawQuizList = await discoverQuizFiles();
        const semesters = normalizeQuizList(rawQuizList);
        
        libraryContainer.innerHTML = '';
        
        if (!semesters || semesters.length === 0) {
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

        // wrapper สำหรับ semester selector
        const semesterWrapper = document.createElement('div');
        semesterWrapper.id = 'semester-selector-wrapper';

        // wrapper สำหรับ subject selector
        const subjectWrapper = document.createElement('div');
        subjectWrapper.id = 'subject-selector-wrapper';

        // wrapper สำหรับ quiz grid section
        const sectionWrapper = document.createElement('div');
        sectionWrapper.id = 'subject-section-wrapper';

        libraryContainer.appendChild(semesterWrapper);
        libraryContainer.appendChild(subjectWrapper);
        libraryContainer.appendChild(sectionWrapper);

        // restore semester ที่เคยเลือกไว้ (ถ้ามี)
        const savedSemester = sessionStorage.getItem('quiz_last_semester');
        let currentSemester = semesters.find(s => s.semester === savedSemester)
            ? savedSemester
            : semesters[0].semester;

        // ── แถวที่ 1: ปุ่มเลือกภาคเรียน ──
        const semesterSelector = document.createElement('div');
        semesterSelector.className = 'semester-selector';

        semesters.forEach((sem) => {
            const btn = document.createElement('button');
            btn.className = 'semester-chip';
            if (sem.semester === currentSemester) btn.classList.add('active');
            btn.textContent = sem.semester;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.semester-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentSemester = sem.semester;
                sessionStorage.setItem('quiz_last_semester', currentSemester);
                renderSubjects(subjectWrapper, sectionWrapper, semesters, currentSemester);
            });
            semesterSelector.appendChild(btn);
        });

        semesterWrapper.appendChild(semesterSelector);

        // ── แถวที่ 2 + เนื้อหาของภาคเรียนปัจจุบัน ──
        renderSubjects(subjectWrapper, sectionWrapper, semesters, currentSemester);
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

// render ปุ่มเลือกวิชาของภาคเรียน + เนื้อหาวิชาที่เลือก
function renderSubjects(subjectWrapper, sectionWrapper, semesters, semesterName) {
    const semester = semesters.find(s => s.semester === semesterName);
    subjectWrapper.innerHTML = '';

    if (!semester || semester.subjects.length === 0) {
        sectionWrapper.innerHTML = `
            <div class="loading">
                <p>ไม่มี quiz ในภาคเรียนนี้</p>
            </div>
        `;
        return;
    }

    // restore subject ที่เคยเลือกไว้ (ถ้ายังอยู่ในภาคเรียนนี้)
    const savedSubject = sessionStorage.getItem('quiz_last_subject');
    let currentSubject = findSubject(semester, savedSubject)
        ? savedSubject
        : semester.subjects[0].subject;

    const subjectSelector = document.createElement('div');
    subjectSelector.className = 'subject-selector';

    semester.subjects.forEach((sub) => {
        const btn = document.createElement('button');
        btn.className = 'subject-chip';
        if (sub.subject === currentSubject) btn.classList.add('active');
        btn.textContent = sub.subject;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.subject-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSubject = sub.subject;
            sessionStorage.setItem('quiz_last_subject', currentSubject);
            renderSubjectSection(sectionWrapper, semester, sub.subject);
        });
        subjectSelector.appendChild(btn);
    });

    subjectWrapper.appendChild(subjectSelector);
    renderSubjectSection(sectionWrapper, semester, currentSubject);
}

// render quiz เฉพาะของ subject ที่เลือก (lazy per subject)
async function renderSubjectSection(sectionWrapper, semester, subjectName) {
    sectionWrapper.innerHTML = '';

    const subject = findSubject(semester, subjectName);
    if (!subject) return;

    const title = document.createElement('h2');
    title.className = 'subject-title';
    title.textContent = `${semester.semester} › ${subject.subject}`;
    sectionWrapper.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'quiz-library';

    for (const quizFile of subject.files) {
        const card = await createQuizCard(quizFile, subject.subject);
        grid.appendChild(card);
    }

    sectionWrapper.appendChild(grid);
}

async function createQuizCard(quizFile, subject) {
    console.log('Creating card for quiz file:', quizFile);
    // รองรับ path ที่มี subfolder เช่น "ปี 1 เทอม 1/Ebusiness/EB04.json"
    const fileName = quizFile.split('/').pop().split('\\').pop();
    const topicName = fileName.replace('.json', '').replace(/_/g, ' ');
    
    // ไม่โหลดไฟล์ quiz ตอนหน้า library เพื่อความเร็ว
    // ใช้แค่ progress จาก localStorage (ถ้ามี)
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
        <div class="quiz-info">คลิกเพื่อเริ่มทำข้อสอบ</div>
        <div class="quiz-progress">${progress > 0 ? `Progress: ${progress} ข้อ` : 'ยังไม่ได้เริ่มทำ'}</div>
    `;
    
    card.addEventListener('click', () => {
        sessionStorage.setItem('quiz_last_subject', subject);
        const url = `quiz.html?topic=${encodeURIComponent(quizFile)}`;
        console.log('Navigating to quiz:', url);
        window.location.href = url;
    });
    
    return card;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadQuizLibrary);