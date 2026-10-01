// Use Node's vm module to find the exact syntax error position
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('/usr/src/app/server.js', 'utf8');
const lines = code.split('\n');

console.log('Total lines:', lines.length);
console.log('Total chars:', code.length);

// Try parsing the whole file and catch error position
try {
    new vm.Script(code, { filename: 'server.js' });
    console.log('No syntax errors found!');
} catch (e) {
    console.log('Error name:', e.name);
    console.log('Error message:', e.message);
    // Try to find position in stack
    const stack = e.stack || '';
    console.log('Stack:', stack.substring(0, 500));
}

// Also try: split at midpoint and check which half has the error
function hasError(slice) {
    try {
        new vm.Script(slice);
        return false;
    } catch(e) {
        return e instanceof SyntaxError && !e.message.includes('Unexpected end of input');
    }
}

// Find which 500-line chunk introduces the error
for (let chunk = 0; chunk < lines.length; chunk += 500) {
    const partial = lines.slice(0, chunk + 500).join('\n');
    try {
        new vm.Script(partial);
    } catch(e) {
        if (e instanceof SyntaxError && !e.message.includes('Unexpected end')) {
            console.log('\n=== Error found in chunk ending at line', chunk + 500, '===');
            console.log('Error:', e.message);
            // Find exact line
            const errLine = e.stack ? e.stack.match(/:(\d+)/) : null;
            if (errLine) console.log('Error at line:', errLine[1]);
            break;
        }
    }
}
