import assert from 'assert'
import 'reflect-metadata'

class Point {
  x?: number
  y?: number
}

class Line {
  private _p0?: Point
  private _p1?: Point

  @validate
  set p0(value: Point | undefined) {
    this._p0 = value
  }
  get p0() {
    return this._p0
  }

  @validate
  set p1(value: Point | undefined) {
    this._p1 = value
  }
  get p1() {
    return this._p1
  }
}

function validate<T>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) {
  let set = descriptor.set || (() => true)
  descriptor.set = function (value: T) {
    let type = Reflect.getMetadata('design:type', target, propertyKey)
    if (!(value instanceof type)) {
      throw new TypeError('Invalid type.')
    }
    set.call(target, value)
  }
}

const line = new Line()
line.p0 = new Point()
line.p1 = new Point()
assert.throws(() => (line.p1 = undefined), /Invalid type/)
