// An equivalent function is used internally in many places in Scratch to generate unique IDs.
// https://github.com/LLK/scratch-vm/blob/develop/src/util/uid.js
const generateId = () => {
  const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%()*+,-./:;=?@[]^_`{|}~";
  let result = "";
  for (let i = 0; i < 20; i++) {
    result += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  }
  return result;
};

export default generateId;
