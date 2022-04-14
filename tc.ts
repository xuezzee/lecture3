import { Expr, Stmt, Type } from "./ast";
import {threadId} from "worker_threads";

type FunctionsEnv = Map<string, [Type[], Type]>;
type BodyEnv = Map<string, Type>;

export function tcExpr(e : Expr, functions : FunctionsEnv, variables : BodyEnv) : Type {
  switch(e.tag) {
    case "number":
      return "int";
    case "id":
      return variables.get(e.name);
    case "call":
      if (!functions.has(e.name)) {
        throw new Error(`function ${e.name} not found`);
      }

      const [args, ret] = functions.get(e.name);
      if (args.length !== e.arguments.length) {
        throw new Error(`Expected ${args.length} arguments but got ${e.arguments.length}`);
      }

      args.forEach((a, i) => {
        const argtyp = tcExpr(e.arguments[i], functions, variables);
        if (a !== argtyp) {
          throw new Error(`Got ${argtyp} as argument ${i + 1}, expected ${a}`);
        }
      });

      return ret;
    case "binexpr":
      if (e.left.tag === "id" && e.right.tag === "id") {
        if (variables.has(e.left.name) && variables.has(e.right.name)) {
          if (variables.get(e.left.name) !== variables.get(e.right.name)) {
            throw new Error(`the types of binary expression do not match. The left type is ${e.left.tag} and the right type is ${e.right.tag}`);
          }
        } else {
          throw new Error(`refer to an undefined variable`);
        }
      } else if (e.left.tag === "id") {
        if (variables.has(e.left.name)) {
          if (!(variables.get(e.left.name) === "int" && e.right.tag === "number"))
            throw new Error(`the types of binary expression do not match. The left type is ${variables.get(e.left.name)} and the right type is ${e.right.tag}`);
        } else {
          throw new Error(`refer to an undefined variable`);
        }
      } else if (e.right.tag === "id") {
        if (variables.has(e.right.name)) {
          if (!(variables.get(e.right.name) === "int" && e.left.tag === "number"))
            throw new Error(`the types of binary expression do not match. The left type is ${e.left.tag} and the right type is ${variables.get(e.right.name)}`);
        } else {
          throw new Error(`refer to an undefined variable`);
        }
      } else {
        if (e.left.tag !== e.right.tag) {
          throw new Error(`the types of binary expression do not match. The left type is ${e.left.tag} and the right type is ${e.right.tag}`);
        }
      }
  }
}

export function tcStmt(s : Stmt, functions : FunctionsEnv, variables : BodyEnv, currentReturn : Type) {
  switch(s.tag) {
    case "assign": {
      const rhs = tcExpr(s.value, functions, variables);
      if(variables.has(s.name) && variables.get(s.name) !== rhs) {
        throw new Error(`Cannot assign ${rhs} to ${variables.get(s.name)}`);
      }
      else {
        variables.set(s.name, rhs);
      }
      return;
    }
    case "define": {
      const bodyvars = new Map<string, Type>(variables.entries());
      s.parameters.forEach(p => { bodyvars.set(p.name, p.typ)});
      s.body.forEach(bs => tcStmt(bs, functions, bodyvars, s.ret));
      // var varCheckDict : Map<string, string> = new Map<string, string>();
      // s.body.forEach(bs => {
      //   if (bs.tag === "return") {
      //     tcStmt(bs, functions, )
      //     // if (s.ret == "int" && bs.value.tag == "id" && varCheckDict.get(bs.value.name) !== "number") {
      //     //   throw new Error(`The return type doesn\'t match, expect ${s.ret}, but got ${bs.value.tag}`)
      //     // } else if (s.ret == "boolean" && bs.value.tag == "id" && varCheckDict.get(bs.value.tag) !== "boolean") {
      //     //   throw new Error(`The return type doesn\'t match, expect ${s.ret}, but got ${bs.value.tag}`)
      //     // }
      //   } else if (bs.tag === "assign") {
      //     varCheckDict.set(bs.name, bs.value.tag)
      //   }
      // })
      return;
    }
    case "expr": {
      tcExpr(s.expr, functions, variables);
      return;
    }
    case "return": {
      const valTyp = tcExpr(s.value, functions, variables);
      if(valTyp !== currentReturn) {
        throw new Error(`${valTyp} returned but ${currentReturn} expected.`);
      }
      return;
    }
    case "if": {
      const condType = tcExpr(s.condition, functions, variables);
      // if (condType !== "")   //TODO: should check if the condition is a boolean expression
      tcIfStmts(s, functions, variables, currentReturn);
      s.elifs.forEach( bs => {
        tcStmt(bs, functions, variables, currentReturn);
      });
      s.elses.forEach( bs => {
        tcStmt(bs, functions, variables, currentReturn);
      });
      return;
    }
    case "elif": {
      const condType = tcExpr(s.condition, functions, variables);
      tcIfStmts(s, functions, variables, currentReturn);
      return;
    }
    case "else": {
      tcIfStmts(s, functions, variables, currentReturn);
      return;
    }
    case "while": {
      const condType = tcExpr(s.condition, functions, variables);
      tcIfStmts(s, functions, variables, currentReturn);
      return;
    }
  }
}

export function tcProgram(p : Stmt[]) {
  const functions = new Map<string, [Type[], Type]>();
  p.forEach(s => {
    if(s.tag === "define") {
      functions.set(s.name, [s.parameters.map(p => p.typ), s.ret]);
    }
  });

  const globals = new Map<string, Type>();
  p.forEach(s => {
    if(s.tag === "assign") {
      globals.set(s.name, tcExpr(s.value, functions, globals));
    }
    else {
      tcStmt(s, functions, globals, "none");
    }
  });
}

export function tcIfStmts(s: Stmt, functions: FunctionsEnv, variables: BodyEnv, currentReturn: Type) {
  if (s.tag !== "if" && s.tag !== "elif" && s.tag !== "else" && s.tag !== "while") { throw new Error("this is not a part of if statement")}
  const ifBodyVars = new Map<string, Type>();
  variables.forEach( v => {
    ifBodyVars.set(v, variables.get(v))
  });
  s.body.forEach( bs => {
    if (bs.tag === "assign") {
      if (bs.value.tag === "boolean" || bs.value.tag === "number") {
        ifBodyVars.set(bs.name, bs.value.type);
      } else if (bs.value.tag === "call") {
        let retType = tcExpr(bs.value, functions, ifBodyVars);
        ifBodyVars.set(bs.name, retType);
      }
    } else {
      tcStmt(bs, functions, ifBodyVars, currentReturn);
    }
  });
}