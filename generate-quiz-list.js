// Node.js script to generate quiz-list.json dynamically
// รองรับโครงสร้างโฟลเดอร์ย่อยตามรายวิชา:
//   json/
//     Operating System/
//       Main Memory.json
//     Ebusiness/
//       EB04.json
//   (ไฟล์ที่อยู่ root json/ จะถูกจัดอยู่ใน category "ทั่วไป")

const fs = require('fs');
const path = require('path');

const jsonDir = path.join(__dirname, 'json');
const outputFile = path.join(__dirname, 'quiz-list.json');

function getFilesInDir(dir) {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
}

try {
    const entries = fs.readdirSync(jsonDir, { withFileTypes: true });

    // แยกโฟลเดอร์ย่อย กับ ไฟล์ที่อยู่ root
    const subjectFolders = entries.filter(e => e.isDirectory());
    const rootFiles = entries
        .filter(e => e.isFile() && e.name.endsWith('.json'))
        .map(e => e.name);

    const categories = [];

    // ไฟล์ในโฟลเดอร์ย่อย → แต่ละโฟลเดอร์ = 1 วิชา
    for (const folder of subjectFolders) {
        const folderPath = path.join(jsonDir, folder.name);
        const files = getFilesInDir(folderPath);
        if (files.length > 0) {
            categories.push({
                subject: folder.name,
                files: files.map(f => `${folder.name}/${f}`)
            });
        }
    }

    // ไฟล์ที่อยู่ root json/ → รวมเป็น category "ทั่วไป"
    if (rootFiles.length > 0) {
        categories.push({
            subject: 'ทั่วไป',
            files: rootFiles
        });
    }

    // เขียน quiz-list.json
    fs.writeFileSync(outputFile, JSON.stringify(categories, null, 2), 'utf8');

    console.log('✅ Generated quiz-list.json with', categories.length, 'subject(s):');
    categories.forEach(cat => {
        console.log(`\n  📚 ${cat.subject} (${cat.files.length} quiz):`);
        cat.files.forEach(f => console.log(`    - ${f}`));
    });
} catch (error) {
    console.error('❌ Error generating quiz-list.json:', error.message);
    process.exit(1);
}
