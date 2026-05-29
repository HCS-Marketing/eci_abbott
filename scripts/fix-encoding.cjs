const fs = require('fs')
const path = 'src/app/search/page.tsx'
let content = fs.readFileSync(path, 'utf8')

// Fix corrupted "Posici\uFFFDn" to "Pos."
content = content.replace(/Posici.n Pág 1/g, 'Pos. Pág 1')
content = content.replace(/Posici.n por retail/g, 'Pos. por retail')
content = content.replace(/Evolución SOS/g, 'Evolución Posición')

// Fix remaining SOS visible labels
content = content.replace(/SOS \{page === "p1" \? "Página 1" : "Total"\}/g, 
  'Posición {page === "p1" ? "Página 1" : "Total"}')

fs.writeFileSync(path, content, 'utf8')
console.log('Done')
