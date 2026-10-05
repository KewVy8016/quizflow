const libraryState = { entries: [], semester: '', course: '', assessment: '', view: 'all' };
const storage = window.QuizFlowStorage;
const byId = id => document.getElementById(id);
const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });

function normalizeQuizList(list) {
    if (!Array.isArray(list)) return [];
    if (list[0]?.subjects) return list;
    if (list[0]?.files) return [{ semester: 'ทุกภาคเรียน', subjects: list }];
    return [{ semester: 'ทุกภาคเรียน', subjects: [{ subject: 'ทั่วไป', files: list }] }];
}
function getProgress(file) {
    const state = storage.read(file);
    const answered = Object.keys(state?.answers || {}).length;
    const completed = answered > 0 && state?.totalQuestions > 0 && answered >= state.totalQuestions;
    return { answered, completed, updatedAt: state?.updatedAt || 0 };
}
function scopedEntries() {
    return libraryState.entries.filter(entry => !libraryState.semester || entry.semester === libraryState.semester);
}
function makeFilterButton(label, count, active, onClick, className = 'subject-item') {
    const button = document.createElement('button');
    button.className = `${className}${active ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(active));
    const text = document.createElement('span');
    text.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'nav-count';
    badge.textContent = count;
    button.append(text, badge);
    button.addEventListener('click', onClick);
    return button;
}
function renderNavigation() {
    const menuHadFocus = byId('subject-menu').contains(document.activeElement);
    const entries = scopedEntries();
    const courses = [...new Set(entries.map(entry => entry.course))].sort(collator.compare);
    if (!courses.includes(libraryState.course)) libraryState.course = '';
    byId('subject-count').textContent = courses.length;
    const courseSelect = byId('course-select');
    courseSelect.replaceChildren(new Option('ทุกวิชา', ''), ...courses.map(course => new Option(course, course)));
    courseSelect.value = libraryState.course;
    courseSelect.disabled = false;
    const menu = byId('subject-menu');
    menu.replaceChildren(makeFilterButton('ทุกวิชา', entries.length, !libraryState.course, () => selectCourse('')));
    courses.forEach(course => menu.appendChild(makeFilterButton(course, entries.filter(entry => entry.course === course).length, libraryState.course === course, () => selectCourse(course))));
    if (menuHadFocus) menu.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    ['all', 'continue'].forEach(view => {
        byId(`view-${view}`).classList.toggle('active', libraryState.view === view);
        byId(`view-${view}`).setAttribute('aria-pressed', String(libraryState.view === view));
    });
    byId('all-count').textContent = libraryState.entries.length;
    byId('continue-count').textContent = libraryState.entries.filter(entry => { const p = getProgress(entry.file); return p.answered && !p.completed; }).length;
}
function selectCourse(course) {
    libraryState.course = course;
    libraryState.assessment = '';
    persistSelection();
    renderNavigation();
    renderLibrary();
}
function persistSelection() {
    try {
        sessionStorage.setItem('quizflow_library', JSON.stringify({
            semester: libraryState.semester, course: libraryState.course,
            assessment: libraryState.assessment, view: libraryState.view,
            search: byId('quiz-search').value, status: byId('status-filter').value,
            sort: byId('sort-select').value
        }));
    } catch { /* Browsing remains available when storage is blocked. */ }
}
function resetFilters() {
    Object.assign(libraryState, { semester: '', course: '', assessment: '', view: 'all' });
    byId('semester-select').value = '';
    byId('quiz-search').value = '';
    byId('status-filter').value = 'all';
    persistSelection();
    refreshLibrary();
}
function createQuizCard(entry) {
    const p = getProgress(entry.file);
    const card = document.createElement('a');
    card.className = 'quiz-card';
    card.href = `quiz.html?topic=${encodeURIComponent(entry.file)}`;
    const top = document.createElement('div');
    top.className = 'card-top';
    const icon = document.createElement('span');
    icon.className = 'course-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = entry.course.slice(0, 2).toUpperCase();
    const status = document.createElement('span');
    status.className = `status-badge ${p.completed ? 'completed' : p.answered ? 'started' : ''}`;
    status.textContent = p.completed ? '✓ ทำครบแล้ว' : p.answered ? 'กำลังทำ' : 'ยังไม่ได้เริ่ม';
    top.append(icon, status);
    const metadata = document.createElement('p');
    metadata.className = 'card-metadata';
    metadata.textContent = [entry.course, entry.assessment].filter(Boolean).join(' · ');
    const title = document.createElement('h3');
    title.textContent = entry.title;
    const semester = document.createElement('p');
    semester.className = 'card-semester';
    semester.textContent = entry.semester;
    const bottom = document.createElement('div');
    bottom.className = 'card-bottom';
    const count = document.createElement('span');
    count.textContent = p.answered ? `ตอบแล้ว ${p.answered} ข้อ` : 'พร้อมเริ่มเรียนรู้';
    const action = document.createElement('span');
    action.className = 'card-action';
    action.textContent = p.completed ? 'ดูผล →' : p.answered ? 'ทำต่อ →' : 'เริ่มทำ →';
    bottom.append(count, action);
    card.append(top, metadata, title, semester, bottom);
    return card;
}
function renderLibrary() {
    const assessmentHadFocus = byId('assessment-filters').contains(document.activeElement);
    const search = byId('quiz-search').value.trim().toLocaleLowerCase('th');
    const status = byId('status-filter').value;
    const base = scopedEntries().filter(entry => !libraryState.course || entry.course === libraryState.course);
    const assessments = [...new Set(base.map(entry => entry.assessment))];
    if (!assessments.includes(libraryState.assessment)) libraryState.assessment = '';
    const groupMenu = byId('assessment-filters');
    groupMenu.replaceChildren();
    if (assessments.some(Boolean)) {
        const addGroup = (label, value, count) => groupMenu.appendChild(makeFilterButton(label, count, libraryState.assessment === value, () => { libraryState.assessment = value; renderLibrary(); }, 'filter-chip'));
        addGroup('ทุกช่วงสอบ', '', base.length);
        assessments.filter(Boolean).sort(collator.compare).forEach(group => addGroup(group, group, base.filter(entry => entry.assessment === group).length));
    }
    if (assessmentHadFocus) groupMenu.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    const entries = base.filter(entry => {
        const p = getProgress(entry.file);
        if (libraryState.view === 'continue' && (!p.answered || p.completed)) return false;
        if (libraryState.assessment && entry.assessment !== libraryState.assessment) return false;
        if (status === 'new' && p.answered) return false;
        if (status === 'started' && (!p.answered || p.completed)) return false;
        if (status === 'completed' && !p.completed) return false;
        return `${entry.title} ${entry.course} ${entry.semester} ${entry.assessment}`.toLocaleLowerCase('th').includes(search);
    });
    const sort = byId('sort-select').value;
    entries.sort((a, b) => sort === 'recent' ? getProgress(b.file).updatedAt - getProgress(a.file).updatedAt || collator.compare(a.title, b.title) : sort === 'name' ? collator.compare(a.title, b.title) : collator.compare(a.course, b.course) || collator.compare(a.title, b.title));
    byId('library-heading').textContent = libraryState.view === 'continue' ? 'กลับมาทำต่อ' : libraryState.course || 'แบบฝึกหัดทั้งหมด';
    byId('breadcrumb-current').textContent = libraryState.course || (libraryState.view === 'continue' ? 'ทำต่อ' : 'ทุกวิชา');
    byId('scope-label').textContent = libraryState.semester || 'ทุกภาคเรียน';
    byId('results-count').textContent = `พบ ${entries.length} ชุด${search ? ` สำหรับ “${byId('quiz-search').value.trim()}”` : ''} · ${libraryState.course || 'ทุกวิชา'} · ${libraryState.semester || 'ทุกภาคเรียน'}`;
    byId('clear-filters').classList.toggle('hidden', !(search || libraryState.course || libraryState.semester || libraryState.assessment || libraryState.view !== 'all' || status !== 'all'));
    const grid = byId('quiz-library');
    grid.replaceChildren(...entries.map(createQuizCard));
    grid.setAttribute('aria-busy', 'false');
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        const title = document.createElement('h3');
        title.textContent = libraryState.view === 'continue' && !search ? 'ยังไม่มีแบบฝึกหัดที่ค้างไว้' : 'ไม่พบแบบฝึกหัดในรายการที่เลือก';
        const hint = document.createElement('p');
        hint.textContent = 'ลองเลือกทุกภาคเรียน หรือค้นหาด้วยคำที่สั้นลง';
        const button = document.createElement('button');
        button.className = 'btn-primary';
        button.textContent = 'ดูแบบฝึกหัดทั้งหมด';
        button.addEventListener('click', resetFilters);
        empty.append(title, hint, button);
        grid.appendChild(empty);
    }
    persistSelection();
}
function refreshLibrary() {
    if (!libraryState.entries.length) return;
    renderNavigation();
    renderLibrary();
    byId('stat-started').textContent = libraryState.entries.filter(entry => getProgress(entry.file).answered > 0).length;
    const recent = libraryState.entries.filter(entry => { const p = getProgress(entry.file); return p.answered && !p.completed; }).sort((a, b) => getProgress(b.file).updatedAt - getProgress(a.file).updatedAt)[0];
    const resume = byId('resume-section');
    resume.classList.toggle('hidden', !recent);
    resume.replaceChildren();
    if (recent) {
        const content = document.createElement('div');
        const label = document.createElement('p');
        label.className = 'eyebrow';
        label.textContent = 'ต่อจากครั้งที่แล้ว';
        const title = document.createElement('h2');
        title.id = 'resume-title';
        title.textContent = recent.title;
        const subtitle = document.createElement('p');
        subtitle.textContent = `${recent.course} · ตอบแล้ว ${getProgress(recent.file).answered} ข้อ`;
        const link = document.createElement('a');
        link.className = 'btn-primary';
        link.href = `quiz.html?topic=${encodeURIComponent(recent.file)}`;
        link.textContent = 'ทำต่อ →';
        content.append(label, title, subtitle);
        resume.append(content, link);
    }
}
async function loadQuizLibrary() {
    try {
        const response = await fetch('quiz-list.json');
        if (!response.ok) throw new Error('Unable to load quiz list');
        const semesters = normalizeQuizList(await response.json());
        libraryState.entries = semesters.flatMap(semester => (semester.subjects || []).flatMap(subject => (subject.files || []).map(item => {
            const file = typeof item === 'string' ? item : item.file;
            if (typeof file !== 'string') return null;
            const parts = (subject.subject || 'ทั่วไป').split(/[\\/]/);
            return { file, title: storage.topic(file), semester: semester.semester, course: parts.pop(), assessment: parts.join(' › ') };
        }).filter(Boolean)));
        if (!libraryState.entries.length) throw new Error('Empty quiz list');
        try {
            const saved = JSON.parse(sessionStorage.getItem('quizflow_library') || '{}');
            libraryState.semester = semesters.some(semester => semester.semester === saved.semester) ? saved.semester : '';
            libraryState.course = saved.course || '';
            libraryState.assessment = saved.assessment || '';
            libraryState.view = saved.view === 'continue' ? 'continue' : 'all';
            byId('quiz-search').value = typeof saved.search === 'string' ? saved.search : '';
            if (['all', 'new', 'started', 'completed'].includes(saved.status)) byId('status-filter').value = saved.status;
            if (['default', 'name', 'recent'].includes(saved.sort)) byId('sort-select').value = saved.sort;
        } catch {}
        const select = byId('semester-select');
        semesters.forEach(semester => select.add(new Option(semester.semester, semester.semester)));
        select.value = libraryState.semester;
        select.disabled = false;
        byId('stat-quizzes').textContent = libraryState.entries.length;
        byId('stat-subjects').textContent = new Set(libraryState.entries.map(entry => entry.course)).size;
        refreshLibrary();
    } catch (error) {
        console.error(error);
        const grid = byId('quiz-library');
        grid.setAttribute('aria-busy', 'false');
        grid.innerHTML = '<div class="empty-state"><h3>โหลดแบบฝึกหัดไม่สำเร็จ</h3><p>ลองโหลดหน้าใหม่อีกครั้ง</p><button class="btn-primary" id="reload-library">ลองอีกครั้ง</button></div>';
        byId('reload-library').addEventListener('click', () => window.location.reload());
    }
}
byId('semester-select').addEventListener('change', event => {
    libraryState.semester = event.target.value;
    libraryState.course = '';
    libraryState.assessment = '';
    persistSelection();
    refreshLibrary();
});
byId('course-select').addEventListener('change', event => selectCourse(event.target.value));
['all', 'continue'].forEach(view => byId(`view-${view}`).addEventListener('click', () => {
    Object.assign(libraryState, { view, semester: '', course: '', assessment: '' });
    byId('semester-select').value = '';
    byId('quiz-search').value = '';
    byId('status-filter').value = 'all';
    persistSelection();
    refreshLibrary();
}));
byId('quiz-search').addEventListener('input', renderLibrary);
['status-filter', 'sort-select'].forEach(id => byId(id).addEventListener('change', renderLibrary));
byId('clear-filters').addEventListener('click', resetFilters);
document.addEventListener('DOMContentLoaded', loadQuizLibrary);
window.addEventListener('pageshow', event => { if (event.persisted) refreshLibrary(); });
window.addEventListener('focus', refreshLibrary);
window.addEventListener('storage', refreshLibrary);
