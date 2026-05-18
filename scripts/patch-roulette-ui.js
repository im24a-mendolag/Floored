const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '../components/roulette-game.tsx')
let s = fs.readFileSync(filePath, 'utf8')

// Remove unused resultProps
s = s.replace(/\n  const resultProps = isSettled[\s\S]*?\}\)\(\) : null\n/, '\n')

let tail = fs.readFileSync(path.join(__dirname, 'roulette-ui-tail.txt'), 'utf8')
tail = tail.replace(/<\/?motion\.motion.div/g, (m) => m.replace('motion.', ''))
tail = tail.replace(/<\/?motion\.motion.div/g, (m) => m.replace('motion.', ''))
tail = tail.replace(/<\/?motion\.motion.div/g, (m) => m.replace('motion.', ''))
tail = tail.replace(/<\/?motion\.div/g, (m) => m.replace('motion.', ''))

const start = s.indexOf('      <GameFieldWithHistory')
if (start < 0) throw new Error('start not found')
const head = s.slice(0, start)
fs.writeFileSync(filePath, head + tail)
console.log('patched roulette-game.tsx')
