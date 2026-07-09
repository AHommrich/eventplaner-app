if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this._parts = [];
    }

    append(name, value) {
      this._parts.push([name, value]);
    }
  };
}

if (typeof global.structuredClone === 'undefined') {
  const { deserialize, serialize } = require('node:v8');
  global.structuredClone = (value) => deserialize(serialize(value));
}
