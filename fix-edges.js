const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/GraphCanvas.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add MarkerType import
content = content.replace(
    "import ReactFlow, {",
    "import ReactFlow, {\n    MarkerType,"
);

// 2. Import FloatingEdge
content = content.replace(
    "import BusinessCardNode from './nodes/BusinessCardNode';",
    "import BusinessCardNode from './nodes/BusinessCardNode';\nimport FloatingEdge from './edges/FloatingEdge';"
);

// 3. Add edgeTypes
content = content.replace(
    "const nodeTypes = {\n    businessCard: BusinessCardNode,\n};",
    "const nodeTypes = {\n    businessCard: BusinessCardNode,\n};\n\nconst edgeTypes = {\n    floating: FloatingEdge,\n};"
);

// 4. Change default layoutDirection to FORCE
content = content.replace(
    "const [layoutDirection, setLayoutDirection] = React.useState('TB');",
    "const [layoutDirection, setLayoutDirection] = React.useState('FORCE');"
);

// 5. Replace edge properties
// Find all instances of: type: 'smoothstep',
// and replace with: type: 'floating', markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyleStroke, width: 15, height: 15 },
// Wait, the stroke color is different for PSCs vs others.
// We can use a regex to match the style block and extract the stroke color, then inject markerEnd.

content = content.replace(/type:\s*'smoothstep',\s*animated:\s*true,\s*label:\s*([^,]+),\s*style:\s*\{\s*stroke:\s*'([^']+)'(.*?)\}/g, (match, label, strokeColor, restOfStyle) => {
    return `type: 'floating',
                        animated: true,
                        label: ${label},
                        markerEnd: { type: MarkerType.ArrowClosed, color: '${strokeColor}', width: 15, height: 15 },
                        style: { stroke: '${strokeColor}'${restOfStyle} }`;
});

// 6. Also pass edgeTypes to ReactFlow component
content = content.replace(
    "<ReactFlow\n                        nodes={styledNodes}",
    "<ReactFlow\n                        nodes={styledNodes}\n                        edgeTypes={edgeTypes}"
);

// Verify if the replacement of <ReactFlow actually happened
if (!content.includes('edgeTypes={edgeTypes}')) {
    // Try simpler replace
    content = content.replace(
        "nodes={styledNodes}",
        "nodes={styledNodes}\n                        edgeTypes={edgeTypes}"
    );
}


fs.writeFileSync(filePath, content, 'utf8');
console.log('GraphCanvas.tsx updated successfully.');
