import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findDir(startPath, filter) {
    if (!fs.existsSync(startPath)) {
        return;
    }

    let files = [];
    try {
        files = fs.readdirSync(startPath);
    } catch (e) {
        // console.error(`Cannot read dir ${startPath}: ${e.message}`);
        return;
    }

    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        
        const filename = path.join(startPath, file);
        let stat;
        try {
            stat = fs.lstatSync(filename);
        } catch (e) {
            continue;
        }

        if (stat.isDirectory()) {
            if (filename.includes(filter)) {
                console.log('-- FOUND:', filename);
            }
            findDir(filename, filter); // Recurse
        }
    }
}

console.log('Searching for directories containing "mailmafernandez"...');
findDir('.', 'mailmafernandez');
console.log('Search complete.');
