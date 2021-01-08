import wabt from 'wabt';
import {Stmt, Expr} from './ast';
import {parseProgram} from './parser';

export async function run(watSource : string) : Promise<number> {
  const wabtApi = await wabt();

  // Next three lines are wat2wasm
  const parsed = wabtApi.parseWat("example", watSource);
  const binary = parsed.toBinary({});
  const wasmModule = await WebAssembly.instantiate(binary.buffer, {});

  // This next line is wasm-interp
  return (wasmModule.instance.exports as any)._start();
}
export function codeGenExpr(expr : Expr) : Array<string> {
  switch(expr.tag) {
    case "id": return [`(local.get $${expr.name})`];
    case "number": return [`(i32.const ${expr.value})`];
  }
}
export function codeGenStmt(stmt : Stmt) : Array<string> {
  switch(stmt.tag) {
    case "assign":
      const valstmts = codeGenExpr(stmt.value);
      valstmts.push(`(local.set $${stmt.name})`);
      return valstmts;
    case "expr":
      const result = codeGenExpr(stmt.expr);
      result.push("(local.set $scratch)");
      return result;
  }
}
export function compile(source : string) : string {
  const ast = parseProgram(source);
  const vars : Array<string> = [];
  ast.forEach((stmt) => {
    if(stmt.tag === "assign") { vars.push(stmt.name); }
  });
  const varDecls : Array<string> = [];
  varDecls.push(`(local $scratch i32)`);
  vars.forEach(v => { varDecls.push(`(local $${v} i32)`); });

  const allStmts = ast.map(codeGenStmt).flat();
  const ourCode = varDecls.concat(allStmts).join("\n");

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
      (func (export "_start") ${retType}
        ${ourCode}
        ${retVal}
      )
    ) 
  `;
}
