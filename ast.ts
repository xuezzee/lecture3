
export type Type =
  | "int"
  | "none"
  | "boolean"

export type Parameter =
  | { name: string, typ: Type }

export type Stmt =
  | { tag: "assign", name: string, value: Expr }
  | { tag: "expr", expr: Expr }
  | { tag: "define", name: string, parameters: Array<Parameter>, ret: Type, body: Array<Stmt> }
  | { tag: "return", value: Expr }
  | { tag: "pass" }
  | { tag: "while", condition: Expr, body: Array<Stmt> }
  | { tag: "if", condition: Expr, body: Array<Stmt>, elifs: Array<Stmt>, elses: Array<Stmt> }
  | { tag: "elif", condition: Expr, body: Array<Stmt> }
  | { tag: "else", body: Array<Stmt> }

export type Expr =
    { tag: "boolean", value: Literal, type: Type }
  | { tag: "number", value: number, type: Type }
  | { tag: "id", name: string }
  | { tag: "call", name: string, arguments: Array<Expr> }
  | { tag: "binexpr", op: BinOp, left: Expr, right: Expr}
  | { tag: "uniexpr", value: Expr}
  | { tag: "parexpr", value: Expr}
  | { tag: "builtin1", name: string, arg: Expr }//abs(1)
  | { tag: "builtin2", name: string, arg1: Expr, arg2: Expr}//max(1, 2)

export  type Literal =
  | { tag: "bool", value: "false" }
  | { tag: "bool", value: "true"}

export enum BinOp {
    Plus,
    Mins,
    Mul,
    IDiv,
    Mod,
    Eq,
    Neq,
    Lte,
    Gte,
    Lt,
    Gt,
    Is,
    And,
    Or,
}

export enum UniOp {
    Neg,
    Not,
}



