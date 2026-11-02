// LZString decompressor for Interactive HTML BOM (ibom.html)
const LZString = (function () {
  const f = String.fromCharCode;
  const keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const baseReverseDic = {};

  function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (let i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }

  return {
    decompressFromBase64: function (input) {
      if (input == null) return "";
      if (input === "") return null;
      return LZString._decompress(input.length, 32, function (index) {
        return getBaseValue(keyStrUriSafe, input.charAt(index));
      });
    },

    _decompress: function (length, resetValue, getNextValue) {
      const dictionary = [];
      let next;
      let enlargeIn = 4;
      let dictSize = 4;
      let numBits = 3;
      let entry = "";
      const result = [];
      let w;
      let bits, resb, maxpower, power;
      let c = "";
      const data = { val: getNextValue(0), position: resetValue, index: 1 };

      for (let i = 0; i < 3; i += 1) {
        dictionary[i] = i;
      }

      bits = 0;
      maxpower = Math.pow(2, 2);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch ((next = bits)) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          c = f(bits);
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          c = f(bits);
          break;
        case 2:
          return "";
      }

      dictionary[3] = c;
      w = c;
      result.push(c);

      while (true) {
        if (data.index > length) {
          return "";
        }

        bits = 0;
        maxpower = Math.pow(2, numBits);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }

        switch ((c = bits)) {
          case 0:
            bits = 0;
            maxpower = Math.pow(2, 8);
            power = 1;
            while (power !== maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position === 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            c = dictSize - 1;
            enlargeIn--;
            break;
          case 1:
            bits = 0;
            maxpower = Math.pow(2, 16);
            power = 1;
            while (power !== maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position === 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            c = dictSize - 1;
            enlargeIn--;
            break;
          case 2:
            return result.join("");
        }

        if (enlargeIn === 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }

        if (dictionary[c]) {
          entry = dictionary[c];
        } else {
          if (c === dictSize) {
            entry = w + w.charAt(0);
          } else {
            return null;
          }
        }
        result.push(entry);

        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn--;
        w = entry;

        if (enlargeIn === 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }
      }
    }
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = LZString;
}
if (typeof window !== "undefined") {
  window.LZString = LZString;
}
