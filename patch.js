const fs = require('fs');
const file = '/home/tvd/.hermes/skills/workflows/aic/dashboard/src/components/new_layout/PipelineTracker.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{\/\* Decorative SVG \(Inside Pipeline Card - Bottom Right\) \*\/\}[\s\S]*?<\/div>/;
content = content.replace(regex, '');

fs.writeFileSync(file, content);
