// Node.js script to generate quiz-list.json dynamically
// โครงสร้างรองรับภาคเรียน (semester) โดยใช้โฟลเดอร์ชั้นบนสุด:
//   json/
//     ปี 1 เทอม 1/
//       Operating System/
//         Main Memory.json
//       Stat/
//         Correlation Ch5.json
//     ปี 2 เทอม 1/
//       Midterm/
//         Stat/a.json          (label วิชา = "Midterm/Stat" ไม่ชนกัน)
//       Final/
//         Stat/b.json
//   (ไฟล์ที่อยู่ root json/ จะถูกจัดอยู่ในภาคเรียน "ทั่วไป")
//   ไฟล์ที่อยู่ root ของโฟลเดอร์ภาคเรียน จะถูกจัดเป็นวิชาชื่อเดียวกับโฟลเดอร์นั้น

const fs = require('fs');
const path = require('path');

const jsonDir = path.join(__dirname, 'json');
const outputFile = path.join(__dirname, 'quiz-list.json');

// เก็บผลแบบ recursive: { name, files, children }
function buildTree(dir) {
    const node = { name: path.basename(dir), files: [], children: [] };
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'th'));

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            node.children.push(buildTree(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            node.files.push(entry.name);
        }
    }
    return node;
}

// เก็บไฟล์ทั้งหมด (path เต็ม) ของ node นี้ + ลูกหลาน
function collectFiles(node, base = '') {
    const files = node.files.map(f => (base ? `${base}/${f}` : f));
    for (const child of node.children) {
        files.push(...collectFiles(child, base ? `${base}/${child.name}` : child.name));
    }
    return files;
}

// กลุ่มไฟล์ตาม "โฟลเดอร์ที่อยู่" (relative กับโฟลเดอร์ภาคเรียน)
// ตัวอย่าง: Midterm/Stat/a.json → subject "Midterm/Stat"
function groupByFolder(node, base = '') {
    const groups = [];
    const selfFiles = node.files.map(f => (base ? `${base}/${f}` : f));
    if (selfFiles.length > 0) {
        groups.push({ subject: base || node.name, files: selfFiles });
    }
    for (const child of node.children) {
        groups.push(...groupByFolder(child, base ? `${base}/${child.name}` : child.name));
    }
    return groups;
}

try {
    const root = buildTree(jsonDir);
    const semesters = [];

    for (const semesterNode of root.children) {
        const subjects = groupByFolder(semesterNode);
        if (subjects.length > 0) {
            semesters.push({ semester: semesterNode.name, subjects });
        }
    }

    // ไฟล์ที่อยู่ root json/ → ภาคเรียน "ทั่วไป"
    if (root.files.length > 0) {
        semesters.unshift({ semester: 'ทั่วไป', subjects: [{ subject: 'ทั่วไป', files: root.files }] });
    }

    fs.writeFileSync(outputFile, JSON.stringify(semesters, null, 2), 'utf8');

    console.log('✅ Generated quiz-list.json with', semesters.length, 'semester(s):');
    semesters.forEach(sem => {
        console.log(`\n  📚 ${sem.semester}:`);
        sem.subjects.forEach(sub => {
            console.log(`    📁 ${sub.subject} (${sub.files.length} quiz):`);
            sub.files.forEach(f => console.log(`      - ${f}`));
        });
    });
} catch (error) {
    console.error('❌ Error generating quiz-list.json:', error.message);
    process.exit(1);
}