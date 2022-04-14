import {compile, run} from './compiler';
import {runWASM} from "./runner";


// var importObject = {
//   imports: {
//     print: (arg : any) => {
//       console.log("Logging from WASM: ", arg);
//       const elt = document.createElement("pre");
//       document.getElementById("output").appendChild(elt);
//       elt.innerText = arg;
//       return arg;
//     },
//     abs: Math.abs,
//     max: Math.max,
//     min: Math.min,
//     pow: Math.pow
//   },
// };

document.addEventListener("DOMContentLoaded", async () => {
  const runButton = document.getElementById("run");
  const userCode = document.getElementById("user-code") as HTMLTextAreaElement;
  runButton.addEventListener("click", async () => {
    const program = userCode.value;
    const output = document.getElementById("output");
    try {
      const wat = compile(program);
      const code = document.getElementById("generated-code");
      code.textContent = wat;
      const result = await run(wat);
      output.textContent = String(result);
      output.setAttribute("style", "color: black");
    }
    catch(e) {
      console.error(e)
      output.textContent = String(e);
      output.setAttribute("style", "color: red");
    }
  });

  userCode.value = localStorage.getItem("program");
  userCode.addEventListener("keypress", async() => {
    localStorage.setItem("program", userCode.value);
  });
  // runWASM(userCode.value, {importObject}).then()
});