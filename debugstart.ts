import {parseProgram} from "./parser";
import {compile, run} from "./compiler";
import {runWASM} from "./runner";


var importObject = {
    imports: {
        print: (arg : any) => {
            console.log("Logging from WASM: ", arg);
            const elt = document.createElement("pre");
            document.getElementById("output").appendChild(elt);
            elt.innerText = arg;
            return arg;
        },
        abs: Math.abs,
        max: Math.max,
        min: Math.min,
        pow: Math.pow
    },
};


// var ast = parseProgram("if 1 > 2:\n   a = 1\n   print(a)\nelif 2 > 3:\n  b = 2\nelse:\n  c = 10");
var compiled = compile("def func(a: int) -> int:\n" +
    "    return a\n" +
    "\n" +
    "\n" +
    "b = 0\n" +
    "while b < 3:\n" +
    "    b = b + 1");
// var ret = runWASM("a = 10\n" +
//     "if a > 5:\n" +
//     "  a = 20", {importObject}).then((v) => {
//     console.log(v)
// })
console.log("value: ", compiled);