import { platform } from 'os'
import assert from 'assert'

assert.ok(platform())
assert.match(
  '' +
    function () {
      return process.env.NODE_ENV
    },
  /process.env.NODE_ENV/
)
