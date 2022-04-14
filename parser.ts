import {TreeCursor} from 'lezer';
import {parser} from 'lezer-python';
import {BinOp, Expr, Literal, Parameter, Stmt, Type} from './ast';
import {stringifyTree} from "./treeprinter";

export function parseProgram(source : string) : Array<Stmt> {
  const t = parser.parse(source).cursor();
  console.log("-------------------------------------")
  console.log(stringifyTree(t, source, 0))
  console.log("-------------------------------------")
  return traverseStmts(source, t);
}

export function traverseStmts(s : string, t : TreeCursor) {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  t.firstChild();
  const stmts = [];
  do {
    stmts.push(traverseStmt(s, t));
  } while(t.nextSibling()); // t.nextSibling() returns false when it reaches
                            //  the end of the list of children
  return stmts;
}

/*
  Invariant – t must focus on the same node at the end of the traversal
*/
export function traverseStmt(s : string, t : TreeCursor) : Stmt {
  switch(t.type.name) {
    case "ReturnStatement":
      t.firstChild();  // Focus return keyword
      t.nextSibling(); // Focus expression
      var value = traverseExpr(s, t);
      t.parent();
      return { tag: "return", value };
    case "AssignStatement":
      t.firstChild(); // focused on name (the first child)
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // focused on = sign. May need this for complex tasks, like +=!
      t.nextSibling(); // focused on the value expression

      var value = traverseExpr(s, t);
      t.parent();
      return { tag: "assign", name, value };
    case "ExpressionStatement":
      t.firstChild(); // The child is some kind of expression, the
                      // ExpressionStatement is just a wrapper with no information
      var expr = traverseExpr(s, t);
      t.parent();
      return { tag: "expr", expr: expr };
    case "FunctionDefinition":
      t.firstChild();  // Focus on def
      t.nextSibling(); // Focus on name of function
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus on ParamList
      var parameters = traverseParameters(s, t)
      t.nextSibling(); // Focus on Body or TypeDef
      let ret : Type = "none";
      let maybeTD = t;
      if(maybeTD.type.name === "TypeDef") {
        t.firstChild();
        ret = traverseType(s, t);
        t.parent();
      }
      t.nextSibling(); // Focus on single statement (for now)
      t.firstChild();  // Focus on :
      const body = [];
      while(t.nextSibling()) {
        body.push(traverseStmt(s, t));
      }
      t.parent();      // Pop to Body
      t.parent();      // Pop to FunctionDefinition
      return {
        tag: "define",
        name, parameters, body, ret
      }
    case "IfStatement":
      t.firstChild();
      var bodies = [];
      var conds = [];
      var elifs = [];
      var elses = [];
      t.nextSibling()
      var cond = traverseExpr(s, t);
      var bodyStmts = [];
      // t.firstChild();
      t.nextSibling();
      t.firstChild();
      while (t.nextSibling()) {
        bodyStmts.push(traverseStmt(s, t));
      }
      t.parent();
      // t.parent();
      bodies.push(bodyStmts);
      conds.push(cond);
      // t.parent();

      while (t.nextSibling()) {
        if (s.substring(t.from, t.to) == "elif") {
          elifs.push(traverseStmt(s, t));
        } else if (s.substring(t.from, t.to) == "else") {
          elses.push(traverseStmt(s, t));
        }
      }
      // break;
      t.parent();
      return { tag: "if", condition: cond, body: bodyStmts, elifs: elifs, elses: elses }
    case "elif":
      t.nextSibling();
      var cond = traverseExpr(s, t);
      var bodyStmts = []
      t.nextSibling();
      t.firstChild();
      while (t.nextSibling()) {
        bodyStmts.push(traverseStmt(s, t));
      }
      t.parent();
      return { tag: "elif", condition: cond, body: bodyStmts }
    case "else":
      t.nextSibling();
      t.firstChild();
      var bodyStmts = []
      while (t.nextSibling()) {
        bodyStmts.push(traverseStmt(s, t));
      }
      t.parent();
      return { tag: "else", body: bodyStmts }
    case "PassStatement":
      return {
        tag: "pass"
      }
    case "WhileStatement":
      t.firstChild();
      t.nextSibling();
      var cond = traverseExpr(s, t);
      var bodyStmts = [];
      t.nextSibling();
      t.firstChild();
      // t.nextSibling();
      // t.firstChild();
      // t.nextSibling()
      while(t.nextSibling()) {
        bodyStmts.push(traverseStmt(s, t));
      }
      t.parent();
      t.parent();
      // t.parent();
      return { tag: "while", condition: cond, body: bodyStmts};
  }
}

export function traverseType(s : string, t : TreeCursor) : Type {
  switch(t.type.name) {
    case "VariableName":
      const name = s.substring(t.from, t.to);
      if(name !== "int") {
        throw new Error("Unknown type: " + name)
      }
      return name;
    default:
      throw new Error("Unknown type: " + t.type.name)

  }
}

export function traverseParameters(s : string, t : TreeCursor) : Array<Parameter> {
  t.firstChild();  // Focuses on open paren
  const parameters = []
  t.nextSibling(); // Focuses on a VariableName
  while(t.type.name !== ")") {
    let name = s.substring(t.from, t.to);
    t.nextSibling(); // Focuses on "TypeDef", hopefully, or "," if mistake
    let nextTagName = t.type.name; // NOTE(joe): a bit of a hack so the next line doesn't if-split
    if(nextTagName !== "TypeDef") { throw new Error("Missed type annotation for parameter " + name)};
    t.firstChild();  // Enter TypeDef
    t.nextSibling(); // Focuses on type itself
    let typ = traverseType(s, t);
    t.parent();
    t.nextSibling(); // Move on to comma or ")"
    parameters.push({name, typ});
    t.nextSibling(); // Focuses on a VariableName
  }
  t.parent();       // Pop to ParamList
  return parameters;
}

export function traverseExpr(s : string, t : TreeCursor) : Expr {
  switch(t.type.name) {
    case "Number":
      return {
        tag: "number",
        value: Number(s.substring(t.from, t.to)),
        type: "int"
      };
    case "Boolean":
      var boolValue : Literal
      if (s.substring(t.from, t.to) == "True") {boolValue = {tag: "bool", value: "true"}}
      else if (s.substring(t.from, t.to) == "False") {boolValue = {tag: "bool", value: "false"}}
      return {
        tag: "boolean",
        value: boolValue,
        type: "boolean"
      }
    case "None":
    case "VariableName":
      return { tag: "id", name: s.substring(t.from, t.to) };
    case "CallExpression":
      t.firstChild(); // Focus name
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus ArgList
      t.firstChild(); // Focus open paren
      var args = traverseArguments(t, s);
      var result : Expr;
      if (name === "abs" || name === "print") {
        result = {tag: "builtin1", name: name, arg: args[0]}
      } else if (name === "max" || name === "min" || name === "pow")  {
        result = {tag: "builtin2", name: name, arg1: args[0], arg2: args[1]}
      } else {
        result = { tag: "call", name, arguments: args};
      }
      t.parent();
      return result;
    case "UnaryExpression":
      t.firstChild();
      var uniOp = s.substring(t.from, t.to);
      switch (uniOp) {
        case "-":
          t.nextSibling();
          var num = Number(uniOp + s.substring(t.from, t.to));
          if (isNaN(num))
            throw new Error("PARSE ERROR: unary operation failed");
          var ret : Expr = { tag: "number", value: num, type: "int" };
          break;
        case "not":
          t.nextSibling();
          var ret : Expr = { tag: "uniexpr", value: traverseExpr(s, t)};
          t.parent();
          break;
        default:
          throw new Error("PARSE ERROR: unsupported unary operator");
      }
      t.parent();
      // const num = Number(s.substring(c.from, c.to));
      return ret;
    case "BinaryExpression":
      t.firstChild();
      const left = traverseExpr(s, t);
      t.nextSibling();
      var op : BinOp;
      switch (s.substring(t.from, t.to)) {
        case "+":
          op = BinOp.Plus;
          break;
        case "-":
          op = BinOp.Mins;
          break;
        case "*":
          op = BinOp.Mul;
          break;
        case ">":
          op = BinOp.Gt;
          break;
        case "<":
          op = BinOp.Lt;
          break;
        case ">=":
          op = BinOp.Gte;
          break;
        case "<=":
          op = BinOp.Lte;
          break;
        case "==":
          op = BinOp.Eq;
          break;
        case "!=":
          op = BinOp.Neq;
          break;
        case "//":
          op = BinOp.IDiv;
          break;
        case "%":
          op = BinOp.Mod;
          break;
        default:
          throw new Error("PARSE ERROR: unknown binary operator");
      }
      t.nextSibling();
      const right = traverseExpr(s, t);
      t.parent();
      return { tag: "binexpr", op: op, left: left, right: right};
    case "ParenthesizedExpression":
      t.firstChild()
      t.nextSibling()
      var v = traverseExpr(s, t)
      t.parent()
      return { tag: "parexpr", value: v}
  }
}

export function traverseArguments(c : TreeCursor, s : string) : Expr[] {
  c.firstChild();  // Focuses on open paren
  const args = [];
  c.nextSibling();
  while(c.type.name !== ")") {
    let expr = traverseExpr(s, c);
    args.push(expr);
    c.nextSibling(); // Focuses on either "," or ")"
    c.nextSibling(); // Focuses on a VariableName
  } 
  c.parent();       // Pop to ArgList
  return args;
}