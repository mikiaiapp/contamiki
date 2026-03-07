
const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
console.log('DATA_DIR:', dataDir);

if (fs.existsSync(dataDir)) {
    console.log('Contents of DATA_DIR:', fs.readdirSync(dataDir));
} else {
    console.log('DATA_DIR does not exist');
}

console.log('Contents of __dirname:', fs.readdirSync(__dirname));
