const { readdirSync } = require('fs')
const { execSync } = require('child_process')

const testDirs = readdirSync(__dirname).filter((name) => !name.includes('.'))

for (const testDir of testDirs) {
  console.log(`Testing ${testDir}...`)
  execSync(`node -r ${__dirname}/../register.js test.ts`, { cwd: `${__dirname}/${testDir}`, stdio: 'inherit' })
}

console.log('All tests passed')
