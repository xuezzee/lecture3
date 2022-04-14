import wabt from 'wabt';
import {BinOp, Expr, Stmt} from './ast';
import {parseProgram} from './parser';
import {tcProgram} from './tc';

const globalVars = new Set();

export async function run(watSource : string) : Promise<number> {
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
  const wabtApi = await wabt();

  // Next three lines are wat2wasm
  const parsed = wabtApi.parseWat("example", watSource);
  const binary = parsed.toBinary({});
  const wasmModule = await WebAssembly.instantiate(binary.buffer, importObject);

  // This next line is wasm-interp
  return (wasmModule.instance.exports as any)._start();
}

// (window as any)["runWat"] = run;

export function codeGenExpr(expr : Expr) : Array<string> {
  switch(expr.tag) {
    case "builtin1":
      const argStmts = codeGenExpr(expr.arg);
      return argStmts.concat([`(call $${expr.name})`]);
    case "builtin2":
      const arg1Stmts = codeGenExpr(expr.arg1)
      const arg2Stmts = codeGenExpr(expr.arg2);
      return [...arg1Stmts, ...arg2Stmts, `(call $${expr.name})`];
    case "id":
      if (globalVars.has(expr.name)) {
        return [`(global.get $${expr.name})`]
      } else {
        return [`(local.get $${expr.name})`];
      }
    case "number":
      return [`(i32.const ${expr.value})`];
    case "call":
      const valStmts = expr.arguments.map(codeGenExpr).flat();
      valStmts.push(`(call $${expr.name})`);
      return valStmts;
    case "boolean":
      if (expr.value.value === "true")
        return [`(i32.const 1)`];
      else
        return [`(i32.const 0)`]
    case "binexpr":
      const leftStmts = codeGenExpr(expr.left);
      const rightStmts = codeGenExpr(expr.right);
      const opStmt = codeGenBinOp(expr.op);
      return [...leftStmts, ...rightStmts, opStmt];
    case "uniexpr":
      var stmts : Array<string> = codeGenExpr(expr.value);
      return [`(if (result i32)
            (i32.lt_s` + stmts +
      `
              (i32.const 1)
            )
            (then
              (i32.const 1)
            )
            (else
              (i32.const 0)
            )
          )
        `
      ];
  }
}

export function codeGenStmt(stmt : Stmt) : Array<string> {
  switch(stmt.tag) {
    case "define":
      const params = stmt.parameters.map(p => `(param $${p.name} i32)`).join(" ");
      const stmts = stmt.body.map(codeGenStmt).flat();
      const stmtsBody = stmts.join("\n");
      return [`(func $${stmt.name} ${params} (result i32)
        (local $scratch i32)
        ${stmtsBody}
        (i32.const 0))`];
    case "return":
      var valStmts = codeGenExpr(stmt.value);
      valStmts.push("return");
      return valStmts;
    case "assign":
      var valStmts : Array<string>
      if (globalVars.has(stmt.name)) {
        valStmts = codeGenExpr(stmt.value);
        valStmts.push(`(global.set $${stmt.name})`);
      } else {
        valStmts =  [(`(local $${stmt.name} i32)`)]
        valStmts = valStmts
            .concat(codeGenExpr(stmt.value))
            .concat([`(local.set $${stmt.name})`]);
      }
      // valStmts.push(`(global $${stmt.name} (mut i32) (i32.const ${valStmts}))`);
      return valStmts;
    case "expr":
      const result = codeGenExpr(stmt.expr);
      result.push("(local.set $scratch)");
      return result;
    case "while":
      var wcondExpr = codeGenExpr(stmt.condition);
      var bodyStmts = stmt.body.map(codeGenStmt).flat();
      const wlocalVars : Array<string> = [];
      // wlocalVars.push(`(local $scratch i32)`);
      stmt.body.forEach(s => {
        if (s.tag === "assign" && !globalVars.has(s.name)) {
          wlocalVars.push(`(local $${s.name} i32)`);
        }
      });
      return ["(block (loop (br_if 1"]
          .concat(wcondExpr)
          .concat(["(i32.eqz))"])
          .concat(wlocalVars)
          .concat(bodyStmts)
          .concat(["(br 0) ))"]);
    case "if":
      var condExpr = codeGenExpr(stmt.condition);
      var bodyStmts = stmt.body.map(codeGenStmt).flat();
      const localVars : Array<string> = []
      // localVars.push(`(local $scratch i32)`);
      stmt.body.forEach(s => {
          if (s.tag === "assign" && !globalVars.has(s.name)) {
            localVars.push(`(local $${s.name} i32)`)
          }
      })
      var recN = 1;
      var ret = condExpr
          .concat(["(if (then"])
          .concat(localVars)
          .concat(bodyStmts)
          .concat([")"]);
      stmt.elifs.forEach((eachStmt) => {
        if (eachStmt.tag == "elif") {
          ret = ret.concat(["(else"])
          recN++;
          var condExpr = codeGenExpr(eachStmt.condition);
          var bodyStmts = stmt.body.map(codeGenStmt).flat();
          const localVars : Array<string> = [];
          // localVars.push(`(local $scratch i32)`);
          eachStmt.body.forEach(s => {
            if (s.tag === "assign" && !globalVars.has(s.name)) {
              localVars.push(`(local $${s.name} i32)`)
            }
          });
          ret = ret
              .concat(condExpr)
              .concat(["(if (then"])
              .concat(localVars)
              .concat(bodyStmts)
              .concat([")"])
        }
      });
      stmt.elses.forEach((eachStmt) => {
        recN++;
        if (eachStmt.tag == "else") {
          ret = ret.concat(["(else"])
          var bodyStmts = eachStmt.body.map(codeGenStmt).flat();
          const localVars: Array<string> = [];
          // localVars.push(`(local $scratch i32)`);
          eachStmt.body.forEach(s => {
            if (s.tag === "assign" && !globalVars.has(s.name)) {
              localVars.push(`(local $${s.name} i32)`)
            }
          });
        }
        ret = ret
            .concat(localVars)
            .concat(bodyStmts);
      });
      let endParentheses = "";
      for (let i=0; i<recN; i++) {
        endParentheses = endParentheses + ")";
      }
      ret = ret.concat([endParentheses]);
      return ret
  }
}
export function compile(source : string) : string {
  const ast = parseProgram(source);
  tcProgram(ast);
  const vars : Array<string> = [];
  ast.forEach((stmt) => {
    if(stmt.tag === "assign") {
      vars.push(stmt.name);
      globalVars.add(stmt.name)
    }
  });
  const funs : Array<string> = [];
  ast.forEach((stmt, i) => {
    if(stmt.tag === "define") { funs.push(codeGenStmt(stmt).join("\n")); }
  });

  const allFuns = funs.join("\n\n");
  const stmts = ast.filter((stmt) => stmt.tag !== "define");
  
  const varDecls : Array<string> = [];
  // varDecls.push(`(local $scratch i32)`);
  vars.forEach(v => {
    varDecls.push(`(global $${v} (mut i32) (i32.const 0))`);
    // varDecls.push(`(local $${v} i32)`);
  });

  const allStmts = stmts.map(codeGenStmt).flat();
  const ourCode = allStmts.join("\n");
  // const ourCode = varDecls.concat(allStmts).join("\n");

  const lastStmt = ast[ast.length - 1];
  const isExpr = lastStmt.tag === "expr";
  var retType = "";
  var retVal = "";
  if(isExpr) {
    retType = "(result i32)";
    retVal = "(local.get $scratch)"
  }

  return `
    (module
      (func $print (import "imports" "print") (param i32) (result i32))
      (func $abs (import "imports" "abs") (param i32) (result i32))
      (func $max (import "imports" "max") (param i32 i32) (result i32))
      (func $min (import "imports" "min") (param i32 i32) (result i32))
      (func $pow (import "imports" "pow") (param i32 i32) (result i32))
      ${varDecls}
      ${allFuns}
      (func (export "_start") ${retType}
      (local $scratch i32)
        ${ourCode}
        ${retVal}
      )
    )
  `;
  // return ourCode
}

function codeGenBinOp(op: BinOp) : string {
  switch (op) {
    case BinOp.Plus:
      return "(i32.add)"
    case BinOp.Mins:
      return "(i32.sub)"
    case BinOp.Mul:
      return "(i32.mul)"
    case BinOp.IDiv:
      return "(i32.div_s)"
    case BinOp.Mod:
      return "(i32.rem_s)"
    case BinOp.Gt:
      return "(i32.gt_s)"
    case BinOp.Lt:
      return "(i32.lt_s)"
    case BinOp.Gte:
      return "(i32.ge_s)"
    case BinOp.Lte:
      return "(i32.le_s)"
    case BinOp.Eq:
      return "(i32.eq)"
    case BinOp.Neq:
      return "(i32.ne)"

  }
}
