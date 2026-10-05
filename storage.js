// Full relative paths keep identically named quizzes separate.
// Legacy name-based records remain readable for compatibility.
window.QuizFlowStorage = {
    topic(file) {
        return file.split(/[\\/]/).pop().replace(/\.json$/i, '').replace(/_/g, ' ');
    },
    key(file, kind = 'state') {
        return `quiz_${kind}_${file.replace(/\\/g, '/')}`;
    },
    read(file, kind = 'state') {
        try {
            const value = localStorage.getItem(this.key(file, kind));
            const legacy = value === null ? localStorage.getItem(`quiz_${kind}_${this.topic(file)}`) : null;
            return JSON.parse(value ?? legacy ?? 'null');
        } catch { return null; }
    },
    write(file, value, kind = 'state') {
        try { localStorage.setItem(this.key(file, kind), JSON.stringify(value)); }
        catch {
            const notice = document.getElementById('save-notice');
            if (notice) notice.textContent = 'เบราว์เซอร์นี้ไม่สามารถบันทึกความคืบหน้าได้';
        }
    },
    reset(file) {
        this.write(file, { currentQuestion: 0, answers: {}, updatedAt: Date.now() });
    }
};
