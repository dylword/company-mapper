const fs = require('fs');
const path = './src/components/GraphCanvas.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace smoothstep with floating
content = content.replace(/type: 'smoothstep'/g, "type: 'floating'");

// Replace slate stroke colors with black
content = content.replace(/stroke: '#94a3b8'/g, "stroke: '#000000'");
content = content.replace(/color: '#94a3b8'/g, "color: '#000000'");

// Update highlight logic colors
content = content.replace(/stroke: e\.data\?\.type === 'psc' \? '#f59e0b' : '#94a3b8'/g, "stroke: '#000000'");
content = content.replace(/const defaultStroke = edge\.data\?\.type === 'psc' \? '#f59e0b' : '#94a3b8';/g, "const defaultStroke = '#000000';");


// Write back
fs.writeFileSync(path, content, 'utf8');
console.log('GraphCanvas.tsx styles and types updated successfully.');
