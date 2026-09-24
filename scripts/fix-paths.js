const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/index.html');

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf-8');
  
  // Заменяем /assets/ на ./assets/
  content = content.replace(/src="\/assets\//g, 'src="./assets/');
  content = content.replace(/href="\/assets\//g, 'href="./assets/');
  
  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log('✅ Пути в index.html исправлены на относительные');
} else {
  console.error('❌ Файл dist/index.html не найден');
  process.exit(1);
}