export class GeometryRefusal extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GeometryRefusal";
    this.code = code;
  }
}

export function refuse(code: string, message: string): never {
  throw new GeometryRefusal(code, message);
}
