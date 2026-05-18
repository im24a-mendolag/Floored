const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '../components/slots-game.tsx')
const tailPath = path.join(__dirname, 'slots-ui-tail.txt')

let s = fs.readFileSync(filePath, 'utf8')
let tail = fs.readFileSync(tailPath, 'utf8').replace(/DIVTAG/g, 'motion.div').replace(/motion\.div/g, 'motion.div')
tail = tail.replace(/DIVTAG/g, 'div')

const start = s.indexOf('      <GameFieldWithHistory')
const end = s.lastIndexOf('\n}')
if (start < 0) throw new Error('start not found')

const head = s.slice(0, start)
fs.writeFileSync(filePath, head + tail)
console.log('patched slots-game.tsx')
